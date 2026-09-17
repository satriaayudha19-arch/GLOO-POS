import logging
import os

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from database import db, client, run_with_database_retry
from seed import seed_all
from routers import auth, subscription, outlets, users, catalog, operations, shifts, orders, dashboard, platform, settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="GLOO POS API")

for r in (auth, subscription, outlets, users, catalog, operations, shifts, orders, dashboard, platform, settings):
    app.include_router(r.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "GLOO POS"}


async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index([("tenant_id", 1), ("code", 1)])
    await db.tenants.create_index("code", unique=True)
    await db.subscription_plans.create_index("code", unique=True)
    await db.subscriptions.create_index("tenant_id", unique=True)
    await db.subscription_history.create_index([("tenant_id", 1), ("created_at", -1)])
    await db.outlets.create_index([("tenant_id", 1), ("code", 1)], unique=True)
    await db.categories.create_index([("tenant_id", 1), ("sort_order", 1)])
    await db.products.create_index([("tenant_id", 1), ("category_id", 1)])
    await db.products.create_index([("tenant_id", 1), ("barcode", 1)])
    await db.orders.create_index([("tenant_id", 1), ("client_transaction_id", 1)], unique=True)
    await db.orders.create_index([("tenant_id", 1), ("transaction_number", 1)], unique=True)
    await db.orders.create_index([("tenant_id", 1), ("outlet_id", 1), ("created_at", -1)])
    await db.orders.create_index([("tenant_id", 1), ("created_at", -1)])
    await db.shifts.create_index("open_key", unique=True, sparse=True)
    await db.shifts.create_index([("tenant_id", 1), ("outlet_id", 1), ("opened_at", -1)])
    await db.journal.create_index([("tenant_id", 1), ("outlet_id", 1), ("created_at", -1)])
    await db.audit_logs.create_index([("tenant_id", 1), ("created_at", -1)])
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("locked_until", expireAfterSeconds=0)


async def initialize_database():
    await ensure_indexes()
    await seed_all()


@app.on_event("startup")
async def startup():
    await run_with_database_retry(initialize_database, "startup initialization")
    logger.info("GLOO POS backend started; indexes ensured; seed complete")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
