import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from database import db
from entitlements import get_entitlements, enforce_limit
from security import require_permission
from utils import err, next_seq, log_audit

router = APIRouter(prefix="/api/outlets", tags=["outlets"])


class OutletBody(BaseModel):
    name: str
    address: str = ""
    phone: str = ""
    email: str = ""


@router.get("")
async def list_outlets(ent=Depends(get_entitlements)):
    user = ent["user"]
    q = {"tenant_id": ent["tenant"]["id"]}
    if user["role"] not in ("OWNER", "MANAGER"):
        q["id"] = {"$in": user.get("outlet_ids") or []}
    return await db.outlets.find(q, {"_id": 0}).sort("code", 1).to_list(500)


@router.post("")
async def create_outlet(body: OutletBody, ent=Depends(get_entitlements)):
    if ent["user"]["role"] != "OWNER":
        err(403, "FORBIDDEN", "Only OWNER can create outlets")
    await enforce_limit(ent, "OUTLET_LIMIT", "outlets_count", "OUTLET_LIMIT_REACHED")
    seq = await next_seq(f"outlet_code:{ent['tenant']['id']}")
    doc = {"id": str(uuid.uuid4()), "tenant_id": ent["tenant"]["id"], "code": f"O{seq:02d}",
           "name": body.name, "address": body.address, "phone": body.phone, "email": body.email,
           "active": True, "created_at": datetime.now(timezone.utc)}
    await db.outlets.insert_one(doc)
    await log_audit(ent["tenant"]["id"], doc["id"], ent["user"], "OUTLET_CREATE", "outlet", doc["id"], None, body.model_dump())
    doc.pop("_id", None)
    return doc


@router.patch("/{outlet_id}")
async def update_outlet(outlet_id: str, body: OutletBody, ent=Depends(get_entitlements)):
    if ent["user"]["role"] != "OWNER":
        err(403, "FORBIDDEN", "Only OWNER can edit outlets")
    res = await db.outlets.find_one_and_update(
        {"id": outlet_id, "tenant_id": ent["tenant"]["id"]},
        {"$set": {"name": body.name, "address": body.address, "phone": body.phone, "email": body.email}},
        return_document=True, projection={"_id": 0})
    if not res:
        err(404, "OUTLET_NOT_FOUND", "Outlet not found")
    await log_audit(ent["tenant"]["id"], outlet_id, ent["user"], "OUTLET_UPDATE", "outlet", outlet_id, None, body.model_dump())
    return res


@router.patch("/{outlet_id}/status")
async def toggle_outlet(outlet_id: str, body: dict, ent=Depends(get_entitlements)):
    if ent["user"]["role"] != "OWNER":
        err(403, "FORBIDDEN", "Only OWNER can change outlet status")
    res = await db.outlets.find_one_and_update(
        {"id": outlet_id, "tenant_id": ent["tenant"]["id"]},
        {"$set": {"active": bool(body.get("active"))}}, return_document=True, projection={"_id": 0})
    if not res:
        err(404, "OUTLET_NOT_FOUND", "Outlet not found")
    return res
