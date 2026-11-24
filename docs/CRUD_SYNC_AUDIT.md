# CRUD / Data Model / Supabase Audit

Baseline: main at e69b5075506add8049d404ec42ab612fc865e04b. Static code-path audit; not a claim of successful runtime replication.

## Required invariant
Every business Create/Read/Update/Delete must use a typed domain repository scoped to workspace and establishment. A local mutation must atomically update the local projection, version, Outbox, tombstone (delete), and P2P event. Supabase push requires an entity/version acknowledgement; pull must preserve newer local pending mutations. UI state/localStorage are not business persistence layers.

## Coverage matrix

| Domain / panel | Current local path | Supabase path | Finding |
|---|---|---|---|
| Bookings / Planning | IndexedDB bookings + Outbox/tombstones | bookings + booking_payments; repository CRUD; sync push/pull/delete | Partial: best-covered entity; P2P transport and all nested payment mutations still require end-to-end tests |
| Buildings / resource groups | IndexedDB resourceGroups + Outbox | resource_groups repository and sync | Partial; verify deletes and every setup-panel write path |
| Rooms / resources | IndexedDB resources + Outbox; housekeeping uses putWithOutbox | resources repository; sync upsert/delete | Partial; audit every resource editor path |
| Tasks / housekeeping tasks | localStorage omnibook_pms_tasks | pms_tasks table/repository; sync upsert only | Critical: AppContext create/update/subtask/delete handlers write localStorage and do not enqueue; no task delete dispatch |
| Stock items | localStorage omnibook_stock_items | stock_items repository; sync upsert only | Critical: handlers do not enqueue; no delete dispatch |
| Stock movements | localStorage omnibook_stock_movements | stock_movements table; repository insert helper | Critical: no Outbox entity, no complete read/pull/replication ledger |
| Suppliers | localStorage omnibook_stock_suppliers | No matching table/repository found | Critical: local-only |
| Purchase orders | localStorage omnibook_purchase_orders | No matching table/repository found | Critical: local-only |
| Invoices / quotes / proformas | localStorage omnibook_invoices; IndexedDB invoices store exists | invoices + invoice_items tables exist | Critical: Outbox union has invoice, but sync dispatch/repository CRUD is missing; split local persistence paths |
| Dynamic pricing | localStorage omnibook_dynamic_rates | dynamic_rates table; repository list only | Critical: no mutation Outbox/push/delete or complete pull merge |
| HR / staff | localStorage omnibook_staff_members | No dedicated staff table in generated types | Critical: local-only |
| Roles / permissions | AppContext/browser storage | No workspace role CRUD contract found | Decide explicitly device-local vs workspace-shared; currently not replicated |
| Establishment profile | localStorage omnibook_establishment_profile | establishments repository and Outbox upsert exist | Critical: setEstablishmentProfile writes local-only, competing with cloud repository path |
| Channel Manager | Component React useState, seeded initial data | No channel tables/repository | Critical/demo-only: resets on remount/reload; not persisted |
| Spa | Component React useState for appointments/facilities/therapists/treatments | No spa tables/repository | Critical/demo-only: not persisted |
| Event/audit log | IndexedDB eventLogs | audit_events table exists | Partial: local audit trail has no complete cloud sync contract |
| CardLock issued cards/device audit | lockManager + IndexedDB issuedCards/MDB | Not shared PMS entity | Device-local may be intentional; shared revocation requires separate contract |

## Cross-layer evidence

- IndexedDB schema version 8 has business stores bookings, invoices, resources, resourceGroups. Outbox entity union: booking, resource, resource_group, establishment, task, stock_item, invoice. A store/union member alone does not establish CRUD wiring.
- Supabase generated tables include audit_events, booking_payments, bookings, dynamic_rates, establishments, guests, invoice_items, invoices, pms_tasks, profiles, resource_groups, resources, stock_items, stock_movements, workspace_members, workspaces.
- Supabase repository exports workspace, establishment, resource-group, resource, booking, task, stock-item, stock-movement insert, dynamic-rate list methods. No invoice, staff, supplier, purchase-order, channel, or spa CRUD methods were found.
- runSupabaseSync dispatches booking/resource/resource_group/establishment/task/stock_item. Task and stock-item are upsert-only; booking/resource have delete handling. Invoice and dynamic-rate dispatch are absent.
- AppContext still directly persists several business collections in localStorage. This bypasses transactional Outbox, tombstones, workspace isolation, P2P event creation, and cloud acknowledgements.
- Channel Manager and Spa keep business records in component useState only.
- Some Supabase tables have no complete app repository/sync path; some UI models have no matching Supabase table.

## Safe implementation order

1. Protect data: no destructive reset or cleanup. Inventory/checksum legacy localStorage; migrate idempotently and resumably to IndexedDB, preserving IDs, tenant ownership and timestamps.
2. Add typed domain repositories/commands for every business entity. Route every panel CRUD through them; component state becomes transient only.
3. Atomically commit projection + version + Outbox + P2P event; deletes create tombstones. Model stock movements as immutable ledger entries.
4. Add missing Supabase schema/RLS only after tenant ownership, foreign keys and retention policies are specified. Implement mapper, read/upsert/delete/tombstone, cursor, conflict and acknowledgement paths.
5. Reuse the same versioned domain event envelope for P2P; apply idempotently in transactions and persist peer cursors/frontiers.
6. Add panel-by-panel tests for create/read/update/delete, reload, offline/reconnect, peer apply, cloud push/pull, conflict, duplicate delivery, crash recovery and workspace isolation.

## Release gate

Do not declare CRUD synchronization complete until each entity has an owner scope, schema/model, version, delete policy, mapper, local transaction, Outbox, P2P apply, Supabase push/pull, migration, RLS and regression tests. Verify parent/child integrity for bookings/resources/establishments, invoices/items/payments, tasks/stock consumption, and suppliers/orders/movements.

Audit status: **NOT READY for full CRUD replication**. This is an architectural audit; no production records were modified.
