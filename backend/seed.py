import os
import uuid
from datetime import datetime, timezone, timedelta

from database import db
from security import hash_password

OWNER_PASSWORD = "GlooPOS2026!"
DEMO_PASSWORD = "GlooDemo2026!"


def now():
    return datetime.now(timezone.utc)


def plan_features(**over):
    base = {
        "POS": True, "ORDERS": True, "REPORTS": True, "INVENTORY": False, "KITCHEN": False,
        "MULTI_OUTLET": False, "DISCOUNTS": False, "ADVANCED_REPORTS": False, "AUDIT_LOG": False,
        "OFFLINE_POS": True, "RECEIPT_PRINTING": True, "BARCODE": False,
    }
    base.update(over)
    return base


PLANS = [
    {"code": "FREE", "name": "Free", "description": "Starter POS for a single outlet", "price": 0, "currency": "IDR",
     "billing_interval": "MONTHLY", "active": True, "sort_order": 1,
     "features": {**{k: {"enabled": v, "limit": None} for k, v in plan_features().items()},
                  "OUTLET_LIMIT": {"enabled": True, "limit": 1}, "USER_LIMIT": {"enabled": True, "limit": 2}}},
    {"code": "BASIC", "name": "Basic", "description": "Growing F&B business", "price": 149000, "currency": "IDR",
     "billing_interval": "MONTHLY", "active": True, "sort_order": 2,
     "features": {**{k: {"enabled": v, "limit": None} for k, v in plan_features(INVENTORY=True, KITCHEN=True, MULTI_OUTLET=True, DISCOUNTS=True, BARCODE=True, AUDIT_LOG=True).items()},
                  "OUTLET_LIMIT": {"enabled": True, "limit": 3}, "USER_LIMIT": {"enabled": True, "limit": 10}}},
    {"code": "PRO", "name": "Pro", "description": "Multi-outlet professional operations", "price": 399000, "currency": "IDR",
     "billing_interval": "MONTHLY", "active": True, "sort_order": 3,
     "features": {**{k: {"enabled": v, "limit": None} for k, v in plan_features(INVENTORY=True, KITCHEN=True, MULTI_OUTLET=True, DISCOUNTS=True, ADVANCED_REPORTS=True, AUDIT_LOG=True, BARCODE=True).items()},
                  "OUTLET_LIMIT": {"enabled": True, "limit": 10}, "USER_LIMIT": {"enabled": True, "limit": 50}}},
    {"code": "ENTERPRISE", "name": "Enterprise", "description": "Unlimited scale for chains", "price": 999000, "currency": "IDR",
     "billing_interval": "MONTHLY", "active": True, "sort_order": 4,
     "features": {**{k: {"enabled": True, "limit": None} for k in plan_features().keys()},
                  "OUTLET_LIMIT": {"enabled": True, "limit": None}, "USER_LIMIT": {"enabled": True, "limit": None}}},
]


async def seed_plans():
    for p in PLANS:
        existing = await db.subscription_plans.find_one({"code": p["code"]})
        doc = {**p, "updated_at": now()}
        if existing:
            await db.subscription_plans.update_one({"code": p["code"]}, {"$set": doc})
        else:
            await db.subscription_plans.insert_one({**doc, "id": str(uuid.uuid4()), "created_at": now()})


async def seed_platform_admin():
    email = os.environ.get("PLATFORM_ADMIN_EMAIL", "platform@gloo.pos")
    password = os.environ.get("PLATFORM_ADMIN_PASSWORD", "GlooPlatform2026!")
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "code": "P001", "tenant_id": None, "name": "Platform Admin",
            "email": email, "password_hash": hash_password(password), "role": "PLATFORM_ADMIN",
            "outlet_ids": [], "active": True, "created_at": now(),
        })
    elif not existing.get("active", True) or existing.get("role") != "PLATFORM_ADMIN":
        await db.users.update_one({"email": email}, {"$set": {"role": "PLATFORM_ADMIN", "active": True}})


async def seed_demo_tenant():
    if await db.tenants.find_one({"code": "T001"}):
        return
    tenant_id = str(uuid.uuid4())
    await db.tenants.insert_one({
        "id": tenant_id, "code": "T001", "name": "GLOO Demo", "brand_name": "GLOO Coffee",
        "outlets_count": 2, "users_count": 4, "active": True, "created_at": now(),
    })
    period_start = now()
    await db.subscriptions.insert_one({
        "id": str(uuid.uuid4()), "tenant_id": tenant_id, "plan_code": "PRO", "status": "ACTIVE",
        "started_at": period_start, "current_period_start": period_start,
        "current_period_end": period_start + timedelta(days=30),
        "trial_started_at": None, "trial_ends_at": None,
        "cancelled_at": None, "suspended_at": None, "expired_at": None,
        "created_at": now(), "updated_at": now(),
    })
    out_jkt, out_bdg = str(uuid.uuid4()), str(uuid.uuid4())
    await db.outlets.insert_many([
        {"id": out_jkt, "tenant_id": tenant_id, "code": "O01", "name": "Outlet Jakarta",
         "address": "Jl. Sudirman No. 12, Jakarta", "phone": "021-555-0101", "email": "jakarta@gloo.demo",
         "active": True, "created_at": now()},
        {"id": out_bdg, "tenant_id": tenant_id, "code": "O02", "name": "Outlet Bandung",
         "address": "Jl. Braga No. 45, Bandung", "phone": "022-555-0202", "email": "bandung@gloo.demo",
         "active": True, "created_at": now()},
    ])
    users = [
        ("U001", "Satria Ayudha", "satriaayudha19@gmail.com", "OWNER", OWNER_PASSWORD, [out_jkt, out_bdg]),
        ("U002", "Demo Manager", "manager@gloo.demo", "MANAGER", DEMO_PASSWORD, [out_jkt, out_bdg]),
        ("U003", "Demo Cashier", "cashier@gloo.demo", "CASHIER", DEMO_PASSWORD, [out_jkt]),
        ("U004", "Demo Kitchen", "kitchen@gloo.demo", "KITCHEN", DEMO_PASSWORD, [out_jkt]),
    ]
    await db.users.insert_many([
        {"id": str(uuid.uuid4()), "code": code, "tenant_id": tenant_id, "name": name, "email": email,
         "password_hash": hash_password(pw), "role": role, "outlet_ids": outlets, "active": True, "created_at": now()}
        for code, name, email, role, pw, outlets in users
    ])

    cats = {}
    for i, name in enumerate(["Coffee", "Tea", "Food", "Snack"]):
        cid = str(uuid.uuid4())
        cats[name] = cid
        await db.categories.insert_one({"id": cid, "tenant_id": tenant_id, "name": name, "sort_order": i + 1, "active": True, "created_at": now()})

    vg_size = str(uuid.uuid4())
    vg_temp = str(uuid.uuid4())
    await db.variant_groups.insert_many([
        {"id": vg_size, "tenant_id": tenant_id, "name": "Size", "required": True, "active": True,
         "options": [{"id": str(uuid.uuid4()), "name": "Regular", "price_delta": 0},
                     {"id": str(uuid.uuid4()), "name": "Large", "price_delta": 5000}], "created_at": now()},
        {"id": vg_temp, "tenant_id": tenant_id, "name": "Temperature", "required": False, "active": True,
         "options": [{"id": str(uuid.uuid4()), "name": "Hot", "price_delta": 0},
                     {"id": str(uuid.uuid4()), "name": "Iced", "price_delta": 2000}], "created_at": now()},
    ])
    mg_sugar = str(uuid.uuid4())
    mg_shot = str(uuid.uuid4())
    await db.modifier_groups.insert_many([
        {"id": mg_sugar, "tenant_id": tenant_id, "name": "Sugar", "multi": False, "active": True,
         "options": [{"id": str(uuid.uuid4()), "name": "Normal", "price": 0},
                     {"id": str(uuid.uuid4()), "name": "Less", "price": 0},
                     {"id": str(uuid.uuid4()), "name": "No Sugar", "price": 0},
                     {"id": str(uuid.uuid4()), "name": "Extra", "price": 2000}], "created_at": now()},
        {"id": mg_shot, "tenant_id": tenant_id, "name": "Extras", "multi": True, "active": True,
         "options": [{"id": str(uuid.uuid4()), "name": "Extra Shot", "price": 6000},
                     {"id": str(uuid.uuid4()), "name": "Extra Ice", "price": 0},
                     {"id": str(uuid.uuid4()), "name": "Whipped Cream", "price": 5000}], "created_at": now()},
    ])

    products = [
        ("Americano", "CF-001", "SKU-AMR", "8901001", cats["Coffee"], 25000, [vg_size, vg_temp], [mg_sugar, mg_shot]),
        ("Latte", "CF-002", "SKU-LTE", "8901002", cats["Coffee"], 32000, [vg_size, vg_temp], [mg_sugar, mg_shot]),
        ("Cappuccino", "CF-003", "SKU-CAP", "8901003", cats["Coffee"], 30000, [vg_size, vg_temp], [mg_sugar, mg_shot]),
        ("Iced Tea", "TE-001", "SKU-ITE", "8901004", cats["Tea"], 15000, [vg_size], [mg_sugar]),
        ("French Fries", "SN-001", "SKU-FFR", "8901005", cats["Snack"], 20000, [], []),
    ]
    await db.products.insert_many([
        {"id": str(uuid.uuid4()), "tenant_id": tenant_id, "name": name, "code": code, "sku": sku, "barcode": barcode,
         "description": "", "category_id": cat, "base_price": price, "image_url": "",
         "variant_group_ids": vgs, "modifier_group_ids": mgs, "active": True, "created_at": now()}
        for name, code, sku, barcode, cat, price, vgs, mgs in products
    ])

    await db.payment_methods.insert_many([
        {"id": str(uuid.uuid4()), "tenant_id": tenant_id, "name": n, "type": t, "active": True, "sort_order": i + 1, "created_at": now()}
        for i, (n, t) in enumerate([("Cash", "CASH"), ("QRIS", "QRIS"), ("Bank Transfer", "BANK_TRANSFER"),
                                    ("Debit Card", "DEBIT"), ("Credit Card", "CREDIT_CARD"), ("E-Wallet", "EWALLET")])
    ])
    await db.taxes.insert_one({"id": str(uuid.uuid4()), "tenant_id": tenant_id, "name": "PB1", "percent": 10, "inclusive": False, "active": True, "created_at": now()})
    await db.service_charges.insert_one({"id": str(uuid.uuid4()), "tenant_id": tenant_id, "name": "Service", "percent": 5, "active": True, "created_at": now()})
    await db.discounts.insert_many([
        {"id": str(uuid.uuid4()), "tenant_id": tenant_id, "name": "Member 10%", "type": "PERCENTAGE", "value": 10,
         "min_purchase": 0, "max_discount": 50000, "active": True, "starts_at": None, "ends_at": None, "created_at": now()},
        {"id": str(uuid.uuid4()), "tenant_id": tenant_id, "name": "Promo 5K", "type": "FIXED", "value": 5000,
         "min_purchase": 50000, "max_discount": None, "active": True, "starts_at": None, "ends_at": None, "created_at": now()},
    ])
    await db.tenant_settings.insert_one({
        "id": str(uuid.uuid4()), "tenant_id": tenant_id,
        "receipt_footer": "Terima kasih! Powered by GLOO POS", "receipt_header": "",
        "created_at": now(),
    })
    # keep tenant code counter above the seeded code
    await db.counters.update_one({"_id": "tenant_code"}, {"$max": {"seq": 1}}, upsert=True)


async def seed_all():
    await seed_plans()
    await seed_platform_admin()
    await seed_demo_tenant()
