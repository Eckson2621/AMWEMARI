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
