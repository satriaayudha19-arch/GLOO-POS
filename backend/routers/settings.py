from fastapi import APIRouter, Depends
from pydantic import BaseModel

from database import db
from entitlements import get_entitlements
from utils import log_audit

router = APIRouter(prefix="/api/settings", tags=["settings"])
PROJ = {"_id": 0}


class ReceiptSettings(BaseModel):
    receipt_footer: str = ""
    receipt_header: str = ""


@router.get("/receipt")
async def get_receipt_settings(ent=Depends(get_entitlements)):
    doc = await db.tenant_settings.find_one({"tenant_id": ent["tenant"]["id"]}, PROJ)
    return doc or {"receipt_footer": "", "receipt_header": ""}


@router.put("/receipt")
async def put_receipt_settings(body: ReceiptSettings, ent=Depends(get_entitlements)):
    user = ent["user"]
    if user["role"] != "OWNER":
        from utils import err
        err(403, "FORBIDDEN", "Only OWNER can change receipt settings")
    res = await db.tenant_settings.find_one_and_update(
        {"tenant_id": ent["tenant"]["id"]},
        {"$set": {"receipt_footer": body.receipt_footer, "receipt_header": body.receipt_header},
         "$setOnInsert": {"tenant_id": ent["tenant"]["id"]}},
        upsert=True, return_document=True, projection=PROJ)
    await log_audit(ent["tenant"]["id"], None, user, "SETTINGS_UPDATE", "tenant_settings", ent["tenant"]["id"], None, body.model_dump())
    return res
