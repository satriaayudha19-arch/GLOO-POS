from fastapi import APIRouter, Depends

from database import db
from entitlements import get_entitlements, get_usage, check_subscription_access
from security import require_permission

router = APIRouter(prefix="/api/subscription", tags=["subscription"])


def serialize_sub(sub: dict) -> dict:
    keys = ("id", "plan_code", "status", "started_at", "current_period_start", "current_period_end",
            "trial_started_at", "trial_ends_at", "cancelled_at", "suspended_at", "expired_at")
    return {k: sub.get(k) for k in keys}


@router.get("")
async def get_subscription(ent=Depends(get_entitlements)):
    plan = ent["plan"]
    return {
        "plan": {k: plan.get(k) for k in ("code", "name", "description", "price", "currency", "billing_interval")},
        "subscription": serialize_sub(ent["subscription"]),
        "accessible": _is_accessible(ent["subscription"]),
        "features": plan.get("features") or {},
        "usage": await get_usage(ent["tenant"]["id"], plan),
    }


def _is_accessible(sub: dict) -> bool:
    try:
        check_subscription_access(sub)
        return True
    except Exception:
        return False


@router.get("/features")
async def get_features(ent=Depends(get_entitlements)):
    return {"features": ent["plan"].get("features") or {}, "status": ent["subscription"]["status"]}


@router.get("/history")
async def get_history(user=Depends(require_permission("subscription.view"))):
    items = await db.subscription_history.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items
