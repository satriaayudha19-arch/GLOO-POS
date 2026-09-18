import logging
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from database import db
from entitlements import require_feature
from permissions import has_permission
from utils import err, log_audit, now_utc

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["inventory"])
PROJ = {"_id": 0}

# Manual adjustment types (SALE_OUT is reserved for automatic order deduction)
MANUAL_MOVEMENT_TYPES = {"PURCHASE_IN", "ADJUSTMENT", "WASTE"}


def _ensure_perm(user: dict, perm: str):
    if not has_permission(user["role"], perm):
        err(403, "FORBIDDEN", "Insufficient role permission")


def _variant_key(product_id: str, variant_option_id):
    return f"{product_id}:{variant_option_id or '_'}"


# ---------- Ingredients ----------
class IngredientBody(BaseModel):
    name: str
    unit: str
    stock_qty: float = 0
    low_stock_threshold: float = 0
    active: bool = True


@router.get("/ingredients")
async def list_ingredients(ent=Depends(require_feature("INVENTORY"))):
    _ensure_perm(ent["user"], "catalog.manage")
    return await db.ingredients.find({"tenant_id": ent["tenant"]["id"]}, PROJ).sort("name", 1).to_list(2000)


@router.post("/ingredients")
async def create_ingredient(body: IngredientBody, ent=Depends(require_feature("INVENTORY"))):
    user = ent["user"]
    _ensure_perm(user, "catalog.manage")
    doc = {
        "id": str(uuid.uuid4()), "tenant_id": user["tenant_id"],
        "name": body.name, "unit": body.unit,
        "stock_qty": body.stock_qty, "low_stock_threshold": body.low_stock_threshold,
        "active": body.active, "created_at": now_utc(),
    }
    await db.ingredients.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(user["tenant_id"], None, user, "INGREDIENT_CREATE", "ingredient", doc["id"], None,
                    {"name": body.name, "unit": body.unit, "stock_qty": body.stock_qty})
    return doc


@router.patch("/ingredients/{iid}")
async def update_ingredient(iid: str, body: dict, ent=Depends(require_feature("INVENTORY"))):
    user = ent["user"]
    _ensure_perm(user, "catalog.manage")
    # stock_qty is NEVER changed here directly -> only via /adjust so movements stay auditable
    allowed = {k: v for k, v in body.items() if k in ("name", "unit", "low_stock_threshold", "active")}
    res = await db.ingredients.find_one_and_update(
        {"id": iid, "tenant_id": user["tenant_id"]}, {"$set": allowed},
        return_document=True, projection=PROJ)
    if not res:
        err(404, "INGREDIENT_NOT_FOUND", "Ingredient not found")
    return res


class AdjustBody(BaseModel):
    type: str            # PURCHASE_IN | ADJUSTMENT | WASTE
    qty_change: float    # signed delta (positive adds, negative removes)
    note: str = ""


@router.post("/ingredients/{iid}/adjust")
async def adjust_ingredient(iid: str, body: AdjustBody, ent=Depends(require_feature("INVENTORY"))):
    user = ent["user"]
    _ensure_perm(user, "catalog.manage")
    if body.type not in MANUAL_MOVEMENT_TYPES:
        err(400, "INVALID_REQUEST", "type must be PURCHASE_IN, ADJUSTMENT or WASTE")
    if body.qty_change == 0:
        err(400, "INVALID_REQUEST", "qty_change must not be zero")
    res = await db.ingredients.find_one_and_update(
        {"id": iid, "tenant_id": user["tenant_id"]},
        {"$inc": {"stock_qty": body.qty_change}},
        return_document=True, projection=PROJ)
    if not res:
        err(404, "INGREDIENT_NOT_FOUND", "Ingredient not found")
    await db.stock_movements.insert_one({
        "id": str(uuid.uuid4()), "tenant_id": user["tenant_id"], "ingredient_id": iid,
        "type": body.type, "qty_change": body.qty_change,
        "reference_type": "manual", "reference_id": None, "note": body.note,
        "actor_id": user["id"], "created_at": now_utc(),
    })
    await log_audit(user["tenant_id"], None, user, "STOCK_ADJUST", "ingredient", iid, None,
                    {"type": body.type, "qty_change": body.qty_change, "note": body.note})
    return res


@router.get("/ingredients/{iid}/movements")
async def list_movements(iid: str, ent=Depends(require_feature("INVENTORY")), limit: int = 100):
    user = ent["user"]
    _ensure_perm(user, "catalog.manage")
    ing = await db.ingredients.find_one({"id": iid, "tenant_id": user["tenant_id"]}, PROJ)
    if not ing:
        err(404, "INGREDIENT_NOT_FOUND", "Ingredient not found")
    return await db.stock_movements.find(
        {"tenant_id": user["tenant_id"], "ingredient_id": iid}, PROJ
    ).sort("created_at", -1).to_list(min(limit, 500))


# ---------- Recipes (BOM) ----------
class RecipeIngredientIn(BaseModel):
    ingredient_id: str
    qty_per_unit: float


class RecipeBody(BaseModel):
    product_id: str
    variant_option_id: str | None = None
    ingredients: list[RecipeIngredientIn] = []


async def _validate_recipe_refs(tid: str, product_id: str, ingredients: list[RecipeIngredientIn]):
    if not await db.products.find_one({"id": product_id, "tenant_id": tid}):
        err(400, "PRODUCT_NOT_FOUND", "Invalid product")
    for ri in ingredients:
        if ri.qty_per_unit <= 0:
            err(400, "INVALID_REQUEST", "qty_per_unit must be positive")
        if not await db.ingredients.find_one({"id": ri.ingredient_id, "tenant_id": tid}):
            err(400, "INGREDIENT_NOT_FOUND", f"Invalid ingredient {ri.ingredient_id}")


@router.get("/recipes")
async def list_recipes(ent=Depends(require_feature("INVENTORY")), product_id: str | None = None):
    user = ent["user"]
    _ensure_perm(user, "catalog.manage")
    query = {"tenant_id": user["tenant_id"]}
    if product_id:
        query["product_id"] = product_id
    return await db.recipes.find(query, PROJ).to_list(2000)


@router.post("/recipes")
async def create_recipe(body: RecipeBody, ent=Depends(require_feature("INVENTORY"))):
    user = ent["user"]
    _ensure_perm(user, "catalog.manage")
    tid = user["tenant_id"]
    await _validate_recipe_refs(tid, body.product_id, body.ingredients)
    vkey = _variant_key(body.product_id, body.variant_option_id)
    if await db.recipes.find_one({"tenant_id": tid, "variant_key": vkey}):
        err(409, "RECIPE_EXISTS", "A recipe already exists for this product/variant; edit it instead")
    doc = {
        "id": str(uuid.uuid4()), "tenant_id": tid,
        "product_id": body.product_id, "variant_option_id": body.variant_option_id,
        "variant_key": vkey,
        "ingredients": [ri.model_dump() for ri in body.ingredients],
        "created_at": now_utc(),
    }
    await db.recipes.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(tid, None, user, "RECIPE_CREATE", "recipe", doc["id"], None,
                    {"product_id": body.product_id, "variant_option_id": body.variant_option_id})
    return doc


@router.patch("/recipes/{rid}")
async def update_recipe(rid: str, body: RecipeBody, ent=Depends(require_feature("INVENTORY"))):
    user = ent["user"]
    _ensure_perm(user, "catalog.manage")
    tid = user["tenant_id"]
    await _validate_recipe_refs(tid, body.product_id, body.ingredients)
    vkey = _variant_key(body.product_id, body.variant_option_id)
    clash = await db.recipes.find_one({"tenant_id": tid, "variant_key": vkey, "id": {"$ne": rid}})
    if clash:
        err(409, "RECIPE_EXISTS", "Another recipe already covers this product/variant")
    res = await db.recipes.find_one_and_update(
        {"id": rid, "tenant_id": tid},
        {"$set": {"product_id": body.product_id, "variant_option_id": body.variant_option_id,
                  "variant_key": vkey, "ingredients": [ri.model_dump() for ri in body.ingredients]}},
        return_document=True, projection=PROJ)
    if not res:
        err(404, "RECIPE_NOT_FOUND", "Recipe not found")
    return res


@router.delete("/recipes/{rid}")
async def delete_recipe(rid: str, ent=Depends(require_feature("INVENTORY"))):
    user = ent["user"]
    _ensure_perm(user, "catalog.manage")
    res = await db.recipes.delete_one({"id": rid, "tenant_id": user["tenant_id"]})
    if res.deleted_count == 0:
        err(404, "RECIPE_NOT_FOUND", "Recipe not found")
    return {"ok": True}


# ---------- Low stock ----------
@router.get("/inventory/low-stock")
async def low_stock(ent=Depends(require_feature("INVENTORY"))):
    user = ent["user"]
    _ensure_perm(user, "catalog.manage")
    return await db.ingredients.find(
        {"tenant_id": user["tenant_id"], "active": True,
         "$expr": {"$lte": ["$stock_qty", "$low_stock_threshold"]}},
        PROJ,
    ).sort("stock_qty", 1).to_list(1000)


# ---------- Order integration (called from orders.create_order) ----------
async def deduct_stock_for_order(order: dict):
    """Best-effort, atomic stock deduction for a paid order.

    Never raise to the caller: an order/payment must NEVER fail because of stock.
    Uses find_one_and_update($inc) per ingredient => race-condition safe.
    """
    tid = order["tenant_id"]
    deductions: dict[str, float] = {}
    for item in order.get("items", []):
        product_id = item.get("product_id")
        qty = item.get("qty", 0)
        if not product_id or qty <= 0:
            continue
        variant_ids = item.get("variant_option_ids") or []
        recipes = await db.recipes.find(
            {"tenant_id": tid, "product_id": product_id,
             "$or": [{"variant_option_id": None}, {"variant_option_id": {"$in": variant_ids}}]},
            PROJ,
        ).to_list(100)
        for r in recipes:
            for ri in r.get("ingredients", []):
                iid = ri.get("ingredient_id")
                per = ri.get("qty_per_unit", 0)
                if iid and per:
                    deductions[iid] = deductions.get(iid, 0) + per * qty

    for iid, total in deductions.items():
        if total <= 0:
            continue
        res = await db.ingredients.find_one_and_update(
            {"id": iid, "tenant_id": tid},
            {"$inc": {"stock_qty": -total}},
            return_document=True, projection=PROJ)
        if res is None:
            continue
        await db.stock_movements.insert_one({
            "id": str(uuid.uuid4()), "tenant_id": tid, "ingredient_id": iid,
            "type": "SALE_OUT", "qty_change": -total,
            "reference_type": "order", "reference_id": order.get("id"),
            "note": order.get("transaction_number", ""),
            "actor_id": (order.get("cashier") or {}).get("id"),
            "created_at": now_utc(),
        })
