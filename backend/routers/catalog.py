import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from database import db
from entitlements import require_feature, get_entitlements
from security import require_permission, assert_outlet_access
from utils import err, log_audit

router = APIRouter(prefix="/api", tags=["catalog"])

PROJ = {"_id": 0}


# ---------- Categories ----------
class CategoryBody(BaseModel):
    name: str
    sort_order: int = 0


@router.get("/categories")
async def list_categories(ent=Depends(get_entitlements)):
    return await db.categories.find({"tenant_id": ent["tenant"]["id"]}, PROJ).sort("sort_order", 1).to_list(500)


@router.post("/categories")
async def create_category(body: CategoryBody, user=Depends(require_permission("catalog.manage"))):
    doc = {"id": str(uuid.uuid4()), "tenant_id": user["tenant_id"], "name": body.name,
           "sort_order": body.sort_order, "active": True, "created_at": datetime.now(timezone.utc)}
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/categories/{cid}")
async def update_category(cid: str, body: dict, user=Depends(require_permission("catalog.manage"))):
    allowed = {k: v for k, v in body.items() if k in ("name", "sort_order", "active")}
    res = await db.categories.find_one_and_update({"id": cid, "tenant_id": user["tenant_id"]}, {"$set": allowed},
                                                  return_document=True, projection=PROJ)
    if not res:
        err(404, "CATEGORY_NOT_FOUND", "Category not found")
    return res


@router.delete("/categories/{cid}")
async def delete_category(cid: str, user=Depends(require_permission("catalog.manage"))):
    if await db.products.find_one({"tenant_id": user["tenant_id"], "category_id": cid}):
        err(400, "CATEGORY_IN_USE", "Category has products; deactivate instead")
    await db.categories.delete_one({"id": cid, "tenant_id": user["tenant_id"]})
    return {"ok": True}


# ---------- Variant groups ----------
class VariantOptionIn(BaseModel):
    id: str | None = None
    name: str
    price_delta: int = 0


class VariantGroupBody(BaseModel):
    name: str
    required: bool = False
    options: list[VariantOptionIn] = []


@router.get("/variant-groups")
async def list_variant_groups(ent=Depends(get_entitlements)):
    return await db.variant_groups.find({"tenant_id": ent["tenant"]["id"]}, PROJ).to_list(500)


@router.post("/variant-groups")
async def create_variant_group(body: VariantGroupBody, user=Depends(require_permission("catalog.manage"))):
    doc = {"id": str(uuid.uuid4()), "tenant_id": user["tenant_id"], "name": body.name, "required": body.required,
           "active": True, "options": [{"id": o.id or str(uuid.uuid4()), "name": o.name, "price_delta": o.price_delta} for o in body.options],
           "created_at": datetime.now(timezone.utc)}
    await db.variant_groups.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/variant-groups/{gid}")
async def update_variant_group(gid: str, body: VariantGroupBody, user=Depends(require_permission("catalog.manage"))):
    res = await db.variant_groups.find_one_and_update(
        {"id": gid, "tenant_id": user["tenant_id"]},
        {"$set": {"name": body.name, "required": body.required,
                  "options": [{"id": o.id or str(uuid.uuid4()), "name": o.name, "price_delta": o.price_delta} for o in body.options]}},
        return_document=True, projection=PROJ)
    if not res:
        err(404, "VARIANT_GROUP_NOT_FOUND", "Variant group not found")
    return res


# ---------- Modifier groups ----------
class ModifierOptionIn(BaseModel):
    id: str | None = None
    name: str
    price: int = 0


class ModifierGroupBody(BaseModel):
    name: str
    multi: bool = True
    options: list[ModifierOptionIn] = []


@router.get("/modifier-groups")
async def list_modifier_groups(ent=Depends(get_entitlements)):
    return await db.modifier_groups.find({"tenant_id": ent["tenant"]["id"]}, PROJ).to_list(500)


@router.post("/modifier-groups")
async def create_modifier_group(body: ModifierGroupBody, user=Depends(require_permission("catalog.manage"))):
    doc = {"id": str(uuid.uuid4()), "tenant_id": user["tenant_id"], "name": body.name, "multi": body.multi,
           "active": True, "options": [{"id": o.id or str(uuid.uuid4()), "name": o.name, "price": o.price} for o in body.options],
           "created_at": datetime.now(timezone.utc)}
    await db.modifier_groups.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/modifier-groups/{gid}")
async def update_modifier_group(gid: str, body: ModifierGroupBody, user=Depends(require_permission("catalog.manage"))):
    res = await db.modifier_groups.find_one_and_update(
        {"id": gid, "tenant_id": user["tenant_id"]},
        {"$set": {"name": body.name, "multi": body.multi,
                  "options": [{"id": o.id or str(uuid.uuid4()), "name": o.name, "price": o.price} for o in body.options]}},
        return_document=True, projection=PROJ)
    if not res:
        err(404, "MODIFIER_GROUP_NOT_FOUND", "Modifier group not found")
    return res


# ---------- Products ----------
class ProductBody(BaseModel):
    name: str
    code: str = ""
    sku: str = ""
    barcode: str = ""
    description: str = ""
    category_id: str
    base_price: int
    image_url: str = ""
    variant_group_ids: list[str] = []
    modifier_group_ids: list[str] = []
    active: bool = True


@router.get("/products")
async def list_products(ent=Depends(get_entitlements), category_id: str | None = None, q: str | None = None):
    query = {"tenant_id": ent["tenant"]["id"]}
    if category_id:
        query["category_id"] = category_id
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"code": {"$regex": q, "$options": "i"}},
                        {"sku": {"$regex": q, "$options": "i"}}, {"barcode": q}]
    return await db.products.find(query, PROJ).sort("name", 1).to_list(1000)


@router.post("/products")
async def create_product(body: ProductBody, user=Depends(require_permission("catalog.manage"))):
    if not await db.categories.find_one({"id": body.category_id, "tenant_id": user["tenant_id"]}):
        err(400, "CATEGORY_NOT_FOUND", "Invalid category")
    doc = {"id": str(uuid.uuid4()), "tenant_id": user["tenant_id"], **body.model_dump(),
           "created_at": datetime.now(timezone.utc)}
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(user["tenant_id"], None, user, "PRODUCT_CREATE", "product", doc["id"], None, {"name": body.name, "base_price": body.base_price})
    return doc


@router.patch("/products/{pid}")
async def update_product(pid: str, body: dict, user=Depends(require_permission("catalog.manage"))):
    old = await db.products.find_one({"id": pid, "tenant_id": user["tenant_id"]}, PROJ)
    if not old:
        err(404, "PRODUCT_NOT_FOUND", "Product not found")
    allowed = {k: v for k, v in body.items() if k in
               ("name", "code", "sku", "barcode", "description", "category_id", "base_price", "image_url",
                "variant_group_ids", "modifier_group_ids", "active")}
    res = await db.products.find_one_and_update({"id": pid, "tenant_id": user["tenant_id"]}, {"$set": allowed},
                                                return_document=True, projection=PROJ)
    if "base_price" in allowed and allowed["base_price"] != old.get("base_price"):
        await log_audit(user["tenant_id"], None, user, "PRICE_CHANGE", "product", pid,
                        {"base_price": old.get("base_price")}, {"base_price": allowed["base_price"]})
    return res


# ---------- Discounts ----------
class DiscountBody(BaseModel):
    name: str
    type: str  # PERCENTAGE | FIXED
    value: int
    min_purchase: int = 0
    max_discount: int | None = None
    active: bool = True
    starts_at: datetime | None = None
    ends_at: datetime | None = None


@router.get("/discounts")
async def list_discounts(ent=Depends(get_entitlements)):
    return await db.discounts.find({"tenant_id": ent["tenant"]["id"]}, PROJ).to_list(500)


@router.post("/discounts")
async def create_discount(body: DiscountBody, ent=Depends(require_feature("DISCOUNTS"))):
    user = ent["user"]
    if user["role"] not in ("OWNER", "MANAGER"):
        err(403, "FORBIDDEN", "Insufficient role permission")
    if body.type not in ("PERCENTAGE", "FIXED"):
        err(400, "INVALID_REQUEST", "type must be PERCENTAGE or FIXED")
    doc = {"id": str(uuid.uuid4()), "tenant_id": user["tenant_id"], **body.model_dump(),
           "created_at": datetime.now(timezone.utc)}
    await db.discounts.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(user["tenant_id"], None, user, "DISCOUNT_CREATE", "discount", doc["id"], None, body.model_dump())
    return doc


@router.patch("/discounts/{did}")
async def update_discount(did: str, body: dict, ent=Depends(require_feature("DISCOUNTS"))):
    user = ent["user"]
    if user["role"] not in ("OWNER", "MANAGER"):
        err(403, "FORBIDDEN", "Insufficient role permission")
    old = await db.discounts.find_one({"id": did, "tenant_id": user["tenant_id"]}, PROJ)
    if not old:
        err(404, "DISCOUNT_NOT_FOUND", "Discount not found")
    allowed = {k: v for k, v in body.items() if k in ("name", "type", "value", "min_purchase", "max_discount", "active", "starts_at", "ends_at")}
    res = await db.discounts.find_one_and_update({"id": did, "tenant_id": user["tenant_id"]}, {"$set": allowed},
                                                 return_document=True, projection=PROJ)
    await log_audit(user["tenant_id"], None, user, "DISCOUNT_UPDATE", "discount", did, old, allowed)
    return res


# ---------- POS catalog bundle ----------
@router.get("/pos/catalog")
async def pos_catalog(outlet_id: str, ent=Depends(require_feature("POS"))):
    user = ent["user"]
    from permissions import has_permission
    if not has_permission(user["role"], "pos.use"):
        err(403, "FORBIDDEN", "Insufficient role permission")
    await assert_outlet_access(user, outlet_id)
    tid = ent["tenant"]["id"]
    now = datetime.now(timezone.utc)
    discounts = await db.discounts.find({"tenant_id": tid, "active": True}, PROJ).to_list(100)
    discounts = [d for d in discounts
                 if (not d.get("starts_at") or d["starts_at"] <= now) and (not d.get("ends_at") or d["ends_at"] >= now)]
    return {
        "categories": await db.categories.find({"tenant_id": tid, "active": True}, PROJ).sort("sort_order", 1).to_list(100),
        "products": await db.products.find({"tenant_id": tid, "active": True}, PROJ).sort("name", 1).to_list(1000),
        "variant_groups": await db.variant_groups.find({"tenant_id": tid, "active": True}, PROJ).to_list(100),
        "modifier_groups": await db.modifier_groups.find({"tenant_id": tid, "active": True}, PROJ).to_list(100),
        "payment_methods": await db.payment_methods.find({"tenant_id": tid, "active": True}, PROJ).sort("sort_order", 1).to_list(50),
        "tax": await db.taxes.find_one({"tenant_id": tid, "active": True}, PROJ),
        "service_charge": await db.service_charges.find_one({"tenant_id": tid, "active": True}, PROJ),
        "discounts": discounts,
    }
