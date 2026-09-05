from decimal import Decimal, ROUND_HALF_UP
from fastapi import HTTPException
from pymongo import ReturnDocument
from database import db


def err(status: int, code: str, message: str = None):
    raise HTTPException(status_code=status, detail={"code": code, "message": message or code})


async def next_seq(key: str) -> int:
    doc = await db.counters.find_one_and_update(
        {"_id": key}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    return doc["seq"]


def pct_of(base: int, percent) -> int:
    """Money-safe percentage: integer minor units, half-up rounding."""
    q = (Decimal(base) * Decimal(str(percent)) / Decimal(100)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int(q)


async def log_audit(tenant_id, outlet_id, user, action, entity, entity_id, previous=None, new=None):
    await db.audit_logs.insert_one(
        {
            "tenant_id": tenant_id,
            "outlet_id": outlet_id,
            "user_id": user.get("id"),
            "user_email": user.get("email"),
            "action": action,
            "entity": entity,
            "entity_id": entity_id,
            "previous": previous,
            "new": new,
            "created_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        }
    )
