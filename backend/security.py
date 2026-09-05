import os
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import Depends, Request

from database import db
from permissions import has_permission
from utils import err

JWT_ALGORITHM = "HS256"


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response, user_id: str, email: str):
    response.set_cookie("access_token", create_access_token(user_id, email), httponly=True, secure=True, samesite="none", max_age=3600, path="/")
    response.set_cookie("refresh_token", create_refresh_token(user_id), httponly=True, secure=True, samesite="none", max_age=604800, path="/")


def clear_auth_cookies(response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        err(401, "UNAUTHORIZED", "Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            err(401, "UNAUTHORIZED", "Invalid token type")
    except jwt.ExpiredSignatureError:
        err(401, "SESSION_EXPIRED", "Session expired")
    except jwt.InvalidTokenError:
        err(401, "UNAUTHORIZED", "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user or not user.get("active", True):
        err(401, "UNAUTHORIZED", "Account not found or deactivated")
    return user


def require_permission(*perms: str):
    async def dep(user=Depends(get_current_user)):
        if not any(has_permission(user["role"], p) for p in perms):
            err(403, "FORBIDDEN", "Insufficient role permission")
        return user

    return dep


async def assert_outlet_access(user: dict, outlet_id: str) -> dict:
    """Server-side outlet authorization. Never trust client-provided tenant context."""
    outlet = await db.outlets.find_one({"id": outlet_id, "tenant_id": user["tenant_id"]}, {"_id": 0})
    if not outlet:
        err(404, "OUTLET_NOT_FOUND", "Outlet not found")
    if user["role"] in ("OWNER", "MANAGER"):
        return outlet
    if outlet_id not in (user.get("outlet_ids") or []):
        err(403, "OUTLET_NOT_AUTHORIZED", "Not authorized for this outlet")
    return outlet
