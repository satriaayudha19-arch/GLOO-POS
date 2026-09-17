from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends

from database import db
from entitlements import require_feature
from permissions import has_permission
from security import assert_outlet_access
from utils import err, report_date_bounds

router = APIRouter(prefix="/api/reports", tags=["reports"])
PROJ = {"_id": 0}


def _ensure_reports_permission(user: dict):
    if not has_permission(user["role"], "reports.view"):
        err(403, "FORBIDDEN", "Reports access requires reports.view permission")


async def _report_context(ent: dict, outlet_id: str | None, date_from: date | None, date_to: date | None):
    user = ent["user"]
    _ensure_reports_permission(user)
    try:
        start_utc, end_utc = report_date_bounds(date_from, date_to)
    except ValueError as exc:
        err(400, "INVALID_DATE_RANGE", str(exc))

    match = {
        "tenant_id": ent["tenant"]["id"],
        "status": "PAID",
        "created_at": {"$gte": start_utc, "$lt": end_utc},
    }
    if outlet_id:
        await assert_outlet_access(user, outlet_id)
        match["outlet_id"] = outlet_id
    elif user["role"] not in ("OWNER", "MANAGER"):
        match["outlet_id"] = {"$in": user.get("outlet_ids") or []}
    return user, match, start_utc, end_utc


def _period_expression(group_by: str):
    formats = {"DAY": "%Y-%m-%d", "WEEK": "%G-W%V", "MONTH": "%Y-%m"}
    if group_by not in formats:
        err(400, "INVALID_GROUP_BY", "group_by must be DAY, WEEK, or MONTH")
    return {"$dateToString": {"format": formats[group_by], "date": "$created_at", "timezone": "Asia/Jakarta"}}


def _int_fields(row: dict, fields: tuple[str, ...]) -> dict:
    for field in fields:
        if field in row and row[field] is not None:
            row[field] = int(round(row[field]))
    return row


@router.get("/sales")
async def sales_report(
    outlet_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    group_by: str = "DAY",
    ent=Depends(require_feature("REPORTS")),
):
    _, match, _, _ = await _report_context(ent, outlet_id, date_from, date_to)
    group_by = group_by.upper()
    period = _period_expression(group_by)
    rows = await db.orders.aggregate([
        {"$match": match},
        {"$group": {
            "_id": period,
            "gross_sales": {"$sum": {"$ifNull": ["$subtotal", 0]}},
            "discount_total": {"$sum": {"$ifNull": ["$discount.amount", 0]}},
            "tax_total": {"$sum": {"$ifNull": ["$tax.amount", 0]}},
            "service_total": {"$sum": {"$ifNull": ["$service_charge.amount", 0]}},
            "net_sales": {"$sum": {"$ifNull": ["$grand_total", 0]}},
            "orders_count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
        {"$project": {
            "_id": 0,
            "period": "$_id",
            "gross_sales": 1,
            "discount_total": 1,
            "tax_total": 1,
            "service_total": 1,
            "net_sales": 1,
            "orders_count": 1,
            "avg_transaction": {"$cond": [
                {"$gt": ["$orders_count", 0]},
                {"$divide": ["$net_sales", "$orders_count"]},
                0,
            ]},
        }},
    ]).to_list(366)
    return [_int_fields(row, ("gross_sales", "discount_total", "tax_total", "service_total", "net_sales", "orders_count", "avg_transaction")) for row in rows]


@router.get("/products")
async def products_report(
    outlet_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = 20,
    ent=Depends(require_feature("REPORTS")),
):
    _, match, _, _ = await _report_context(ent, outlet_id, date_from, date_to)
    limit = max(1, min(limit, 100))
    rows = await db.orders.aggregate([
        {"$match": match},
        {"$unwind": "$items"},
        {"$group": {
            "_id": {"product_id": "$items.product_id", "name": "$items.name"},
            "qty_sold": {"$sum": "$items.qty"},
            "revenue": {"$sum": "$items.line_total"},
        }},
        {"$sort": {"revenue": -1, "_id.name": 1}},
        {"$limit": limit},
        {"$project": {"_id": 0, "product_id": "$_id.product_id", "name": "$_id.name", "qty_sold": 1, "revenue": 1}},
    ]).to_list(limit)
    return [_int_fields(row, ("qty_sold", "revenue")) for row in rows]


@router.get("/payments")
async def payments_report(
    outlet_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    ent=Depends(require_feature("REPORTS")),
):
    _, match, _, _ = await _report_context(ent, outlet_id, date_from, date_to)
    rows = await db.orders.aggregate([
        {"$match": match},
        {"$group": {
            "_id": {"method_type": "$payment.method_type", "method_name": "$payment.method_name"},
            "total": {"$sum": "$grand_total"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"total": -1, "_id.method_name": 1}},
        {"$project": {
            "_id": 0,
            "method_type": "$_id.method_type",
            "method_name": "$_id.method_name",
            "total": 1,
            "count": 1,
        }},
    ]).to_list(50)
    return [_int_fields(row, ("total", "count")) for row in rows]


@router.get("/discounts")
async def discounts_report(
    outlet_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    ent=Depends(require_feature("DISCOUNTS")),
):
    _, match, _, _ = await _report_context(ent, outlet_id, date_from, date_to)
    match["discount.amount"] = {"$gt": 0}
    rows = await db.orders.aggregate([
        {"$match": match},
        {"$group": {
            "_id": {"discount_id": "$discount.id", "name": "$discount.label"},
            "uses": {"$sum": 1},
            "total_discount": {"$sum": "$discount.amount"},
        }},
        {"$sort": {"total_discount": -1, "_id.name": 1}},
        {"$project": {
            "_id": 0,
            "discount_id": "$_id.discount_id",
            "name": "$_id.name",
            "uses": 1,
            "total_discount": 1,
        }},
    ]).to_list(100)
    return [_int_fields(row, ("uses", "total_discount")) for row in rows]


@router.get("/shifts")
async def shifts_report(
    outlet_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    ent=Depends(require_feature("REPORTS")),
):
    user = ent["user"]
    _ensure_reports_permission(user)
    if not (has_permission(user["role"], "shifts.manage") or user["role"] == "OWNER"):
        err(403, "FORBIDDEN", "Shift reports require shifts.manage permission")
    try:
        start_utc, end_utc = report_date_bounds(date_from, date_to)
    except ValueError as exc:
        err(400, "INVALID_DATE_RANGE", str(exc))
    match = {"tenant_id": ent["tenant"]["id"], "opened_at": {"$gte": start_utc, "$lt": end_utc}}
    if outlet_id:
        await assert_outlet_access(user, outlet_id)
        match["outlet_id"] = outlet_id
    elif user["role"] not in ("OWNER", "MANAGER"):
        match["outlet_id"] = {"$in": user.get("outlet_ids") or []}

    rows = await db.shifts.aggregate([
        {"$match": match},
        {"$lookup": {
            "from": "orders",
            "let": {"shift_id": "$id", "tenant_id": "$tenant_id"},
            "pipeline": [
                {"$match": {"$expr": {"$and": [
                    {"$eq": ["$shift_id", "$$shift_id"]},
                    {"$eq": ["$tenant_id", "$$tenant_id"]},
                    {"$eq": ["$status", "PAID"]},
                ]}}},
                {"$group": {
                    "_id": {"method_type": "$payment.method_type", "method_name": "$payment.method_name"},
                    "total": {"$sum": "$grand_total"},
                    "count": {"$sum": 1},
                }},
                {"$project": {
                    "_id": 0, "method_type": "$_id.method_type", "method_name": "$_id.method_name",
                    "total": 1, "count": 1,
                }},
                {"$sort": {"total": -1}},
            ],
            "as": "payment_breakdown",
        }},
        {"$sort": {"opened_at": -1}},
        {"$project": {
            "_id": 0,
            "id": 1,
            "outlet_id": 1,
            "opened_at": 1,
            "closed_at": 1,
            "opening_cash": 1,
            "cash_sales": 1,
            "total_sales": 1,
            "expected_cash": 1,
            "actual_cash": 1,
            "variance": 1,
            "cash_in": 1,
            "cash_out": 1,
            "orders_count": 1,
            "status": 1,
            "opened_by": {"id": "$user_id", "name": "$cashier_name", "code": "$cashier_code"},
            "closed_by": {"id": "$closed_by_id", "name": "$closed_by_name", "code": "$closed_by_code"},
            "payment_breakdown": 1,
        }},
    ]).to_list(300)
    for row in rows:
        _int_fields(row, ("opening_cash", "cash_sales", "total_sales", "expected_cash", "actual_cash", "variance", "cash_in", "cash_out", "orders_count"))
        for payment in row.get("payment_breakdown", []):
            _int_fields(payment, ("total", "count"))
    return rows


async def _period_summary(match: dict):
    rows = await db.orders.aggregate([
        {"$match": match},
        {"$group": {"_id": None, "sales": {"$sum": "$grand_total"}, "orders": {"$sum": 1}}},
        {"$project": {"_id": 0, "sales": 1, "orders": 1}},
    ]).to_list(1)
    row = rows[0] if rows else {"sales": 0, "orders": 0}
    row["sales"] = int(row.get("sales", 0))
    row["orders"] = int(row.get("orders", 0))
    return row


@router.get("/advanced-summary")
async def advanced_summary(
    outlet_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    ent=Depends(require_feature("ADVANCED_REPORTS")),
):
    user, current_match, start_utc, end_utc = await _report_context(ent, outlet_id, date_from, date_to)
    duration = end_utc - start_utc
    previous_start = start_utc - duration
    previous_match = {**current_match, "created_at": {"$gte": previous_start, "$lt": start_utc}}
    current = await _period_summary(current_match)
    previous = await _period_summary(previous_match)
    previous_sales = previous["sales"]
    growth_pct = ((current["sales"] - previous_sales) / previous_sales * 100) if previous_sales else (100 if current["sales"] else 0)

    outlets = await db.orders.aggregate([
        {"$match": current_match},
        {"$group": {"_id": "$outlet_id", "outlet_name": {"$first": "$outlet.name"}, "sales": {"$sum": "$grand_total"}, "orders": {"$sum": 1}}},
        {"$sort": {"sales": -1}},
        {"$project": {"_id": 0, "outlet_id": "$_id", "outlet_name": 1, "sales": 1, "orders": 1}},
    ]).to_list(100)
    for row in outlets:
        _int_fields(row, ("sales", "orders"))

    peak_hours = await db.orders.aggregate([
        {"$match": current_match},
        {"$group": {
            "_id": {"$hour": {"date": "$created_at", "timezone": "Asia/Jakarta"}},
            "sales": {"$sum": "$grand_total"},
            "orders": {"$sum": 1},
        }},
        {"$sort": {"orders": -1, "sales": -1}},
        {"$project": {"_id": 0, "hour": "$_id", "sales": 1, "orders": 1}},
    ]).to_list(24)
    for row in peak_hours:
        _int_fields(row, ("sales", "orders"))

    return {
        "current": current,
        "previous": previous,
        "growth_pct": round(growth_pct, 2),
        "outlets": outlets,
        "peak_hours": peak_hours,
        "period": {"from": start_utc.isoformat(), "to": end_utc.isoformat()},
    }
