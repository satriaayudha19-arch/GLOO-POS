# GLOO POS

Professional multi-tenant F&B POS SaaS — subscription-based, feature-gated, limit-aware, role-authorized, transaction-safe. Built on **React + FastAPI + MongoDB** (PWA).

## Architecture

```
PLATFORM (platform admin: tenants, plans, subscription lifecycle)
  └── TENANT (strict server-side isolation; tenantId is NEVER trusted from the client)
        ├── SUBSCRIPTION → PLAN → FEATURE ENTITLEMENTS + RESOURCE LIMITS (NULL = unlimited)
        ├── BRAND
        └── USERS → ROLE/PERMISSIONS → USER OUTLET → OUTLET → POS
              └── ORDERS → PAYMENT → RECEIPT → JOURNAL → DASHBOARD
```

Every protected request passes: Authentication → Tenant Resolution → Subscription Resolution → Feature Entitlement → Role Permission → Outlet Authorization → Input Validation → Business Logic.

### Backend modules (`/app/backend`)
- `security.py` — bcrypt hashing, JWT (httpOnly cookies + Bearer fallback), `get_current_user`, `require_permission`, `assert_outlet_access`
- `permissions.py` — centralized role → permission map (OWNER/MANAGER/CASHIER/STAFF/KITCHEN/PLATFORM_ADMIN)
- `entitlements.py` — centralized subscription engine: status lifecycle (TRIALING/ACTIVE/PAST_DUE/GRACE_PERIOD/SUSPENDED/CANCELLED/EXPIRED), `require_feature(code)`, concurrency-safe `enforce_limit` via atomic conditional counter increment
- `routers/` — auth, subscription, outlets, users, catalog (categories/products/variant-groups/modifier-groups/discounts + POS catalog bundle), operations (payment-methods, tax, service-charge), shifts (+ journal), orders, dashboard, platform, settings
- `seed.py` — idempotent seed: 4 plans and platform admin; optional development demo tenant is controlled by `SEED_DEMO_TENANT=true`

### Money & transaction integrity
- Integer minor units everywhere; percentage math via Decimal half-up. Server computes all prices, discounts, tax, service, totals, change — client input is never authoritative.
- Transaction number: `T{TENANT}-O{OUTLET}-U{USER}-{YYYYMMDD}-{HHMMSS}-{SEQ:06d}` — server-generated, sequence via atomic counter per tenant+outlet+day, unique index enforced.
- Idempotency: every order carries `client_transaction_id` (UUID); unique index on (tenant, client_transaction_id). Retries return the existing order (`duplicate: true`). No duplicate orders/payments.
- Shifts: one open shift per cashier+outlet (unique sparse `open_key`), cash in/out, close computes expected cash & variance; all movements journaled.
- Audit log for sensitive actions (logins, price/discount changes, user changes, shift close, voids, subscription changes). Orders are never deleted — void only.

### PWA
- `public/manifest.json` (installable), `public/sw.js` (offline app shell, network-first with cache fallback, API calls never intercepted), online/offline indicator in header.
- Full IndexedDB offline transaction sync is scheduled for the next iteration.

## Environment variables
- `backend/.env`: `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `JWT_SECRET`, `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD`, `SEED_DEMO_TENANT` (default `false`)
- `frontend/.env`: `REACT_APP_BACKEND_URL`

## Demo environment
Demo tenant seeding is disabled by default. For development only, set `SEED_DEMO_TENANT=true` together with `SEED_DEMO_OWNER_PASSWORD` and `SEED_DEMO_USER_PASSWORD`. Do not enable demo seeding in production.

## Plans (seeded, configurable via Platform → Plans)
| Feature | FREE | BASIC | PRO | ENTERPRISE |
|---|---|---|---|---|
| POS / Orders / Reports / Offline POS / Receipt Printing | ✓ | ✓ | ✓ | ✓ |
| Inventory / Kitchen / Multi Outlet / Discounts / Barcode / Audit | — | ✓ | ✓ | ✓ |
| Advanced Reports | — | — | ✓ | ✓ |
| Outlets / Users | 1 / 2 | 3 / 10 | 10 / 50 | unlimited |

## Local development
```
sudo supervisorctl restart backend frontend   # services are supervisor-managed, hot-reload enabled
curl http://localhost:8001/api/health
```

## Implemented (iteration 1) vs deferred
**Implemented:** auth (login/logout/refresh/brute-force lockout/password reset tokens), multi-tenant isolation, subscription engine + plan seed + history + usage, platform admin (tenants/plans/subscription lifecycle), outlets, users & RBAC, full catalog, payment methods, tax & service, shifts + journal, POS (variants/modifiers/discounts/barcode-scan/cash change), orders + void + reprint, receipts + print CSS, transaction numbering, dashboard, settings (outlet profile, hardware, receipt, subscription, account), PWA foundation.

**Deferred (next iterations):** inventory + recipes, kitchen display, reports page, full offline-first IndexedDB sync queue, billing provider integration.
