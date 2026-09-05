import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from pymongo.errors import DuplicateKeyError

from database import db
from entitlements import require_feature
from permissions import has_permission
from security import assert_outlet_access, get_current_user
from utils import err, next_seq, pct_of, log_audit
from routers.shifts import add_journal

router = APIRouter(prefix="/api/orders", tags=["orders"])
PROJ = {"_id": 0}


class OrderItemIn(BaseModel):
    product_id: str
    variant_option_ids: list[str] = []
    modifier_option_ids: list[str] = []
    qty: int = 1
    notes: str = ""


class ManualDiscount(BaseModel):
    type: str  # PERCENTAGE | FIXED
    value: int


class PaymentIn(BaseModel):
    method_id: str
    amount_paid: int


class OrderCreate(BaseModel):
    outlet_id: str
    shift_id: str
    client_transaction_id: str
    items: list[OrderItemIn]
    discount_id: str | None = None
    manual_discount: ManualDiscount | None = None
    payment: PaymentIn


def txn_number(tenant_code, outlet_code, user_code, seq, now):
    return f"{tenant_code}-{outlet_code}-{user_code}-{now:%Y%m%d}-{now:%H%M%S}-{seq:06d}"


@router.post("")
async def create_order(body: OrderCreate, ent=Depends(require_feature("ORDERS"))):
    user = ent["user"]
    if not has_permission(user["role"], "pos.use"):
        err(403, "FORBIDDEN", "Insufficient role permission")
    tenant = ent["tenant"]
    tid = tenant["id"]

    existing = await db.orders.find_one({"tenant_id": tid, "client_transaction_id": body.client_transaction_id}, PROJ)
    if existing:
        return {**existing, "duplicate": True}

    outlet = await assert_outlet_access(user, body.outlet_id)
    shift = await db.shifts.find_one({"id": body.shift_id, "tenant_id": tid, "status": "OPEN"}, PROJ)
    if not shift:
        err(409, "SHIFT_NOT_OPEN", "Shift is not open")
    if shift["outlet_id"] != body.outlet_id:
        err(400, "INVALID_REQUEST", "Shift belongs to a different outlet")

    if not body.items:
        err(400, "INVALID_REQUEST", "Cart is empty")

    vgroups = {g["id"]: g for g in await db.variant_groups.find({"tenant_id": tid}, PROJ).to_list(200)}
    mgroups = {g["id"]: g for g in await db.modifier_groups.find({"tenant_id": tid}, PROJ).to_list(200)}
    vopts = {o["id"]: (g["name"], o) for g in vgroups.values() for o in g.get("options", [])}
    mopts = {o["id"]: (g["name"], o) for g in mgroups.values() for o in g.get("options", [])}

    items_snap = []
    subtotal = 0
    for line in body.items:
        if line.qty <= 0:
            err(400, "INVALID_REQUEST", "Quantity must be positive")
        product = await db.products.find_one({"id": line.product_id, "tenant_id": tid, "active": True}, PROJ)
        if not product:
            err(404, "PRODUCT_NOT_FOUND", "Product not found or inactive")
        unit = product["base_price"]
        variant_labels = []
        for oid in line.variant_option_ids:
            if oid not in vopts:
                err(400, "INVALID_VARIANT", "Invalid variant option")
            gname, opt = vopts[oid]
            # option must belong to a group attached to this product
            attached = any(oid in [o["id"] for o in (vgroups.get(gid) or {}).get("options", [])]
                           for gid in product.get("variant_group_ids", []))
            if not attached:
                err(400, "INVALID_VARIANT", "Variant not available for this product")
            unit += opt.get("price_delta", 0)
            variant_labels.append(opt["name"])
        for gid in product.get("variant_group_ids", []):
            g = vgroups.get(gid)
            if g and g.get("required"):
                if not any(o["id"] in line.variant_option_ids for o in g.get("options", [])):
                    err(400, "INVALID_VARIANT", f"Variant '{g['name']}' is required for {product['name']}")
        mods = []
        for oid in line.modifier_option_ids:
            if oid not in mopts:
                err(400, "INVALID_MODIFIER", "Invalid modifier option")
            gname, opt = mopts[oid]
            attached = any(oid in [o["id"] for o in (mgroups.get(gid) or {}).get("options", [])]
                           for gid in product.get("modifier_group_ids", []))
            if not attached:
                err(400, "INVALID_MODIFIER", "Modifier not available for this product")
            unit += opt.get("price", 0)
            mods.append({"name": opt["name"], "price": opt.get("price", 0)})
        line_total = unit * line.qty
        subtotal += line_total
        items_snap.append({
            "product_id": product["id"], "name": product["name"],
            "variants": variant_labels, "modifiers": mods,
            "qty": line.qty, "unit_price": unit, "line_total": line_total, "notes": line.notes,
        })

    # Discount (server-authoritative)
    discount_amount = 0
    discount_label = None
    if body.discount_id or body.manual_discount:
        feat = (ent["plan"].get("features") or {}).get("DISCOUNTS") or {}
        if not feat.get("enabled"):
            err(403, "FEATURE_NOT_AVAILABLE", "Discounts not available on current plan")
        if body.manual_discount is not None:
            if not has_permission(user["role"], "discounts.manual"):
                err(403, "FORBIDDEN", "Manual discount requires permission")
            md = body.manual_discount
            if md.type == "PERCENTAGE":
                if not (0 < md.value <= 100):
                    err(400, "INVALID_REQUEST", "Invalid discount percentage")
                discount_amount = pct_of(subtotal, md.value)
            elif md.type == "FIXED":
                discount_amount = min(md.value, subtotal)
            else:
                err(400, "INVALID_REQUEST", "Invalid discount type")
            discount_label = "Manual Discount"
        else:
            d = await db.discounts.find_one({"id": body.discount_id, "tenant_id": tid, "active": True}, PROJ)
            if not d:
                err(404, "DISCOUNT_NOT_FOUND", "Discount not found or inactive")
            now = datetime.now(timezone.utc)
            if (d.get("starts_at") and d["starts_at"] > now) or (d.get("ends_at") and d["ends_at"] < now):
                err(400, "INVALID_REQUEST", "Discount is not currently valid")
            if subtotal < (d.get("min_purchase") or 0):
                err(400, "INVALID_REQUEST", "Minimum purchase not met for discount")
            if d["type"] == "PERCENTAGE":
                discount_amount = pct_of(subtotal, d["value"])
            else:
                discount_amount = min(d["value"], subtotal)
            if d.get("max_discount") is not None:
                discount_amount = min(discount_amount, d["max_discount"])
            discount_label = d["name"]

    taxable = max(subtotal - discount_amount, 0)

    tax_doc = await db.taxes.find_one({"tenant_id": tid, "active": True}, PROJ)
    tax_amount = 0
    tax_snap = None
    if tax_doc:
        if tax_doc.get("inclusive"):
            # extract tax: tax = total * p/(100+p)
            pct = tax_doc["percent"]
            tax_amount = int(taxable - (taxable * 100 / (100 + pct))) if pct else 0
        else:
            tax_amount = pct_of(taxable, tax_doc["percent"])
        tax_snap = {"name": tax_doc["name"], "percent": tax_doc["percent"],
                    "inclusive": tax_doc.get("inclusive", False), "amount": tax_amount}

    svc_doc = await db.service_charges.find_one({"tenant_id": tid, "active": True}, PROJ)
    svc_amount = 0
    svc_snap = None
    if svc_doc:
        svc_amount = pct_of(taxable, svc_doc["percent"])
        svc_snap = {"name": svc_doc["name"], "percent": svc_doc["percent"], "amount": svc_amount}

    grand_total = taxable + (0 if (tax_snap and tax_snap["inclusive"]) else tax_amount) + svc_amount

    method = await db.payment_methods.find_one({"id": body.payment.method_id, "tenant_id": tid, "active": True}, PROJ)
    if not method:
        err(404, "PAYMENT_METHOD_NOT_FOUND", "Payment method not found")
    amount_paid = body.payment.amount_paid
    if method["type"] == "CASH":
        if amount_paid < grand_total:
            err(400, "PAYMENT_FAILED", "Insufficient cash received")
        change = amount_paid - grand_total
    else:
        amount_paid = grand_total
        change = 0

    now = datetime.now(timezone.utc)
    seq = await next_seq(f"txnseq:{tid}:{body.outlet_id}:{now:%Y%m%d}")
    number = txn_number(tenant["code"], outlet["code"], user["code"], seq, now)

    settings = await db.tenant_settings.find_one({"tenant_id": tid}, PROJ) or {}
    order = {
        "id": str(uuid.uuid4()), "tenant_id": tid, "outlet_id": body.outlet_id,
        "outlet": {"name": outlet["name"], "address": outlet.get("address", ""), "code": outlet["code"]},
        "shift_id": body.shift_id,
        "cashier": {"id": user["id"], "code": user["code"], "name": user["name"]},
        "transaction_number": number, "client_transaction_id": body.client_transaction_id,
        "status": "PAID", "items": items_snap,
        "subtotal": subtotal,
        "discount": {"label": discount_label, "amount": discount_amount} if discount_amount else None,
        "tax": tax_snap, "service_charge": svc_snap,
        "grand_total": grand_total,
        "payment": {"method_id": method["id"], "method_name": method["name"], "method_type": method["type"],
                    "amount_paid": amount_paid, "change": change},
        "receipt_footer": settings.get("receipt_footer", ""),
        "created_at": now, "voided_at": None, "voided_by": None, "void_reason": None,
    }
    try:
        await db.orders.insert_one(order)
    except DuplicateKeyError:
        existing = await db.orders.find_one({"tenant_id": tid, "client_transaction_id": body.client_transaction_id}, PROJ)
        if existing:
            return {**existing, "duplicate": True}
        err(409, "DUPLICATE_TRANSACTION", "Duplicate transaction")
    order.pop("_id", None)
    await add_journal(tid, body.outlet_id, user, "SALE", order["id"],
                      {"transaction_number": number, "grand_total": grand_total, "method": method["name"]})
    return order


@router.get("")
async def list_orders(outlet_id: str | None = None, status: str | None = None, q: str | None = None,
                      date_from: datetime | None = None, date_to: datetime | None = None,
                      limit: int = 50, offset: int = 0, user=Depends(get_current_user)):
    if not has_permission(user["role"], "orders.view"):
        err(403, "FORBIDDEN", "Insufficient role permission")
    query = {"tenant_id": user["tenant_id"]}
    if outlet_id:
        await assert_outlet_access(user, outlet_id)
        query["outlet_id"] = outlet_id
    elif user["role"] not in ("OWNER", "MANAGER"):
        query["outlet_id"] = {"$in": user.get("outlet_ids") or []}
    if status:
        query["status"] = status
    if q:
        query["transaction_number"] = {"$regex": q, "$options": "i"}
    if date_from or date_to:
        rng = {}
        if date_from:
            rng["$gte"] = date_from
        if date_to:
            rng["$lte"] = date_to
        query["created_at"] = rng
    cursor = db.orders.find(query, PROJ).sort("created_at", -1).skip(offset).limit(min(limit, 200))
    items = await cursor.to_list(min(limit, 200))
    total = await db.orders.count_documents(query)
    return {"items": items, "total": total}


@router.get("/{order_id}")
async def get_order(order_id: str, user=Depends(get_current_user)):
    if not has_permission(user["role"], "orders.view"):
        err(403, "FORBIDDEN", "Insufficient role permission")
    order = await db.orders.find_one({"id": order_id, "tenant_id": user["tenant_id"]}, PROJ)
    if not order:
        err(404, "ORDER_NOT_FOUND", "Order not found")
    if user["role"] not in ("OWNER", "MANAGER") and order["outlet_id"] not in (user.get("outlet_ids") or []):
        err(403, "OUTLET_NOT_AUTHORIZED", "Not authorized for this outlet")
    return order


class VoidBody(BaseModel):
    reason: str = ""


@router.post("/{order_id}/void")
async def void_order(order_id: str, body: VoidBody, user=Depends(get_current_user)):
    if not has_permission(user["role"], "orders.void"):
        err(403, "FORBIDDEN", "Insufficient role permission")
    order = await db.orders.find_one({"id": order_id, "tenant_id": user["tenant_id"]}, PROJ)
    if not order:
        err(404, "ORDER_NOT_FOUND", "Order not found")
    if order["status"] != "PAID":
        err(400, "INVALID_REQUEST", "Only PAID orders can be voided")
    res = await db.orders.find_one_and_update(
        {"id": order_id, "status": "PAID"},
        {"$set": {"status": "VOID", "voided_at": datetime.now(timezone.utc),
                  "voided_by": user["id"], "void_reason": body.reason}},
        return_document=True, projection=PROJ)
    await add_journal(user["tenant_id"], order["outlet_id"], user, "VOID", order_id,
                      {"transaction_number": order["transaction_number"], "reason": body.reason})
    await log_audit(user["tenant_id"], order["outlet_id"], user, "ORDER_VOID", "order", order_id,
                    {"status": "PAID"}, {"status": "VOID", "reason": body.reason})
    return res
