import os
import secrets
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, EmailStr, Field

from database import db
from permissions import permissions_for
from security import (
    get_current_user, hash_password, verify_password, set_auth_cookies,
    clear_auth_cookies, get_jwt_secret,
)
import jwt
from tenant_provisioning import provision_tenant
from utils import client_ip, err, log_audit

router = APIRouter(prefix="/api/auth", tags=["auth"])


EMAIL_VERIFICATION_TTL_HOURS = 72


def _build_verify_link(token: str) -> str:
    base = os.environ.get("APP_URL") or (os.environ.get("CORS_ORIGINS", "").split(",")[0] if os.environ.get("CORS_ORIGINS") else "")
    base = (base or "").rstrip("/")
    return f"{base}/verify-email?token={token}" if base else f"/verify-email?token={token}"


async def _create_email_verification_token(user_id: str, tenant_id: str | None, email: str) -> str:
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    await db.email_verification_tokens.insert_one({
        "token": token,
        "user_id": user_id,
        "tenant_id": tenant_id,
        "email": email.lower(),
        "used": False,
        "created_at": now,
        "expires_at": now + timedelta(hours=EMAIL_VERIFICATION_TTL_HOURS),
    })
    return token


class LoginBody(BaseModel):
    email: EmailStr
    password: str


async def build_session_payload(user: dict) -> dict:
    payload = {
        "user": {k: user.get(k) for k in ("id", "code", "name", "email", "role", "outlet_ids")},
        "permissions": permissions_for(user["role"]),
        "tenant": None, "features": {}, "subscription": None, "outlets": [],
        # email_verified: default True for pre-existing users without the field
        # (only new self-service signups start with False)
        "email_verified": bool(user.get("email_verified", True)),
    }
    if user["role"] == "PLATFORM_ADMIN":
        return payload
    tenant = await db.tenants.find_one({"id": user["tenant_id"]}, {"_id": 0})
    sub = await db.subscriptions.find_one({"tenant_id": user["tenant_id"]}, {"_id": 0})
    plan = await db.subscription_plans.find_one({"code": sub["plan_code"]}, {"_id": 0}) if sub else None
    if tenant:
        payload["tenant"] = {k: tenant.get(k) for k in ("id", "code", "name", "brand_name")}
    if sub and plan:
        payload["features"] = plan.get("features") or {}
        payload["subscription"] = {
            "plan_code": plan["code"], "plan_name": plan["name"], "status": sub["status"],
            "current_period_end": sub.get("current_period_end"), "trial_ends_at": sub.get("trial_ends_at"),
        }
    if tenant:
        if user["role"] in ("OWNER", "MANAGER"):
            q = {"tenant_id": tenant["id"], "active": True}
        else:
            q = {"tenant_id": tenant["id"], "active": True, "id": {"$in": user.get("outlet_ids") or []}}
        payload["outlets"] = await db.outlets.find(q, {"_id": 0, "id": 1, "code": 1, "name": 1, "address": 1}).to_list(100)
    return payload


class SignupBody(BaseModel):
    business_name: str = Field(min_length=2, max_length=120)
    brand_name: str = ""
    owner_name: str = Field(min_length=2, max_length=120)
    owner_email: EmailStr
    owner_password: str = Field(min_length=8, max_length=200)
    plan_code: str = "FREE"


SIGNUP_RATE_LIMIT = 5           # max attempts
SIGNUP_RATE_WINDOW_MIN = 60     # per hour


@router.post("/signup")
async def signup(body: SignupBody, request: Request, response: Response):
    # 1) Rate limit per IP (5/hour). Collection has TTL index on expires_at.
    #    client_ip() reads X-Forwarded-For so users behind a reverse proxy each get their own bucket.
    ip = client_ip(request)
    now = datetime.now(timezone.utc)
    attempt = await db.signup_attempts.find_one({"_id": ip})

    def _to_aware(dt):
        if dt is None:
            return None
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

    if attempt and attempt.get("count", 0) >= SIGNUP_RATE_LIMIT:
        window_start = _to_aware(attempt.get("window_start"))
        if window_start and (now - window_start) < timedelta(minutes=SIGNUP_RATE_WINDOW_MIN):
            err(429, "TOO_MANY_SIGNUPS", "Too many signup attempts from this IP. Try again in an hour.")

    # 2) Force plan_code = FREE at signup regardless of client input.
    # Non-FREE selection is only a marketing hint to be honored later via billing / manual activation.
    plan_code = "FREE"

    # 3) trial_days: env-driven, default 14
    try:
        trial_days = int(os.environ.get("DEFAULT_TRIAL_DAYS", "14"))
    except ValueError:
        trial_days = 14
    if trial_days < 0:
        trial_days = 0

    # 4) Provision tenant via shared function (may raise err on email/plan issues)
    try:
        result = await provision_tenant(
            name=body.business_name.strip(),
            brand_name=(body.brand_name or "").strip(),
            owner_name=body.owner_name.strip(),
            owner_email=body.owner_email,
            owner_password=body.owner_password,
            plan_code=plan_code,
            trial_days=trial_days,
            changed_by=body.owner_email.lower(),
            source="SELF_SIGNUP",
            reason="Self-service signup",
        )
    except Exception:
        # count failed attempt; increment window
        expires = now + timedelta(minutes=SIGNUP_RATE_WINDOW_MIN)
        aw_start = _to_aware(attempt.get("window_start")) if attempt else None
        if aw_start and (now - aw_start) < timedelta(minutes=SIGNUP_RATE_WINDOW_MIN):
            await db.signup_attempts.update_one(
                {"_id": ip},
                {"$inc": {"count": 1}, "$set": {"last_at": now, "expires_at": expires}},
            )
        else:
            await db.signup_attempts.update_one(
                {"_id": ip},
                {"$set": {"count": 1, "window_start": now, "last_at": now, "expires_at": expires}},
                upsert=True,
            )
        raise

    # 5) Count success too (still rate-limit success to prevent tenant spam)
    expires = now + timedelta(minutes=SIGNUP_RATE_WINDOW_MIN)
    aw_start = _to_aware(attempt.get("window_start")) if attempt else None
    if aw_start and (now - aw_start) < timedelta(minutes=SIGNUP_RATE_WINDOW_MIN):
        await db.signup_attempts.update_one(
            {"_id": ip},
            {"$inc": {"count": 1}, "$set": {"last_at": now, "expires_at": expires}},
        )
    else:
        await db.signup_attempts.update_one(
            {"_id": ip},
            {"$set": {"count": 1, "window_start": now, "last_at": now, "expires_at": expires}},
            upsert=True,
        )

    # 6) Auto-login: set cookies and return session payload
    user = await db.users.find_one({"id": result["user_id"]})
    # 6a) Mark this user as email-unverified (self-signup only)
    await db.users.update_one({"id": user["id"]}, {"$set": {"email_verified": False}})
    user["email_verified"] = False
    # 6b) Create verification token + log link (no mail service yet)
    try:
        verify_token = await _create_email_verification_token(user["id"], user.get("tenant_id"), user["email"])
        link = _build_verify_link(verify_token)
        import logging
        logging.getLogger(__name__).info("EMAIL_VERIFICATION_LINK for %s: %s", user["email"], link)
    except Exception:
        # Non-fatal: signup still succeeds; user can request resend later.
        import logging
        logging.getLogger(__name__).exception("Failed to create email verification token for %s", user["email"])
    set_auth_cookies(response, user["id"], user["email"])
    user.pop("password_hash", None)
    user.pop("_id", None)
    await log_audit(user.get("tenant_id"), None, user, "SIGNUP", "tenant", result["tenant"]["id"])
    payload = await build_session_payload(user)
    # Frontend needs to know the ORIGINAL plan_code requested (from marketing landing).
    payload["requested_plan_code"] = (body.plan_code or "FREE").upper()
    payload["provisioned_plan_code"] = plan_code
    return payload


@router.post("/login")
async def login(body: LoginBody, request: Request, response: Response):
    email = body.email.lower()
    ip = client_ip(request)
    key = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"_id": key})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = attempt.get("locked_until")
        if locked_until and locked_until > datetime.now(timezone.utc):
            err(429, "TOO_MANY_ATTEMPTS", "Account temporarily locked. Try again later.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        count = (attempt or {}).get("count", 0) + 1
        update = {"count": count, "last_at": datetime.now(timezone.utc)}
        if count >= 5:
            update["locked_until"] = datetime.now(timezone.utc) + timedelta(minutes=15)
        await db.login_attempts.update_one({"_id": key}, {"$set": update}, upsert=True)
        err(401, "INVALID_CREDENTIALS", "Invalid email or password")
    if not user.get("active", True):
        err(403, "ACCOUNT_DISABLED", "Account is deactivated")
    await db.login_attempts.delete_one({"_id": key})
    set_auth_cookies(response, user["id"], email)
    user.pop("password_hash", None)
    user.pop("_id", None)
    await log_audit(user.get("tenant_id"), None, user, "LOGIN", "user", user["id"])
    return await build_session_payload(user)


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
async def change_password(body: ChangePasswordBody, user=Depends(get_current_user)):
    stored_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not stored_user or not verify_password(body.current_password, stored_user.get("password_hash", "")):
        err(401, "INVALID_CURRENT_PASSWORD", "Current password is incorrect")
    if not body.new_password:
        err(400, "INVALID_PASSWORD", "New password is required")
    changed_at = datetime.now(timezone.utc)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": hash_password(body.new_password), "password_changed_at": changed_at}},
    )
    await log_audit(user.get("tenant_id"), None, user, "PASSWORD_SELF_CHANGE", "user", user["id"])
    return {"ok": True}


@router.post("/logout")
async def logout(response: Response, user=Depends(get_current_user)):
    clear_auth_cookies(response)
    await log_audit(user.get("tenant_id"), None, user, "LOGOUT", "user", user["id"])
    return {"ok": True}


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return await build_session_payload(user)


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        err(401, "UNAUTHORIZED", "No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=["HS256"])
        if payload.get("type") != "refresh":
            err(401, "UNAUTHORIZED", "Invalid token type")
    except jwt.InvalidTokenError:
        err(401, "UNAUTHORIZED", "Invalid refresh token")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user or not user.get("active", True):
        err(401, "UNAUTHORIZED", "Account not found")
    set_auth_cookies(response, user["id"], user["email"])
    return {"ok": True}


@router.post("/forgot-password")
async def forgot_password(body: LoginBody):
    # Only email is used; password field ignored (pydantic requires it, keep simple schema separate)
    return {"ok": True}


class ForgotBody(BaseModel):
    email: EmailStr


@router.post("/forgot-password-request")
async def forgot_password_request(body: ForgotBody):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": token, "user_id": user["id"], "used": False,
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "created_at": datetime.now(timezone.utc),
        })
        import logging
        logging.getLogger(__name__).info("Password reset token for %s: %s", email, token)
    return {"ok": True}


class ResetBody(BaseModel):
    token: str
    password: str


@router.post("/reset-password")
async def reset_password(body: ResetBody):
    doc = await db.password_reset_tokens.find_one({"token": body.token, "used": False})
    if not doc or doc["expires_at"] < datetime.now(timezone.utc):
        err(400, "INVALID_TOKEN", "Reset token invalid or expired")
    await db.users.update_one({"id": doc["user_id"]}, {"$set": {"password_hash": hash_password(body.password)}})
    await db.password_reset_tokens.update_one({"token": body.token}, {"$set": {"used": True}})
    return {"ok": True}


class VerifyEmailBody(BaseModel):
    token: str


@router.post("/verify-email")
async def verify_email(body: VerifyEmailBody):
    doc = await db.email_verification_tokens.find_one({"token": body.token})
    if not doc:
        err(400, "INVALID_TOKEN", "Verification link invalid")
    if doc.get("used"):
        # Idempotent: already used tokens still return ok so a user clicking twice sees success.
        user = await db.users.find_one({"id": doc["user_id"]}, {"_id": 0, "email": 1})
        return {"ok": True, "already_verified": True, "email": user.get("email") if user else None}
    expires_at = doc.get("expires_at")
    if expires_at:
        exp = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            err(400, "TOKEN_EXPIRED", "Verification link expired. Please request a new one.")
    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"id": doc["user_id"]},
        {"$set": {"email_verified": True, "email_verified_at": now}},
    )
    await db.email_verification_tokens.update_one(
        {"token": body.token},
        {"$set": {"used": True, "used_at": now}},
    )
    user = await db.users.find_one({"id": doc["user_id"]}, {"_id": 0, "email": 1, "tenant_id": 1})
    if user:
        await log_audit(user.get("tenant_id"), None, user, "EMAIL_VERIFIED", "user", doc["user_id"])
    return {"ok": True, "email": user.get("email") if user else None}


@router.post("/resend-verification")
async def resend_verification(request: Request, user=Depends(get_current_user)):
    # Rate limit resend: 1 per minute per user
    now = datetime.now(timezone.utc)
    fresh_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not fresh_user:
        err(404, "USER_NOT_FOUND", "User not found")
    if fresh_user.get("email_verified"):
        return {"ok": True, "already_verified": True}
    # Check most recent unused token: throttle if just created in last 60s
    last = await db.email_verification_tokens.find_one(
        {"user_id": user["id"], "used": False},
        sort=[("created_at", -1)],
    )
    if last and last.get("created_at"):
        created = last["created_at"]
        created_aw = created if created.tzinfo else created.replace(tzinfo=timezone.utc)
        if (now - created_aw) < timedelta(seconds=60):
            err(429, "RESEND_COOLDOWN", "Please wait a minute before requesting another link.")
    token = await _create_email_verification_token(user["id"], user.get("tenant_id"), user["email"])
    link = _build_verify_link(token)
    import logging
    logging.getLogger(__name__).info("EMAIL_VERIFICATION_LINK for %s (resend): %s", user["email"], link)
    return {"ok": True}
