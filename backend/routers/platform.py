import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr

from database import db
from security import require_permission, hash_password
from utils import err, next_seq, log_audit

router = APIRouter(prefix="/api/platform", tags=["platform"])
PROJ = {"_id": 0}

platform_admin = require_permission("platform.admin")


@router.get("/overview")
async def overview(user=Depends(platform_admin)):
    return {
        "tenants": await db.tenants.count_documents({}),
        "users": await db.users.count_documents({"role": {"$ne": "PLATFORM_ADMIN"}}),
        "orders": await db.orders.count_documents({}),
        "plans": await db.subscription_plans.count_documents({}),
    }


@router.get("/tenants")
async def list_tenants(user=Depends(platform_admin)):
    tenants = await db.tenants.find({}, PROJ).sort("created_at", -1).to_list(500)
    subs = {s["tenant_id"]: s for s in await db.subscriptions.find({}, PROJ).to_list(500)}
    out = []
    for t in tenants:
        s = subs.get(t["id"]) or {}
        out.append({**t, "subscription": {"plan_code": s.get("plan_code"), "status": s.get("status"),
                                          "current_period_end": s.get("current_period_end")}})
    return out


class TenantCreate(BaseModel):
    name: str
    brand_name: str = ""
    owner_name: str
    owner_email: EmailStr
    owner_password: str
    plan_code: str = "FREE"
    trial_days: int = 14


@router.post("/tenants")
async def create_tenant(body: TenantCreate, user=Depends(platform_admin)):
    email = body.owner_email.lower()
    if await db.users.find_one({"email": email}):
        err(409, "EMAIL_EXISTS", "Owner email already registered")
    plan = await db.subscription_plans.find_one({"code": body.plan_code, "active": True}, PROJ)
    if not plan:
        err(400, "PLAN_NOT_FOUND", "Plan not found or inactive")
    tenant_id = str(uuid.uuid4())
    tseq = await next_seq("tenant_code")
    useq = await next_seq(f"user_code:{tenant_id}")
    now = datetime.now(timezone.utc)
    trial = body.trial_days > 0
    await db.tenants.insert_one({
        "id": tenant_id, "code": f"T{tseq:03d}", "name": body.name,
        "brand_name": body.brand_name or body.name, "outlets_count": 0, "users_count": 1,
        "active": True, "created_at": now,
    })
    await db.users.insert_one({
        "id": str(uuid.uuid4()), "code": f"U{useq:03d}", "tenant_id": tenant_id, "name": body.owner_name,
        "email": email, "password_hash": hash_password(body.owner_password), "role": "OWNER",
        "outlet_ids": [], "active": True, "created_at": now,
    })
    sub = {
        "id": str(uuid.uuid4()), "tenant_id": tenant_id, "plan_code": plan["code"],
        "status": "TRIALING" if trial else "ACTIVE",
        "started_at": now, "current_period_start": now,
        "current_period_end": now + timedelta(days=30),
        "trial_started_at": now if trial else None,
        "trial_ends_at": now + timedelta(days=body.trial_days) if trial else None,
        "cancelled_at": None, "suspended_at": None, "expired_at": None,
        "created_at": now, "updated_at": now,
    }
    await db.subscriptions.insert_one(sub)
    await db.subscription_history.insert_one({
        "id": str(uuid.uuid4()), "tenant_id": tenant_id, "subscription_id": sub["id"],
        "old_plan_code": None, "new_plan_code": plan["code"], "old_status": None, "new_status": sub["status"],
        "changed_by": user["email"], "reason": "Tenant created", "source": "PLATFORM_ADMIN", "created_at": now,
    })
    tenant = await db.tenants.find_one({"id": tenant_id}, PROJ)
    return {**tenant, "subscription": {"plan_code": sub["plan_code"], "status": sub["status"]}}


class SubscriptionChange(BaseModel):
    plan_code: str | None = None
    status: str | None = None
    reason: str = ""


VALID_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "GRACE_PERIOD", "SUSPENDED", "CANCELLED", "EXPIRED"]


@router.patch("/tenants/{tenant_id}/subscription")
async def change_subscription(tenant_id: str, body: SubscriptionChange, user=Depends(platform_admin)):
    sub = await db.subscriptions.find_one({"tenant_id": tenant_id}, PROJ)
    if not sub:
        err(404, "SUBSCRIPTION_REQUIRED", "Subscription not found")
    update = {"updated_at": datetime.now(timezone.utc)}
    if body.plan_code:
        if not await db.subscription_plans.find_one({"code": body.plan_code}):
            err(400, "PLAN_NOT_FOUND", "Plan not found")
        update["plan_code"] = body.plan_code
    if body.status:
        if body.status not in VALID_STATUSES:
            err(400, "INVALID_REQUEST", f"status must be one of {VALID_STATUSES}")
        update["status"] = body.status
        now = datetime.now(timezone.utc)
        if body.status == "SUSPENDED":
            update["suspended_at"] = now
        elif body.status == "CANCELLED":
            update["cancelled_at"] = now
        elif body.status == "EXPIRED":
            update["expired_at"] = now
        elif body.status == "ACTIVE":
            update["suspended_at"] = None
            update["expired_at"] = None
    res = await db.subscriptions.find_one_and_update({"tenant_id": tenant_id}, {"$set": update},
                                                     return_document=True, projection=PROJ)
    await db.subscription_history.insert_one({
        "id": str(uuid.uuid4()), "tenant_id": tenant_id, "subscription_id": sub["id"],
        "old_plan_code": sub["plan_code"], "new_plan_code": res["plan_code"],
        "old_status": sub["status"], "new_status": res["status"],
        "changed_by": user["email"], "reason": body.reason, "source": "PLATFORM_ADMIN",
        "created_at": datetime.now(timezone.utc),
    })
    await log_audit(tenant_id, None, user, "SUBSCRIPTION_CHANGE", "subscription", sub["id"],
                    {"plan": sub["plan_code"], "status": sub["status"]},
                    {"plan": res["plan_code"], "status": res["status"]})
    return res


@router.get("/plans")
async def list_plans(user=Depends(platform_admin)):
    return await db.subscription_plans.find({}, PROJ).sort("sort_order", 1).to_list(50)


class PlanUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: int | None = None
    currency: str | None = None
    billing_interval: str | None = None
    active: bool | None = None
    sort_order: int | None = None
    features: dict | None = None


@router.patch("/plans/{code}")
async def update_plan(code: str, body: PlanUpdate, user=Depends(platform_admin)):
    plan = await db.subscription_plans.find_one({"code": code}, PROJ)
    if not plan:
        err(404, "PLAN_NOT_FOUND", "Plan not found")
    update = {"updated_at": datetime.now(timezone.utc)}
    for k in ("name", "description", "price", "currency", "billing_interval", "active", "sort_order"):
        v = getattr(body, k)
        if v is not None:
            update[k] = v
    if body.features is not None:
        update["features"] = body.features
    res = await db.subscription_plans.find_one_and_update({"code": code}, {"$set": update},
                                                          return_document=True, projection=PROJ)
    await log_audit(None, None, user, "PLAN_UPDATE", "subscription_plan", code, None,
                    {k: v for k, v in update.items() if k != "updated_at"})
    return res


@router.get("/subscription-history")
async def subscription_history(tenant_id: str | None = None, user=Depends(platform_admin)):
    q = {"tenant_id": tenant_id} if tenant_id else {}
    return await db.subscription_history.find(q, PROJ).sort("created_at", -1).to_list(300)


@router.get("/audit-logs")
async def platform_audit_logs(user=Depends(platform_admin)):
    return await db.audit_logs.find({}, PROJ).sort("created_at", -1).limit(300).to_list(300)
