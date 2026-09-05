"""Backend smoke tests — spot check core APIs for GLOO POS.

Backend acceptance suite already passed 27/27 per main agent context.
This suite verifies the critical endpoints still work end-to-end via the public URL.
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://gloo-offline-first.preview.emergentagent.com").rstrip("/")

CASHIER = {"email": "cashier@gloo.demo", "password": "GlooDemo2026!"}
OWNER = {"email": "satriaayudha19@gmail.com", "password": "GlooPOS2026!"}
PLATFORM = {"email": "platform@gloo.pos", "password": "GlooPlatform2026!"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text}"
    body = r.json()
    token = body.get("access_token") or body.get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s, body


# ---------- Auth ----------
def test_login_cashier():
    s, body = _login(CASHIER)
    assert "user" in body or body.get("email") or body.get("access_token")


def test_login_invalid():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "cashier@gloo.demo", "password": "wrong"}, timeout=30)
    assert r.status_code in (400, 401, 403)


def test_auth_me():
    s, _ = _login(CASHIER)
    r = s.get(f"{BASE_URL}/api/auth/me", timeout=30)
    assert r.status_code == 200
    d = r.json()
    user = d.get("user", d)
    assert user.get("email") == CASHIER["email"]


# ---------- Subscription ----------
def test_subscription_owner():
    s, _ = _login(OWNER)
    r = s.get(f"{BASE_URL}/api/subscription", timeout=30)
    assert r.status_code == 200
    d = r.json()
    plan = d.get("plan", {})
    sub = d.get("subscription", {})
    assert plan.get("code") == "PRO"
    assert sub.get("status", "").upper() == "ACTIVE"


def test_subscription_features():
    s, _ = _login(OWNER)
    r = s.get(f"{BASE_URL}/api/subscription/features", timeout=30)
    assert r.status_code == 200


# ---------- Catalog / POS ----------
def test_pos_catalog():
    s, _ = _login(CASHIER)
    # find outlet
    outlets = s.get(f"{BASE_URL}/api/outlets", timeout=30)
    assert outlets.status_code == 200
    ol = outlets.json()
    outlet_id = ol[0]["id"] if isinstance(ol, list) else ol.get("items", [{}])[0].get("id")
    assert outlet_id
    r = s.get(f"{BASE_URL}/api/pos/catalog", params={"outlet_id": outlet_id}, timeout=30)
    assert r.status_code == 200


# ---------- Dashboard ----------
def test_dashboard_owner():
    s, _ = _login(OWNER)
    r = s.get(f"{BASE_URL}/api/dashboard", timeout=30)
    assert r.status_code == 200


# ---------- Platform ----------
def test_platform_tenants():
    s, _ = _login(PLATFORM)
    r = s.get(f"{BASE_URL}/api/platform/tenants", timeout=30)
    assert r.status_code == 200
    d = r.json()
    tenants = d if isinstance(d, list) else d.get("items", d.get("tenants", []))
    assert len(tenants) >= 1


def test_platform_plans():
    s, _ = _login(PLATFORM)
    r = s.get(f"{BASE_URL}/api/platform/plans", timeout=30)
    assert r.status_code == 200
    d = r.json()
    plans = d if isinstance(d, list) else d.get("items", d.get("plans", []))
    codes = {p.get("code") or p.get("plan_code") for p in plans}
    assert {"FREE", "BASIC", "PRO", "ENTERPRISE"}.issubset(codes)


# ---------- RBAC: cashier should not access platform ----------
def test_cashier_forbidden_platform():
    s, _ = _login(CASHIER)
    r = s.get(f"{BASE_URL}/api/platform/tenants", timeout=30)
    assert r.status_code in (401, 403)


# ---------- PWA static ----------
def test_manifest_served():
    r = requests.get(f"{BASE_URL}/manifest.json", timeout=30)
    assert r.status_code == 200
    # Might be JSON or served with correct content-type
    assert "name" in r.text or "short_name" in r.text


def test_sw_served():
    r = requests.get(f"{BASE_URL}/sw.js", timeout=30)
    assert r.status_code == 200


# ---------- Txn number format sanity from orders list ----------
TXN_RE = re.compile(r"^T\d{3}-O\d{2}-U\d{3}-\d{8}-\d{6}-\d{6}$")


def test_orders_txn_format():
    s, _ = _login(OWNER)
    r = s.get(f"{BASE_URL}/api/orders", timeout=30)
    assert r.status_code == 200
    data = r.json()
    orders = data if isinstance(data, list) else data.get("items", [])
    if not orders:
        pytest.skip("no orders yet")
    for o in orders[:5]:
        tn = o.get("transaction_number") or o.get("txn_number") or o.get("transactionNumber")
        assert tn and TXN_RE.match(tn), f"bad txn format: {tn}"
