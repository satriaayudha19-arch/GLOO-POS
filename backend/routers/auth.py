import os
import secrets
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, EmailStr

from database import db
from permissions import permissions_for
from security import (
    get_current_user, hash_password, verify_password, set_auth_cookies,
    clear_auth_cookies, get_jwt_secret,
)
import jwt
from utils import err, log_audit

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginBody(BaseModel):
    email: EmailStr
    password: str


async def build_session_payload(user: dict) -> dict:
    payload = {
        "user": {k: user.get(k) for k in ("id", "code", "name", "email", "role", "outlet_ids")},
        "permissions": permissions_for(user["role"]),
        "tenant": None, "features": {}, "subscription": None, "outlets": [],
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


@router.post("/login")
async def login(body: LoginBody, request: Request, response: Response):
    email = body.email.lower()
    ip = request.client.host if request.client else "unknown"
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
