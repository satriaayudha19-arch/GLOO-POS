import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from database import db
from entitlements import require_feature, get_entitlements
from permissions import has_permission
from security import assert_outlet_access, get_current_user
from utils import err, log_audit

router = APIRouter(prefix="/api", tags=["shifts"])
PROJ = {"_id": 0}


async def add_journal(tenant_id, outlet_id, user, jtype, ref_id, data):
    await db.journal.insert_one({
        "id": str(uuid.uuid4()), "tenant_id": tenant_id, "outlet_id": outlet_id, "type": jtype,
        "ref_id": ref_id, "actor_id": user["id"], "actor_name": user["name"], "data": data,
        "created_at": datetime.now(timezone.utc),
    })


class OpenShiftBody(BaseModel):
    outlet_id: str
    opening_cash: int


@router.post("/shifts/open")
async def open_shift(body: OpenShiftBody, ent=Depends(require_feature("POS"))):
    user = ent["user"]
    if not has_permission(user["role"], "shifts.use") and not has_permission(user["role"], "shifts.manage"):
        err(403, "FORBIDDEN", "Insufficient role permission")
    await assert_outlet_access(user, body.outlet_id)
    open_key = f"{body.outlet_id}:{user['id']}"
    doc = {
        "id": str(uuid.uuid4()), "tenant_id": ent["tenant"]["id"], "outlet_id": body.outlet_id,
        "user_id": user["id"], "cashier_code": user["code"], "cashier_name": user["name"],
        "opened_at": datetime.now(timezone.utc), "opening_cash": body.opening_cash,
        "cash_in": 0, "cash_out": 0, "status": "OPEN", "open_key": open_key,
        "closed_at": None, "expected_cash": None, "actual_cash": None, "variance": None,
        "cash_sales": 0, "total_sales": 0, "orders_count": 0,
    }
    try:
        await db.shifts.insert_one(doc)
    except Exception:
        err(409, "SHIFT_ALREADY_OPEN", "You already have an open shift at this outlet")
    doc.pop("_id", None)
    await add_journal(ent["tenant"]["id"], body.outlet_id, user, "SHIFT_OPEN", doc["id"], {"opening_cash": body.opening_cash})
    await log_audit(ent["tenant"]["id"], body.outlet_id, user, "SHIFT_OPEN", "shift", doc["id"], None, {"opening_cash": body.opening_cash})
    return doc


@router.get("/shifts/current")
async def current_shift(outlet_id: str, user=Depends(get_current_user)):
    await assert_outlet_access(user, outlet_id)
    if has_permission(user["role"], "shifts.manage"):
        q = {"tenant_id": user["tenant_id"], "outlet_id": outlet_id, "status": "OPEN"}
    else:
        q = {"tenant_id": user["tenant_id"], "outlet_id": outlet_id, "status": "OPEN", "user_id": user["id"]}
    return await db.shifts.find_one(q, PROJ) or {}


@router.get("/shifts")
async def list_shifts(outlet_id: str | None = None, user=Depends(get_current_user)):
    if not (has_permission(user["role"], "shifts.manage") or has_permission(user["role"], "shifts.use")):
        err(403, "FORBIDDEN", "Insufficient role permission")
    q = {"tenant_id": user["tenant_id"]}
    if outlet_id:
        await assert_outlet_access(user, outlet_id)
        q["outlet_id"] = outlet_id
    if not has_permission(user["role"], "shifts.manage") and user["role"] not in ("OWNER",):
        q["user_id"] = user["id"]
    return await db.shifts.find(q, PROJ).sort("opened_at", -1).to_list(200)


class CashMovementBody(BaseModel):
    direction: str  # IN | OUT
    amount: int
    note: str = ""


@router.post("/shifts/{shift_id}/cash")
async def cash_movement(shift_id: str, body: CashMovementBody, user=Depends(get_current_user)):
    if not (has_permission(user["role"], "shifts.use") or has_permission(user["role"], "shifts.manage")):
        err(403, "FORBIDDEN", "Insufficient role permission")
    if body.direction not in ("IN", "OUT") or body.amount <= 0:
        err(400, "INVALID_REQUEST", "direction must be IN|OUT and amount > 0")
    field = "cash_in" if body.direction == "IN" else "cash_out"
    res = await db.shifts.find_one_and_update(
        {"id": shift_id, "tenant_id": user["tenant_id"], "status": "OPEN"},
        {"$inc": {field: body.amount}}, return_document=True, projection=PROJ)
    if not res:
        err(404, "SHIFT_NOT_OPEN", "Open shift not found")
    await add_journal(user["tenant_id"], res["outlet_id"], user, f"CASH_{body.direction}", shift_id,
                      {"amount": body.amount, "note": body.note})
    return res


class CloseShiftBody(BaseModel):
    actual_cash: int


@router.post("/shifts/{shift_id}/close")
async def close_shift(shift_id: str, body: CloseShiftBody, user=Depends(get_current_user)):
    if not (has_permission(user["role"], "shifts.use") or has_permission(user["role"], "shifts.manage")):
        err(403, "FORBIDDEN", "Insufficient role permission")
    shift = await db.shifts.find_one({"id": shift_id, "tenant_id": user["tenant_id"], "status": "OPEN"}, PROJ)
    if not shift:
        err(404, "SHIFT_NOT_OPEN", "Open shift not found")
    if shift["user_id"] != user["id"] and not has_permission(user["role"], "shifts.manage") and user["role"] != "OWNER":
        err(403, "FORBIDDEN", "Cannot close another cashier's shift")
    agg = await db.orders.aggregate([
        {"$match": {"shift_id": shift_id, "status": "PAID"}},
        {"$group": {"_id": None,
                    "cash_sales": {"$sum": {"$cond": [{"$eq": ["$payment.method_type", "CASH"]}, "$grand_total", 0]}},
                    "total_sales": {"$sum": "$grand_total"},
                    "orders_count": {"$sum": 1}}},
    ]).to_list(1)
    stats = agg[0] if agg else {"cash_sales": 0, "total_sales": 0, "orders_count": 0}
    expected = shift["opening_cash"] + stats["cash_sales"] + shift.get("cash_in", 0) - shift.get("cash_out", 0)
    res = await db.shifts.find_one_and_update(
        {"id": shift_id, "status": "OPEN"},
        {"$set": {"status": "CLOSED", "closed_at": datetime.now(timezone.utc), "expected_cash": expected,
                  "actual_cash": body.actual_cash, "variance": body.actual_cash - expected,
                  "cash_sales": stats["cash_sales"], "total_sales": stats["total_sales"],
                  "orders_count": stats["orders_count"]},
         "$unset": {"open_key": ""}},
        return_document=True, projection=PROJ)
    if not res:
        err(404, "SHIFT_NOT_OPEN", "Shift was already closed")
    await add_journal(user["tenant_id"], res["outlet_id"], user, "SHIFT_CLOSE", shift_id,
                      {"expected_cash": expected, "actual_cash": body.actual_cash, "variance": res["variance"]})
    await log_audit(user["tenant_id"], res["outlet_id"], user, "SHIFT_CLOSE", "shift", shift_id, None,
                    {"expected_cash": expected, "actual_cash": body.actual_cash, "variance": res["variance"]})
    return res


@router.get("/journal")
async def list_journal(outlet_id: str, ent=Depends(get_entitlements)):
    user = ent["user"]
    if not (has_permission(user["role"], "shifts.manage") or user["role"] == "OWNER"):
        err(403, "FORBIDDEN", "Insufficient role permission")
    await assert_outlet_access(user, outlet_id)
    return await db.journal.find({"tenant_id": user["tenant_id"], "outlet_id": outlet_id}, PROJ).sort("created_at", -1).to_list(300)
