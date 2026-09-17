from fastapi import APIRouter, Depends

from database import db
from permissions import has_permission
from security import assert_outlet_access, get_current_user
from utils import err, today_start_utc

router = APIRouter(prefix="/api", tags=["dashboard"])
PROJ = {"_id": 0}


@router.get("/dashboard")
async def dashboard(outlet_id: str | None = None, user=Depends(get_current_user)):
    if not has_permission(user["role"], "dashboard.view"):
        err(403, "FORBIDDEN", "Insufficient role permission")
    tid = user["tenant_id"]
    match = {"tenant_id": tid, "status": "PAID"}
    if outlet_id:
        await assert_outlet_access(user, outlet_id)
        match["outlet_id"] = outlet_id
    elif user["role"] not in ("OWNER", "MANAGER"):
        match["outlet_id"] = {"$in": user.get("outlet_ids") or []}

    day_start = today_start_utc()
    today_match = {**match, "created_at": {"$gte": day_start}}

    today = (await db.orders.aggregate([
        {"$match": today_match},
        {"$group": {"_id": None, "sales": {"$sum": "$grand_total"}, "orders": {"$sum": 1}}},
    ]).to_list(1))
    today_stats = today[0] if today else {"sales": 0, "orders": 0}

    by_payment = await db.orders.aggregate([
        {"$match": today_match},
        {"$group": {"_id": "$payment.method_name", "total": {"$sum": "$grand_total"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}},
    ]).to_list(20)

    top_products = await db.orders.aggregate([
        {"$match": today_match},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.name", "qty": {"$sum": "$items.qty"}, "revenue": {"$sum": "$items.line_total"}}},
        {"$sort": {"qty": -1}},
        {"$limit": 5},
    ]).to_list(5)

    recent = await db.orders.find(match, PROJ).sort("created_at", -1).limit(8).to_list(8)

    open_shifts = await db.shifts.count_documents({"tenant_id": tid, "status": "OPEN"})

    sales = today_stats.get("sales", 0)
    orders_count = today_stats.get("orders", 0)
    return {
        "today": {
            "sales": sales,
            "orders": orders_count,
            "avg_transaction": int(sales / orders_count) if orders_count else 0,
        },
        "payment_summary": [{"method": p["_id"], "total": p["total"], "count": p["count"]} for p in by_payment],
        "top_products": [{"name": p["_id"], "qty": p["qty"], "revenue": p["revenue"]} for p in top_products],
        "recent_orders": recent,
        "open_shifts": open_shifts,
    }
