import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr

from database import db
from entitlements import get_entitlements, enforce_limit, release_limit
from permissions import ROLES, permissions_for
from security import hash_password, require_permission
from utils import err, next_seq, log_audit

router = APIRouter(prefix="/api", tags=["users"])


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    outlet_ids: list[str] = []


class UserUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    outlet_ids: list[str] | None = None
    active: bool | None = None
    password: str | None = None


@router.get("/roles")
async def list_roles(user=Depends(require_permission("users.view", "users.manage"))):
    return [{"role": r, "permissions": permissions_for(r)} for r in ROLES]


@router.get("/users")
async def list_users(ent=Depends(get_entitlements)):
    if ent["user"]["role"] not in ("OWNER", "MANAGER"):
        err(403, "FORBIDDEN", "Insufficient role permission")
    return await db.users.find({"tenant_id": ent["tenant"]["id"]}, {"_id": 0, "password_hash": 0}).sort("code", 1).to_list(500)


@router.post("/users")
async def create_user(body: UserCreate, ent=Depends(get_entitlements)):
    if ent["user"]["role"] != "OWNER":
        err(403, "FORBIDDEN", "Only OWNER can create users")
    if body.role not in ROLES:
        err(400, "INVALID_ROLE", f"Role must be one of {ROLES}")
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        err(409, "EMAIL_EXISTS", "Email already registered")
    valid_outlets = {o["id"] for o in await db.outlets.find({"tenant_id": ent["tenant"]["id"]}, {"id": 1}).to_list(500)}
    outlet_ids = [o for o in body.outlet_ids if o in valid_outlets]
    await enforce_limit(ent, "USER_LIMIT", "users_count", "USER_LIMIT_REACHED")
    seq = await next_seq(f"user_code:{ent['tenant']['id']}")
    doc = {"id": str(uuid.uuid4()), "code": f"U{seq:03d}", "tenant_id": ent["tenant"]["id"], "name": body.name,
           "email": email, "password_hash": hash_password(body.password), "role": body.role,
           "outlet_ids": outlet_ids, "active": True, "created_at": datetime.now(timezone.utc)}
    await db.users.insert_one(doc)
    await log_audit(ent["tenant"]["id"], None, ent["user"], "USER_CREATE", "user", doc["id"], None,
                    {"email": email, "role": body.role})
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


@router.patch("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdate, ent=Depends(get_entitlements)):
    if ent["user"]["role"] != "OWNER":
        err(403, "FORBIDDEN", "Only OWNER can edit users")
    target = await db.users.find_one({"id": user_id, "tenant_id": ent["tenant"]["id"]})
    if not target:
        err(404, "USER_NOT_FOUND", "User not found")
    update = {}
    if body.name is not None:
        update["name"] = body.name
    if body.role is not None:
        if body.role not in ROLES:
            err(400, "INVALID_ROLE", "Invalid role")
        update["role"] = body.role
    if body.outlet_ids is not None:
        valid = {o["id"] for o in await db.outlets.find({"tenant_id": ent["tenant"]["id"]}, {"id": 1}).to_list(500)}
        update["outlet_ids"] = [o for o in body.outlet_ids if o in valid]
    if body.password:
        update["password_hash"] = hash_password(body.password)
    if body.active is not None and body.active != target.get("active", True):
        update["active"] = body.active
        if body.active:
            await enforce_limit(ent, "USER_LIMIT", "users_count", "USER_LIMIT_REACHED")
        else:
            await release_limit(ent["tenant"]["id"], "users_count")
    if not update:
        return {k: v for k, v in target.items() if k not in ("_id", "password_hash")}
    res = await db.users.find_one_and_update({"id": user_id}, {"$set": update}, return_document=True,
                                             projection={"_id": 0, "password_hash": 0})
    await log_audit(ent["tenant"]["id"], None, ent["user"], "USER_UPDATE", "user", user_id, None,
                    {k: ("***" if k == "password_hash" else v) for k, v in update.items()})
    return res
