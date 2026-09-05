import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from database import db
from entitlements import get_entitlements
from security import require_permission
from utils import err, log_audit

router = APIRouter(prefix="/api", tags=["operations"])
PROJ = {"_id": 0}

PAYMENT_TYPES = ["CASH", "QRIS", "BANK_TRANSFER", "DEBIT", "CREDIT_CARD", "EWALLET", "OTHER"]


class PaymentMethodBody(BaseModel):
    name: str
    type: str
    active: bool = True
    sort_order: int = 0


@router.get("/payment-methods")
async def list_payment_methods(ent=Depends(get_entitlements)):
    return await db.payment_methods.find({"tenant_id": ent["tenant"]["id"]}, PROJ).sort("sort_order", 1).to_list(100)


@router.post("/payment-methods")
async def create_payment_method(body: PaymentMethodBody, user=Depends(require_permission("payments.manage"))):
    if body.type not in PAYMENT_TYPES:
        err(400, "INVALID_REQUEST", f"type must be one of {PAYMENT_TYPES}")
    doc = {"id": str(uuid.uuid4()), "tenant_id": user["tenant_id"], **body.model_dump(),
           "created_at": datetime.now(timezone.utc)}
    await db.payment_methods.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/payment-methods/{pid}")
async def update_payment_method(pid: str, body: dict, user=Depends(require_permission("payments.manage"))):
    allowed = {k: v for k, v in body.items() if k in ("name", "type", "active", "sort_order")}
    res = await db.payment_methods.find_one_and_update({"id": pid, "tenant_id": user["tenant_id"]}, {"$set": allowed},
                                                       return_document=True, projection=PROJ)
    if not res:
        err(404, "PAYMENT_METHOD_NOT_FOUND", "Payment method not found")
    return res


# ---------- Tax ----------
class TaxBody(BaseModel):
    name: str = "Tax"
    percent: float
    inclusive: bool = False
    active: bool = True


@router.get("/tax")
async def get_tax(ent=Depends(get_entitlements)):
    return await db.taxes.find_one({"tenant_id": ent["tenant"]["id"]}, PROJ) or {}


@router.put("/tax")
async def upsert_tax(body: TaxBody, user=Depends(require_permission("tax.manage"))):
    existing = await db.taxes.find_one({"tenant_id": user["tenant_id"]})
    data = body.model_dump()
    if existing:
        res = await db.taxes.find_one_and_update({"id": existing["id"]}, {"$set": data}, return_document=True, projection=PROJ)
    else:
        doc = {"id": str(uuid.uuid4()), "tenant_id": user["tenant_id"], **data, "created_at": datetime.now(timezone.utc)}
        await db.taxes.insert_one(doc)
        doc.pop("_id", None)
        res = doc
    await log_audit(user["tenant_id"], None, user, "TAX_UPDATE", "tax", res.get("id"), None, data)
    return res


# ---------- Service charge ----------
class ServiceBody(BaseModel):
    name: str = "Service"
    percent: float
    active: bool = True


@router.get("/service-charge")
async def get_service(ent=Depends(get_entitlements)):
    return await db.service_charges.find_one({"tenant_id": ent["tenant"]["id"]}, PROJ) or {}


@router.put("/service-charge")
async def upsert_service(body: ServiceBody, user=Depends(require_permission("tax.manage"))):
    existing = await db.service_charges.find_one({"tenant_id": user["tenant_id"]})
    data = body.model_dump()
    if existing:
        res = await db.service_charges.find_one_and_update({"id": existing["id"]}, {"$set": data}, return_document=True, projection=PROJ)
    else:
        doc = {"id": str(uuid.uuid4()), "tenant_id": user["tenant_id"], **data, "created_at": datetime.now(timezone.utc)}
        await db.service_charges.insert_one(doc)
        doc.pop("_id", None)
        res = doc
    await log_audit(user["tenant_id"], None, user, "SERVICE_UPDATE", "service_charge", res.get("id"), None, data)
    return res
