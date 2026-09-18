"""Smoke tests for the Inventory API (Fase 2).

Set the credentials via environment variables (see test_credentials.md).
These tests DO create development data (ingredients, a recipe, orders) on
whatever database BASE_URL points at. Run only against a dev/preview DB.
"""
import os
import uuid
import concurrent.futures

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
OWNER = {
    "email": os.environ.get("INV_TEST_OWNER_EMAIL"),
    "password": os.environ.get("INV_TEST_OWNER_PASSWORD"),
}
CASHIER = {
    "email": os.environ.get("INV_TEST_CASHIER_EMAIL"),
    "password": os.environ.get("INV_TEST_CASHIER_PASSWORD"),
}


def _require(creds):
    if not creds["email"] or not creds["password"]:
        pytest.skip("Set inventory smoke-test credentials in environment variables")


def _login(creds):
    _require(creds)
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    return s, r.json()


def _no_variant_product(session):
    products = session.get(f"{BASE_URL}/api/products", timeout=30).json()
    for p in products:
        if not p.get("variant_group_ids"):
            return p
    return None


def _open_shift(session, outlet_id):
    cur = session.get(f"{BASE_URL}/api/shifts/current", params={"outlet_id": outlet_id}, timeout=30)
    if cur.status_code == 200 and cur.json() and cur.json().get("status") == "OPEN":
        return cur.json()["id"]
    r = session.post(f"{BASE_URL}/api/shifts/open", json={"outlet_id": outlet_id, "opening_cash": 500000}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_cashier_cannot_access_inventory():
    session, _ = _login(CASHIER)
    r = session.get(f"{BASE_URL}/api/ingredients", timeout=30)
    assert r.status_code == 403


def test_ingredient_crud_and_adjust_records_movement():
    session, _ = _login(OWNER)
    name = f"TestBahan-{uuid.uuid4().hex[:6]}"
    created = session.post(f"{BASE_URL}/api/ingredients",
                           json={"name": name, "unit": "gram", "stock_qty": 500, "low_stock_threshold": 50},
                           timeout=30)
    assert created.status_code == 200, created.text
    iid = created.json()["id"]
    adj = session.post(f"{BASE_URL}/api/ingredients/{iid}/adjust",
                       json={"type": "WASTE", "qty_change": -20, "note": "smoke"}, timeout=30)
    assert adj.status_code == 200, adj.text
    assert adj.json()["stock_qty"] == 480
    moves = session.get(f"{BASE_URL}/api/ingredients/{iid}/movements", timeout=30).json()
    assert any(m["type"] == "WASTE" for m in moves)


def test_order_deducts_stock_atomically_under_concurrency():
    session, login = _login(OWNER)
    outlet = login["user"]["outlet_ids"][0]
    cat = session.get(f"{BASE_URL}/api/pos/catalog", params={"outlet_id": outlet}, timeout=30).json()
    cash = next(m for m in cat["payment_methods"] if m["type"] == "CASH")
    product = _no_variant_product(session)
    assert product, "need a product without required variants for this test"
    shift = _open_shift(session, outlet)

    ing = session.post(f"{BASE_URL}/api/ingredients",
                       json={"name": f"Conc-{uuid.uuid4().hex[:6]}", "unit": "gram",
                             "stock_qty": 1000, "low_stock_threshold": 0}, timeout=30).json()
    iid = ing["id"]
    # replace any existing recipe for this product with ours (variant-less)
    existing = session.get(f"{BASE_URL}/api/recipes", params={"product_id": product["id"]}, timeout=30).json()
    base = next((r for r in existing if r.get("variant_option_id") is None), None)
    payload = {"product_id": product["id"], "ingredients": [{"ingredient_id": iid, "qty_per_unit": 10}]}
    if base:
        session.patch(f"{BASE_URL}/api/recipes/{base['id']}", json=payload, timeout=30)
    else:
        session.post(f"{BASE_URL}/api/recipes", json=payload, timeout=30)

    def current_qty():
        for i in session.get(f"{BASE_URL}/api/ingredients", timeout=30).json():
            if i["id"] == iid:
                return i["stock_qty"]

    start = current_qty()

    def place_order(_):
        s = requests.Session()
        s.post(f"{BASE_URL}/api/auth/login", json=OWNER, timeout=30)
        return s.post(f"{BASE_URL}/api/orders", json={
            "outlet_id": outlet, "shift_id": shift, "client_transaction_id": str(uuid.uuid4()),
            "items": [{"product_id": product["id"], "qty": 1}],
            "payment": {"method_id": cash["id"], "amount_paid": 100000},
        }, timeout=30).status_code

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        codes = list(ex.map(place_order, range(10)))
    assert all(c == 200 for c in codes), codes
    assert current_qty() == start - 100  # 10 orders * qty1 * 10 per unit


def test_order_succeeds_without_recipe():
    session, login = _login(OWNER)
    outlet = login["user"]["outlet_ids"][0]
    cat = session.get(f"{BASE_URL}/api/pos/catalog", params={"outlet_id": outlet}, timeout=30).json()
    cash = next(m for m in cat["payment_methods"] if m["type"] == "CASH")
    product = _no_variant_product(session)
    shift = _open_shift(session, outlet)
    # remove any recipe so the product has none
    for r in session.get(f"{BASE_URL}/api/recipes", params={"product_id": product["id"]}, timeout=30).json():
        session.delete(f"{BASE_URL}/api/recipes/{r['id']}", timeout=30)
    r = session.post(f"{BASE_URL}/api/orders", json={
        "outlet_id": outlet, "shift_id": shift, "client_transaction_id": str(uuid.uuid4()),
        "items": [{"product_id": product["id"], "qty": 1}],
        "payment": {"method_id": cash["id"], "amount_paid": 100000},
    }, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "PAID"


def test_tenant_isolation_ingredient_not_visible_cross_tenant():
    # Owner can only see own-tenant ingredients; a random id returns 404 on movements
    session, _ = _login(OWNER)
    r = session.get(f"{BASE_URL}/api/ingredients/{uuid.uuid4()}/movements", timeout=30)
    assert r.status_code == 404
