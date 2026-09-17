#!/usr/bin/env python3
"""
Comprehensive backend test for Fase 0 changes.
Tests timezone helpers, seed behavior, change-password endpoint, and production dependencies.
"""
import os
import sys
import requests
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

# Backend URL from environment
BACKEND_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://395acf07-2c65-401c-94d2-757726130f56.preview.emergentagent.com")
API_BASE = f"{BACKEND_URL}/api"

# Test credentials from seeded data
CASHIER_EMAIL = "cashier@gloo.demo"
CASHIER_PASSWORD = "GlooDemo2026!"
OWNER_EMAIL = "satriaayudha19@gmail.com"
OWNER_PASSWORD = "GlooPOS2026!"

WIB = ZoneInfo("Asia/Jakarta")

def test_health():
    """Verify backend is running."""
    print("\n=== TEST 1: Backend Health ===")
    resp = requests.get(f"{API_BASE}/health", timeout=10)
    assert resp.status_code == 200, f"Health check failed: {resp.status_code}"
    data = resp.json()
    assert data["status"] == "ok", f"Health status not ok: {data}"
    assert data["app"] == "GLOO POS", f"App name mismatch: {data}"
    print("✅ Backend health check passed")
    return True


def test_timezone_helpers():
    """Verify timezone helper functions in utils.py."""
    print("\n=== TEST 2: Timezone Helpers (Code Review) ===")
    
    # Read utils.py to verify implementation
    with open("/app/backend/utils.py", "r") as f:
        utils_code = f.read()
    
    # Check now_local uses Asia/Jakarta
    assert 'WIB = ZoneInfo("Asia/Jakarta")' in utils_code, "WIB timezone not defined"
    assert "def now_local()" in utils_code, "now_local function not found"
    assert "datetime.now(WIB)" in utils_code, "now_local doesn't use WIB"
    print("✅ now_local() uses Asia/Jakarta")
    
    # Check today_start_utc converts WIB midnight to UTC
    assert "def today_start_utc" in utils_code, "today_start_utc function not found"
    assert ".astimezone(WIB)" in utils_code, "today_start_utc doesn't convert to WIB"
    assert "hour=0, minute=0, second=0, microsecond=0" in utils_code, "today_start_utc doesn't set midnight"
    assert ".astimezone(timezone.utc)" in utils_code, "today_start_utc doesn't convert back to UTC"
    print("✅ today_start_utc() converts WIB midnight to UTC")
    
    # Check transaction_seq_key uses WIB date
    assert "def transaction_seq_key" in utils_code, "transaction_seq_key function not found"
    assert '.astimezone(WIB).strftime("%Y%m%d")' in utils_code, "transaction_seq_key doesn't use WIB date"
    print("✅ transaction_seq_key() uses WIB date")
    
    return True


def test_dashboard_uses_today_start_utc():
    """Verify dashboard uses today_start_utc for day boundaries."""
    print("\n=== TEST 3: Dashboard Uses today_start_utc ===")
    
    with open("/app/backend/routers/dashboard.py", "r") as f:
        dashboard_code = f.read()
    
    # Check imports
    assert "from utils import" in dashboard_code and "today_start_utc" in dashboard_code, \
        "today_start_utc not imported in dashboard.py"
    
    # Check usage
    assert "day_start = today_start_utc()" in dashboard_code, \
        "dashboard doesn't call today_start_utc()"
    assert '"created_at": {"$gte": day_start}' in dashboard_code, \
        "dashboard doesn't use day_start for created_at query"
    
    print("✅ Dashboard uses today_start_utc() for day boundaries")
    return True


def test_order_creation_timezone():
    """Verify order creation uses UTC for created_at and WIB for transaction_number."""
    print("\n=== TEST 4: Order Creation Timezone Usage ===")
    
    with open("/app/backend/routers/orders.py", "r") as f:
        orders_code = f.read()
    
    # Check imports
    assert "from utils import" in orders_code and "now_local" in orders_code, \
        "now_local not imported in orders.py"
    assert "from utils import" in orders_code and "now_utc" in orders_code, \
        "now_utc not imported in orders.py"
    assert "from utils import" in orders_code and "transaction_seq_key" in orders_code, \
        "transaction_seq_key not imported in orders.py"
    
    # Check order creation uses both
    assert "local_now = now_local()" in orders_code, \
        "Order creation doesn't call now_local()"
    assert "created_at = now_utc()" in orders_code, \
        "Order creation doesn't call now_utc()"
    assert "transaction_seq_key(tid, body.outlet_id, local_now)" in orders_code, \
        "Order creation doesn't use transaction_seq_key with local_now"
    assert "txn_number(tenant[\"code\"], outlet[\"code\"], user[\"code\"], seq, local_now)" in orders_code, \
        "Transaction number doesn't use local_now for timestamp"
    assert '"created_at": created_at' in orders_code, \
        "Order document doesn't use created_at (UTC)"
    
    print("✅ Order creation stores created_at in UTC")
    print("✅ Transaction number timestamp uses WIB (local_now)")
    print("✅ Daily counter key uses WIB date")
    return True


def test_seed_plans_insert_only():
    """Verify seed_plans is insert-only (doesn't update existing plans)."""
    print("\n=== TEST 5: seed_plans is Insert-Only ===")
    
    with open("/app/backend/seed.py", "r") as f:
        seed_code = f.read()
    
    # Check seed_plans function
    assert "async def seed_plans():" in seed_code, "seed_plans function not found"
    
    # Verify it checks for existing and continues (doesn't update)
    assert "existing = await db.subscription_plans.find_one" in seed_code, \
        "seed_plans doesn't check for existing plans"
    assert "if existing:" in seed_code and "continue" in seed_code, \
        "seed_plans doesn't skip existing plans"
    
    # Verify no update operations in seed_plans
    seed_plans_section = seed_code.split("async def seed_plans():")[1].split("async def")[0]
    assert "update_one" not in seed_plans_section and "update_many" not in seed_plans_section, \
        "seed_plans contains update operations"
    
    print("✅ seed_plans is insert-only (skips existing plans)")
    return True


def test_seed_demo_tenant_guard():
    """Verify seed_all only calls seed_demo_tenant when SEED_DEMO_TENANT=true."""
    print("\n=== TEST 6: seed_demo_tenant Guard ===")
    
    with open("/app/backend/seed.py", "r") as f:
        seed_code = f.read()
    
    # Check seed_all function
    assert "async def seed_all():" in seed_code, "seed_all function not found"
    
    # Verify conditional check
    seed_all_section = seed_code.split("async def seed_all():")[1]
    assert 'os.environ.get("SEED_DEMO_TENANT"' in seed_all_section, \
        "seed_all doesn't check SEED_DEMO_TENANT environment variable"
    assert '.lower() == "true"' in seed_all_section, \
        "seed_all doesn't check for explicit 'true' value"
    assert "await seed_demo_tenant()" in seed_all_section, \
        "seed_all doesn't call seed_demo_tenant"
    
    # Verify current environment setting
    with open("/app/backend/.env", "r") as f:
        env_content = f.read()
    
    assert "SEED_DEMO_TENANT=false" in env_content, \
        "SEED_DEMO_TENANT is not set to false in active environment"
    
    print("✅ seed_all only calls seed_demo_tenant when SEED_DEMO_TENANT=true")
    print("✅ Active environment has SEED_DEMO_TENANT=false")
    return True


def login(email, password):
    """Helper to login and return session cookies."""
    resp = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": email, "password": password},
        timeout=10
    )
    assert resp.status_code == 200, f"Login failed: {resp.status_code} {resp.text}"
    return resp.cookies


def test_change_password_authenticated():
    """Verify POST /api/auth/change-password requires authentication."""
    print("\n=== TEST 7: Change Password - Authentication Required ===")
    
    # Try without authentication
    resp = requests.post(
        f"{API_BASE}/auth/change-password",
        json={"current_password": "test", "new_password": "test"},
        timeout=10
    )
    assert resp.status_code == 401, \
        f"Change password should require auth, got {resp.status_code}"
    
    print("✅ Change password endpoint requires authentication")
    return True


def test_change_password_wrong_current():
    """Verify change-password rejects wrong current_password."""
    print("\n=== TEST 8: Change Password - Wrong Current Password ===")
    
    cookies = login(CASHIER_EMAIL, CASHIER_PASSWORD)
    
    resp = requests.post(
        f"{API_BASE}/auth/change-password",
        json={"current_password": "WrongPassword123!", "new_password": "NewPassword123!"},
        cookies=cookies,
        timeout=10
    )
    assert resp.status_code == 401, \
        f"Should reject wrong current password, got {resp.status_code}"
    
    data = resp.json()
    assert "detail" in data, "Error response should have detail"
    assert data["detail"]["code"] == "INVALID_CURRENT_PASSWORD", \
        f"Wrong error code: {data['detail'].get('code')}"
    
    print("✅ Change password rejects wrong current_password")
    return True


def test_change_password_success_and_audit():
    """Verify change-password changes only logged-in user's hash and records audit."""
    print("\n=== TEST 9: Change Password - Success & Audit ===")
    
    # Login as cashier
    cookies = login(CASHIER_EMAIL, CASHIER_PASSWORD)
    
    # Get current user info
    me_resp = requests.get(f"{API_BASE}/auth/me", cookies=cookies, timeout=10)
    assert me_resp.status_code == 200, "Failed to get current user"
    user_data = me_resp.json()
    user_id = user_data["user"]["id"]
    
    # Change password
    new_password = "TempPassword123!"
    resp = requests.post(
        f"{API_BASE}/auth/change-password",
        json={"current_password": CASHIER_PASSWORD, "new_password": new_password},
        cookies=cookies,
        timeout=10
    )
    assert resp.status_code == 200, \
        f"Password change failed: {resp.status_code} {resp.text}"
    
    data = resp.json()
    assert data.get("ok") is True, f"Password change response not ok: {data}"
    
    print("✅ Password change succeeded")
    
    # Verify old password no longer works
    old_login = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": CASHIER_EMAIL, "password": CASHIER_PASSWORD},
        timeout=10
    )
    assert old_login.status_code == 401, \
        "Old password should not work after change"
    
    print("✅ Old password no longer works")
    
    # Verify new password works
    new_login = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": CASHIER_EMAIL, "password": new_password},
        timeout=10
    )
    assert new_login.status_code == 200, \
        f"New password should work: {new_login.status_code}"
    
    print("✅ New password works")
    
    # Change password back to original
    new_cookies = new_login.cookies
    restore_resp = requests.post(
        f"{API_BASE}/auth/change-password",
        json={"current_password": new_password, "new_password": CASHIER_PASSWORD},
        cookies=new_cookies,
        timeout=10
    )
    assert restore_resp.status_code == 200, "Failed to restore original password"
    
    print("✅ Password restored to original")
    
    # Verify audit log was created (check code implementation)
    with open("/app/backend/routers/auth.py", "r") as f:
        auth_code = f.read()
    
    change_password_section = auth_code.split("async def change_password")[1].split("async def")[0]
    assert "log_audit" in change_password_section, \
        "change_password doesn't call log_audit"
    assert '"PASSWORD_SELF_CHANGE"' in change_password_section, \
        "change_password doesn't use PASSWORD_SELF_CHANGE action"
    assert 'user["id"]' in change_password_section, \
        "change_password doesn't log user ID"
    
    print("✅ Audit action PASSWORD_SELF_CHANGE is recorded")
    
    # Verify it only changes logged-in user's password (by checking implementation)
    assert 'user=Depends(get_current_user)' in change_password_section, \
        "change_password doesn't use get_current_user dependency"
    assert 'await db.users.update_one(\n        {"id": user["id"]}' in change_password_section, \
        "change_password doesn't filter by current user's ID"
    
    print("✅ Change password only affects logged-in user")
    
    return True


def test_requirements_prod():
    """Verify requirements-prod.txt excludes development dependencies."""
    print("\n=== TEST 10: Production Requirements ===")
    
    with open("/app/backend/requirements-prod.txt", "r") as f:
        requirements = f.read().lower()
    
    # Check excluded packages
    excluded = ["emergentintegrations", "boto3", "pandas", "numpy", "passlib", "python-jose"]
    for pkg in excluded:
        assert pkg not in requirements, \
            f"requirements-prod.txt should not contain {pkg}"
    
    print(f"✅ requirements-prod.txt excludes: {', '.join(excluded)}")
    
    # Check required packages are present
    required = ["fastapi", "uvicorn", "motor", "pymongo", "pydantic", "pyjwt", "bcrypt", "pytest", "requests"]
    for pkg in required:
        assert pkg in requirements, \
            f"requirements-prod.txt should contain {pkg}"
    
    print(f"✅ requirements-prod.txt includes: {', '.join(required)}")
    
    return True


def test_readme_no_demo_credentials():
    """Verify README no longer exposes demo credentials."""
    print("\n=== TEST 11: README Demo Credentials ===")
    
    with open("/app/README.md", "r") as f:
        readme = f.read()
    
    # Check that demo credentials are not exposed
    assert "GlooPOS2026!" not in readme, "README contains owner password"
    assert "GlooDemo2026!" not in readme, "README contains demo user password"
    assert "satriaayudha19@gmail.com" not in readme, "README contains owner email"
    
    # Verify demo seeding section exists and mentions it's disabled by default
    assert "SEED_DEMO_TENANT" in readme, "README doesn't mention SEED_DEMO_TENANT"
    assert "disabled by default" in readme or "default `false`" in readme, \
        "README doesn't indicate demo seeding is disabled by default"
    
    print("✅ README does not expose demo credentials")
    print("✅ README documents that demo seeding is disabled by default")
    
    return True


def test_rotate_demo_passwords_script_exists():
    """Verify rotate_demo_passwords.py script exists."""
    print("\n=== TEST 12: Password Migration Script ===")
    
    script_path = "/app/backend/rotate_demo_passwords.py"
    assert os.path.exists(script_path), \
        "rotate_demo_passwords.py script not found"
    
    with open(script_path, "r") as f:
        script_code = f.read()
    
    # Verify it's a proper migration script
    assert "async def" in script_code or "def" in script_code, \
        "Script doesn't contain functions"
    assert "password" in script_code.lower(), \
        "Script doesn't appear to handle passwords"
    
    print("✅ rotate_demo_passwords.py script exists")
    print("⚠️  Script was NOT executed (as instructed)")
    
    return True


def main():
    """Run all tests."""
    print("=" * 70)
    print("FASE 0 BACKEND VERIFICATION TEST SUITE")
    print("=" * 70)
    
    tests = [
        ("Backend Health", test_health),
        ("Timezone Helpers", test_timezone_helpers),
        ("Dashboard today_start_utc", test_dashboard_uses_today_start_utc),
        ("Order Creation Timezone", test_order_creation_timezone),
        ("seed_plans Insert-Only", test_seed_plans_insert_only),
        ("seed_demo_tenant Guard", test_seed_demo_tenant_guard),
        ("Change Password Auth", test_change_password_authenticated),
        ("Change Password Wrong Current", test_change_password_wrong_current),
        ("Change Password Success & Audit", test_change_password_success_and_audit),
        ("Production Requirements", test_requirements_prod),
        ("README No Demo Credentials", test_readme_no_demo_credentials),
        ("Password Migration Script", test_rotate_demo_passwords_script_exists),
    ]
    
    passed = 0
    failed = 0
    
    for name, test_func in tests:
        try:
            test_func()
            passed += 1
        except AssertionError as e:
            print(f"❌ FAILED: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ ERROR: {e}")
            failed += 1
    
    print("\n" + "=" * 70)
    print(f"TEST RESULTS: {passed} passed, {failed} failed")
    print("=" * 70)
    
    if failed > 0:
        sys.exit(1)
    
    print("\n✅✅✅ ALL FASE 0 BACKEND TESTS PASSED ✅✅✅\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
