"""Shared logic for creating a new tenant + its owner + initial subscription.

Called from:
- routers/platform.py::create_tenant (PLATFORM_ADMIN provisioning)
- routers/auth.py::signup (public self-service signup)

Both paths must produce IDENTICAL data shape so subscription_history, features,
and auth session payloads stay consistent.
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from database import db
from security import hash_password
from utils import err, next_seq

PROJ = {"_id": 0}


async def provision_tenant(
    *,
    name: str,
    brand_name: str,
    owner_name: str,
    owner_email: str,
    owner_password: str,
    plan_code: str = "FREE",
    trial_days: int = 14,
    changed_by: str,
    source: str,
    reason: str = "Tenant created",
) -> dict:
    """Create tenant, owner user, subscription, and subscription_history atomically-ish.

    Returns dict: { tenant, subscription, user_id, plan }
    Raises HTTPException via err() on validation failures.
    """
    email = (owner_email or "").strip().lower()
    if not email:
        err(400, "INVALID_EMAIL", "Email is required")
    if await db.users.find_one({"email": email}):
        err(409, "EMAIL_EXISTS", "Owner email already registered")

    plan = await db.subscription_plans.find_one({"code": plan_code, "active": True}, PROJ)
    if not plan:
        err(400, "PLAN_NOT_FOUND", "Plan not found or inactive")

    tenant_id = str(uuid.uuid4())
    tseq = await next_seq("tenant_code")
    useq = await next_seq(f"user_code:{tenant_id}")
    now = datetime.now(timezone.utc)
    trial = trial_days > 0

    tenant_doc = {
        "id": tenant_id,
        "code": f"T{tseq:03d}",
        "name": name,
        "brand_name": brand_name or name,
        "outlets_count": 0,
        "users_count": 1,
        "active": True,
        "created_at": now,
    }
    await db.tenants.insert_one(tenant_doc)

    user_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": user_id,
        "code": f"U{useq:03d}",
        "tenant_id": tenant_id,
        "name": owner_name,
        "email": email,
        "password_hash": hash_password(owner_password),
        "role": "OWNER",
        "outlet_ids": [],
        "active": True,
        "created_at": now,
    })

    sub_id = str(uuid.uuid4())
    sub_doc = {
        "id": sub_id,
        "tenant_id": tenant_id,
        "plan_code": plan["code"],
        "status": "TRIALING" if trial else "ACTIVE",
        "started_at": now,
        "current_period_start": now,
        "current_period_end": now + timedelta(days=30),
        "trial_started_at": now if trial else None,
        "trial_ends_at": now + timedelta(days=trial_days) if trial else None,
        "cancelled_at": None,
        "suspended_at": None,
        "expired_at": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.subscriptions.insert_one(sub_doc)

    await db.subscription_history.insert_one({
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "subscription_id": sub_id,
        "old_plan_code": None,
        "new_plan_code": plan["code"],
        "old_status": None,
        "new_status": sub_doc["status"],
        "changed_by": changed_by,
        "reason": reason,
        "source": source,
        "created_at": now,
    })

    tenant = await db.tenants.find_one({"id": tenant_id}, PROJ)
    return {
        "tenant": tenant,
        "subscription": sub_doc,
        "user_id": user_id,
        "plan": plan,
    }
