from datetime import datetime, timezone

from fastapi import Depends

from database import db
from security import get_current_user
from utils import err

FEATURE_CODES = [
    "POS", "ORDERS", "REPORTS", "INVENTORY", "KITCHEN", "MULTI_OUTLET",
    "DISCOUNTS", "ADVANCED_REPORTS", "AUDIT_LOG", "OFFLINE_POS",
    "RECEIPT_PRINTING", "BARCODE",
]
LIMIT_CODES = ["OUTLET_LIMIT", "USER_LIMIT"]

ACCESSIBLE_STATUSES = {"ACTIVE", "TRIALING", "GRACE_PERIOD"}


async def get_entitlements(user=Depends(get_current_user)) -> dict:
    """Resolve Tenant -> Subscription -> Plan -> Features. Server-authoritative."""
    if user["role"] == "PLATFORM_ADMIN":
        err(403, "FORBIDDEN", "Platform admin has no tenant context")
    tenant = await db.tenants.find_one({"id": user["tenant_id"]}, {"_id": 0})
    if not tenant:
        err(403, "TENANT_NOT_FOUND", "Tenant not found")
    sub = await db.subscriptions.find_one({"tenant_id": tenant["id"]}, {"_id": 0})
    if not sub:
        err(403, "SUBSCRIPTION_REQUIRED", "No subscription for tenant")
    plan = await db.subscription_plans.find_one({"code": sub["plan_code"]}, {"_id": 0})
    if not plan:
        err(403, "SUBSCRIPTION_REQUIRED", "Subscription plan missing")
    return {"user": user, "tenant": tenant, "subscription": sub, "plan": plan}


def check_subscription_access(sub: dict):
    now = datetime.now(timezone.utc)
    status = sub["status"]
    if status == "TRIALING":
        trial_end = sub.get("trial_ends_at")
        if trial_end and trial_end < now:
            err(403, "SUBSCRIPTION_EXPIRED", "Trial has expired")
        return
    if status in ACCESSIBLE_STATUSES:
        return
    if status == "CANCELLED":
        end = sub.get("current_period_end")
        if end and end > now:
            return
        err(403, "SUBSCRIPTION_EXPIRED", "Subscription has expired")
    if status == "SUSPENDED":
        err(403, "SUBSCRIPTION_SUSPENDED", "Subscription is suspended")
    err(403, "SUBSCRIPTION_EXPIRED", f"Subscription status: {status}")


def require_feature(feature_code: str):
    async def dep(ent=Depends(get_entitlements)):
        check_subscription_access(ent["subscription"])
        feat = (ent["plan"].get("features") or {}).get(feature_code) or {}
        if not feat.get("enabled"):
            err(403, "FEATURE_NOT_AVAILABLE", f"Feature {feature_code} is not available on plan {ent['plan']['code']}")
        return ent

    return dep


async def enforce_limit(ent: dict, limit_code: str, counter_field: str, error_code: str):
    """Concurrency-safe resource limit: atomic conditional increment on tenant doc.
    NULL limit means unlimited; 0 is a real limit distinct from unlimited."""
    feat = (ent["plan"].get("features") or {}).get(limit_code) or {}
    limit = feat.get("limit")
    if limit is None:
        return
    res = await db.tenants.find_one_and_update(
        {"id": ent["tenant"]["id"], counter_field: {"$lt": limit}},
        {"$inc": {counter_field: 1}},
        return_document=True,
    )
    if not res:
        err(403, error_code, f"{limit_code} reached ({limit})")


async def release_limit(tenant_id: str, counter_field: str):
    await db.tenants.update_one({"id": tenant_id, counter_field: {"$gt": 0}}, {"$inc": {counter_field: -1}})


async def get_usage(tenant_id: str, plan: dict) -> dict:
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0, "outlets_count": 1, "users_count": 1})
    feats = plan.get("features") or {}
    return {
        "outlets": {"used": tenant.get("outlets_count", 0), "limit": (feats.get("OUTLET_LIMIT") or {}).get("limit")},
        "users": {"used": tenant.get("users_count", 0), "limit": (feats.get("USER_LIMIT") or {}).get("limit")},
    }
