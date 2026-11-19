# AMWEMARI Business Modules — Delivery Blueprint

## Product rule
AMWEMARI is one multi-tenant platform. Each store has one normalized business type and sees a role-aware workspace composed of shared modules plus the modules enabled for that business type. Store data must always be scoped by `store_id`; owner/staff permissions must be enforced in the database, not only hidden in the UI. Super Admin is a separate platform-level role.

## Shared foundation for every business
- Business dashboard: today's sales/income, expenses, gross margin where cost data exists, stock/service workload, receivables, low-stock/expiry alerts, and recent activity.
- Customers and suppliers.
- Products/services catalogue, purchases or input costs, sales/checkout, expenses, cash movements.
- Staff, roles, activity/audit history.
- Reports, exports, settings, backup/restore, language and currency preferences.
- Notifications and approval queues where the workflow requires them.

## Business-specific modules

| Business type | Dedicated modules and core workflows |
|---|---|
| Beverages / Bites | Beverage catalogue, pack-to-unit conversion, crates/empties where applicable, batch/expiry, purchases, counter sales, returns, stock alerts |
| Grocery | Weighted/loose goods, units and pack conversion, batch/expiry, supplier purchases, shrinkage/wastage, checkout |
| General retail | Product catalogue, barcode, variants, stock transfers/adjustments, purchases, sales, returns |
| Clothing / footwear | Size-colour matrix, variant-level stock, barcode/labels, exchanges/returns, seasonal performance |
| Electronics | Serial/IMEI tracking, warranty register, repairs/RMA, supplier warranty claims, accessories and bundles |
| Hardware | Measurement units, length/area/volume conversions, cut-to-size sales, project quotations, bulk purchases |
| Motorcycles | One-vehicle-per-record inventory, chassis/engine/registration, test drives, quotations, deposits/installments, delivery and ownership handover |
| Vehicles | VIN/chassis and engine register, inspection, test drives, leads, quotations, deposits/installments, handover and documents |
| Restaurant | Menu, recipes/ingredients, kitchen tickets, table/takeaway orders, modifiers, wastage, shifts and daily close |
| Pharmacy | Medicine catalogue, batch/lot and expiry, FEFO issue workflow, prescription/dispensing records where legally appropriate, controlled audit trail |
| Auto parts | Part number, OEM/cross-reference, make-model-year fitment, bin/location, compatibility lookup, returns |
| Salon / beauty | Service catalogue, staff skills, appointments, walk-ins, customer history, commissions, packages and product sales |
| Furniture | Made-to-order jobs, dimensions/materials, production stages, deposits/balances, delivery and installation |
| Stationery | SKU/barcode, school/company accounts, quotations, bulk orders, seasonal demand and stock |
| Agriculture | Farm/field register, crop cycles, planting calendar, input usage, labour, harvest, produce sales and cost per cycle |
| Livestock | Animal/herd register, identification, breeding, vaccinations/treatments, feed, mortality, weight and sales |
| Construction / contractors | Projects, BOQ/estimates, materials issued, labour/subcontractors, milestones, site expenses, progress and client invoices |
| Services | Service catalogue, bookings/work orders, assigned staff, time tracking, customer sign-off and invoices |
| Other | Configurable catalogue, custom fields, sales/expenses, customers/suppliers and reports |

## Role and privacy rules
- Store owner: all modules and reports for their own store.
- Manager: only modules and actions granted by the owner.
- Cashier: checkout and permitted customer/sales functions; no sensitive settings or full financial reports by default.
- Stock controller: inventory, receiving and adjustments within granted permissions.
- Service worker: assigned appointments/jobs only, unless granted broader access.
- Super Admin: platform-wide account and subscription administration; business transaction access must be explicit and audited.
- Every query and write must be scoped to the authenticated user's store membership. Hiding a tab is not authorization.

## Delivery sequence
1. Foundation and safety: confirm the existing live schema, preserve current products/sales/staff/subscriptions, add role permissions and reusable customer/supplier/service primitives.
2. Shared dashboard and navigation: render modules based on normalized business type and role; do not expose unfinished modules as active.
3. Retail and stock industries: beverages, grocery, retail, clothing, electronics, hardware, pharmacy, auto parts, stationery.
4. Vehicle industries: motorcycles and cars, including vehicle-level inventory and handover.
5. Service and hospitality: restaurant, salon, general services, furniture production/orders.
6. Operations industries: agriculture, livestock and construction projects.
7. Verification: test each business type with isolated owner/staff accounts, RLS checks, sales/purchases, reports, offline behaviour and mobile layout before production release.

## Release rule
All work stays on a preview branch until build checks and end-to-end tests pass. No production merge/deployment and no destructive database changes as part of the module rollout without a separate verified migration and explicit approval.

## Preview progress snapshot — 2026-11-14

This section records verified implementation scope, not a production release claim.

- The preview frontend contains 19 canonical business profiles and legacy type normalization.
- A 19-entry business workspace registry now drives the Operations tab label, visibility of supplier/appointment/job/project panels, and business-specific dashboard headings.
- The owner dashboard now requests store-scoped counts for customers and suppliers, plus appointments, jobs, or projects only when enabled for that business type.
- The shared Operations page currently supports create/list flows for suppliers, appointments, service jobs, and projects. Editing records, workflow status transitions, staff assignment, and richer industry-specific processes remain outstanding.
- Supabase already contains the shared customer/supplier/service/project tables. Current inspection confirms RLS is enabled and member/owner policies exist; same-store foreign keys protect customer and appointment references. No database migration was required for this frontend increment.
- Automated source-level tests cover the 19 workspace mappings. Browser/E2E testing and two-tenant isolation testing have not yet been completed, so these modules are not declared production-ready.
- The preview branch remains divergent from main; reconcile branch history before considering a merge. No production merge or deployment is authorized by this roadmap.

## Preview progress snapshot — 2026-11-16

- Added owner-only customer editing to the shared Customers panel. The edit lookup and update both constrain by the active `store_id`; the existing database owner-update policy remains the enforcement boundary.
- No customer delete action was added. The current customer row count was inspected before the change; no customer records were modified by this development task.
- The preview JavaScript scripts and test file pass syntax parsing; the 13 source-level test assertions pass in an isolated JavaScript harness. This is not a GitHub Actions or browser/E2E result.
- Supabase schema and policies were inspected before this UI-only increment. No migration or database write was performed.
- Browser interaction and two-tenant isolation testing remain outstanding. The latest PR head has no reported GitHub status contexts or PR workflow runs from the available GitHub check endpoints, and Cloudflare Preview status could not be independently confirmed for this head.
- Branch reconciliation remains blocked by divergence from `main`; do not merge or deploy until the changes are reconciled and the required checks pass.


## Preview progress snapshot — 2026-11-17

- Added a local customer-list search for name, phone, and email. It filters only the already-loaded, store-scoped customer rows and performs no database writes.
- The search UI explicitly remains a presentation filter; the existing query limit of 100 rows is unchanged. Server-side search/pagination is a separate follow-up.
- Added source-level regression assertions for the search field, filter keys, input handler, and no-delete behavior.
- No Supabase migration or data write was performed. Current Supabase management/schema inspection was unavailable in this run, so no schema-dependent changes were attempted.
- Current PR head checks returned no workflow runs/status contexts; Cloudflare Preview for the head is unconfirmed. Browser/E2E and two-tenant isolation tests remain outstanding.
- Live/main were not changed; no merge or production deployment was performed.


## Preview progress snapshot — 2026-11-18

- Added explicit customer-list pagination in 100-row pages. The first and subsequent page queries both constrain by the active `store_id`; loading another page is guarded by the existing owner check.
- Customer search remains a local filter over rows already loaded. The UI now makes that scope visible and allows loading more rows rather than silently stopping at the first 100.
- Added source-level regression assertions for pagination, store scoping, and owner gating. No database schema, RLS policy, migration, or stored record was changed.
- Browser/E2E and two-tenant isolation tests remain outstanding; this is not a production-complete module.


## Preview progress snapshot — 2026-11-19

- Added owner-only supplier editing to the shared Suppliers panel, including the already-existing `suppliers.notes` field. The edit lookup and update both constrain by the active `store_id`; `requireOperationsOwner()` is the UI guard and the existing `suppliers_update_owner` RLS policy remains the database enforcement boundary.
- Read-only Supabase inspection confirmed `suppliers.store_id` is NOT NULL; the table has the expected contact, address, tax number, notes and active-state columns. Existing RLS policies allow member SELECT/INSERT and owner UPDATE/DELETE through `private.is_store_member` and `private.is_store_owner`. The owner helper checks owner identity, active store/subscription and the delete-pending gate.
- The supplier table contained 0 rows at inspection. No supplier/customer/business records were changed, and no database migration was required or applied.
- Added source-level regression assertions for the owner guard, store-scoped edit lookup/update, and absence of a supplier delete operation. Browser/E2E and two-tenant isolation tests remain outstanding; this module is not declared production-ready.
- Current preview head before this increment was `d3c028327434b6d0ae6ebccc330eb0805c9a247e`. GitHub comparison against current `main` showed 42 commits ahead and 111 behind. PR #1 remains open, draft and unmerged. The Cloudflare Workers build check on that head was `failure`; no successful Preview was verified.
- All changes in this snapshot are confined to `multi-business-preview`. No merge, production deployment, live-app change or database write was performed.
