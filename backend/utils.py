from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from pymongo import ReturnDocument
from database import db

WIB = ZoneInfo("Asia/Jakarta")


def now_utc() -> datetime:
    """Return an aware UTC timestamp for persistence and database comparisons."""
    return datetime.now(timezone.utc)


def now_local() -> datetime:
    """Return the current business-local time for the WIB tenant default."""
    return datetime.now(WIB)


def today_start_utc(at: datetime | None = None) -> datetime:
    """Return today's WIB midnight converted to UTC for MongoDB date queries."""
    local_now = (at or now_local()).astimezone(WIB)
    local_start = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    return local_start.astimezone(timezone.utc)


def transaction_seq_key(tenant_id: str, outlet_id: str, at: datetime | None = None) -> str:
    """Build the daily transaction counter key using the WIB business date."""
    business_date = (at or now_local()).astimezone(WIB).strftime("%Y%m%d")
    return f"txnseq:{tenant_id}:{outlet_id}:{business_date}"


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
            "created_at": now_utc(),
        }
    )
