ROLES = ["OWNER", "MANAGER", "CASHIER", "STAFF", "KITCHEN"]

ROLE_PERMISSIONS = {
    "PLATFORM_ADMIN": {"platform.admin"},
    "OWNER": {"*"},
    "MANAGER": {
        "dashboard.view",
        "pos.use",
        "orders.view",
        "orders.void",
        "reports.view",
        "catalog.manage",
        "outlets.view",
        "users.view",
        "payments.manage",
        "tax.manage",
        "shifts.use",
        "shifts.manage",
        "settings.manage",
        "subscription.view",
        "discounts.manage",
        "discounts.manual",
        "kitchen.view",
        "audit.view",
    },
    "CASHIER": {
        "dashboard.view",
        "pos.use",
        "orders.view",
        "shifts.use",
        "subscription.view",
    },
    "STAFF": {"orders.view", "subscription.view"},
    "KITCHEN": {"kitchen.view"},
}


def has_permission(role: str, perm: str) -> bool:
    perms = ROLE_PERMISSIONS.get(role, set())
    return "*" in perms or perm in perms


def permissions_for(role: str):
    return sorted(ROLE_PERMISSIONS.get(role, set()))
