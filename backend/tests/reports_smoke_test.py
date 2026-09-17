"""Smoke tests for the Reports API.

Set REPORTS_TEST_OWNER_EMAIL/PASSWORD and REPORTS_TEST_CASHIER_EMAIL/PASSWORD
when running against a database with those accounts. The tests never modify data.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
OWNER = {
    "email": os.environ.get("REPORTS_TEST_OWNER_EMAIL"),
    "password": os.environ.get("REPORTS_TEST_OWNER_PASSWORD"),
}
CASHIER = {
    "email": os.environ.get("REPORTS_TEST_CASHIER_EMAIL"),
    "password": os.environ.get("REPORTS_TEST_CASHIER_PASSWORD"),
}


def _require_credentials(credentials):
    if not credentials["email"] or not credentials["password"]:
        pytest.skip("Set the reports smoke-test credentials in environment variables")


def _login(credentials):
    _require_credentials(credentials)
    session = requests.Session()
    response = session.post(f"{BASE_URL}/api/auth/login", json=credentials, timeout=30)
    assert response.status_code == 200, response.text
    return session, response.json()


def test_reports_endpoints_return_aggregated_data():
    session, _ = _login(OWNER)
    for endpoint in ("sales", "products", "payments", "discounts", "shifts", "advanced-summary"):
        response = session.get(f"{BASE_URL}/api/reports/{endpoint}", timeout=30)
        assert response.status_code == 200, f"{endpoint}: {response.status_code} {response.text}"
        assert isinstance(response.json(), (list, dict))


def test_reports_permission_gate_blocks_cashier():
    session, _ = _login(CASHIER)
    response = session.get(f"{BASE_URL}/api/reports/sales", timeout=30)
    assert response.status_code == 403


def test_reports_outlet_is_server_authorized():
    session, _ = _login(OWNER)
    response = session.get(f"{BASE_URL}/api/reports/sales", params={"outlet_id": str(uuid.uuid4())}, timeout=30)
    assert response.status_code == 404


def test_payments_and_shift_breakdowns_keep_methods_separate():
    session, _ = _login(OWNER)
    payments = session.get(f"{BASE_URL}/api/reports/payments", timeout=30)
    assert payments.status_code == 200, payments.text
    payment_rows = payments.json()
    payment_types = {row["method_type"] for row in payment_rows}
    assert all(row["method_type"] and row["method_name"] for row in payment_rows)
    if {"CASH", "QRIS"}.issubset(payment_types):
        assert len({row["method_type"] for row in payment_rows if row["method_type"] in {"CASH", "QRIS"}}) == 2

    shifts = session.get(f"{BASE_URL}/api/reports/shifts", timeout=30)
    assert shifts.status_code == 200, shifts.text
    for shift in shifts.json():
        methods = {row["method_type"] for row in shift.get("payment_breakdown", [])}
        assert len(methods) == len(shift.get("payment_breakdown", []))
        if "CASH" in methods and "QRIS" in methods:
            assert shift["cash_sales"] <= shift["total_sales"]


def test_sales_rows_have_expected_fields():
    session, _ = _login(OWNER)
    response = session.get(f"{BASE_URL}/api/reports/sales", params={"group_by": "DAY"}, timeout=30)
    assert response.status_code == 200, response.text
    for row in response.json():
        assert {"period", "gross_sales", "discount_total", "tax_total", "service_total", "net_sales", "orders_count", "avg_transaction"}.issubset(row)
