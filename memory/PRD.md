# GLOO POS — Product Requirements & Progress

## Original problem statement
Professional multi-tenant F&B POS PWA (subscription-based SaaS, offline-first, transaction-safe, production-ready). Architecture: PLATFORM → TENANT → SUBSCRIPTION (plan/features/limits) → USERS/ROLES → OUTLETS → POS → Orders/Payment/Receipt → Inventory → Kitchen → Reports. Spec requests Next.js/TS/PostgreSQL/Prisma; **user approved building on the platform stack: React + FastAPI + MongoDB**, faithfully implementing the full architecture.

## User choices (2026-09-05)
- Stack: React + FastAPI + MongoDB
- Iteration 1 scope: auth, multi-tenant, subscription/entitlement engine, plans seed, platform admin basics, outlets, users/RBAC, catalog, shifts, POS, orders, payments, receipts, transaction numbers, dashboard, settings, subscription page
- PWA: manifest + installable + online/offline indicator now; IndexedDB sync next iteration
- Demo seed: GLOO Demo tenant + PRO plan + Owner/Manager/Cashier/Kitchen + catalog
- Design: dark professional POS theme
- Owner account: satriaayudha19@gmail.com (real user email)

## User personas
- PLATFORM_ADMIN (GLOO operator): manages tenants, plans, subscription lifecycle
- OWNER: full tenant management within subscription
- MANAGER: operations, catalog, reports, voids, shifts
- CASHIER: POS, orders, own shift (outlet-scoped)
- KITCHEN/STAFF: deferred screens

## Architecture (implemented)
- FastAPI routers per domain; `entitlements.py` centralized subscription engine; `permissions.py` centralized RBAC; `security.py` JWT httpOnly cookie auth + outlet authorization; integer minor-unit money + Decimal rounding; atomic counter sequences; idempotency via unique (tenant, client_transaction_id); concurrency-safe limits via atomic conditional increments on tenant counters; audit logs; journal entries.
- Frontend: React + Tailwind + shadcn, AuthContext/PosContext, permission+feature-gated nav, POS screen (grid/cart/payment/receipt), dark theme.

## Implemented (2026-09-05, iteration 1)
- Auth: login/logout/refresh/me, bcrypt, brute-force lockout, reset tokens, httpOnly cookies
- Multi-tenant isolation (server-derived tenant everywhere) + outlet authorization
- Subscription: FREE/BASIC/PRO/ENTERPRISE seed, feature flags, outlet/user limits (NULL=unlimited), status lifecycle (TRIALING…EXPIRED), usage, history; suspension/expiration blocks features server-side
- Platform admin: tenants list/create, plan editor (features/limits/price), subscription change with history
- Catalog: categories, products (code/SKU/barcode), variant groups, modifier groups, prices, discounts
- Operations: payment methods, tax (incl/excl), service charge, shifts (open/cash in-out/close with expected/actual/variance), daily journal
- POS: catalog bundle, barcode wedge scanning, variant/modifier modal, cart, discount select, server-authoritative totals, payment with cash change, receipt + print CSS, void (permission-gated)
- Transaction numbers: T001-O01-U003-YYYYMMDD-HHMMSS-000001 (server, atomic, unique)
- Dashboard: real today stats, payment summary, top products, recent orders, shift status
- Settings: outlet profile, hardware (printer/scanner), receipt footer + txn format, subscription page, account
- PWA: manifest, icons, service worker (app shell), online/offline badge
- Tests: 27/27 custom acceptance + 13/13 backend smoke + 14 frontend flows via testing agent

## Deferred (backlog)
- P0 (next iteration): Inventory (ingredients, recipes/BOM, stock movements, deduction on order), Kitchen display, full offline-first (IndexedDB catalog cache + sync queue + entitlement snapshot + reconciliation)
- P1: Reports page (sales/orders/products/payments/discounts/shift/inventory aggregation views), low-stock alerts on dashboard, audit log viewer UI, order refund flow, outlet-specific prices
- P2: Native thermal printer integration (ESC/POS), email delivery for password reset (Resend), subscription billing provider (Stripe), multi-language, table management

## Known notes
- Service worker registers only in production build (by design)
- ReceiptSettings page performs two harmless prefetch calls
- Test artifacts from QA may exist (test category, voided order)

## Next tasks
1. Inventory + recipe deduction (idempotent)
2. Kitchen display page + KITCHEN role screens
3. Offline sync queue (IndexedDB) + entitlement cache revalidation
4. Reports page
