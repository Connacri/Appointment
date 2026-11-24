# CRUD / Data Model / Supabase Audit

Baseline: `main` at `5d0bb4f3c605f56e350c8bdd0acd8820da7ac1f9` (2026-11-24). Revalidated against the current AppContext, IndexedDB adapter, Supabase repository/sync runner, generated database types, and current P2P protocol. Static code-path audit; not a claim of successful runtime replication.

## Revalidation notes (2026-11-24)

- The recent booking fix classifies demo bookings by booking ID rather than by the resource they occupy. It prevents a real booking on a demo/bootstrap resource from being filtered as demo data; it does not close the other entity CRUD gaps below.
- Direct localStorage persistence remains present in `src/context/AppContext.tsx`: task create/status/subtask/delete; stock item create/update/delete and stock movement ledger; supplier and purchase-order mutations; dynamic-rate mutations; staff mutations; establishment profile; invoice creation. These paths are not equivalent to the transactional IndexedDB Outbox/P2P write path.
- The current `src/services/supabase/supabaseSync.ts` dispatches task and stock-item **upserts only**. It has booking/resource delete dispatch, but no invoice dispatch and no task/stock-item delete dispatch. The `invoice` Outbox union member and IndexedDB invoice store therefore must not be mistaken for a working invoice sync pipeline.
- The current P2P protocol validates event identity, causal clocks, payload size and cursor monotonicity. LAN discovery advertises peer UUID/name only; it is not authenticated transport, workspace authorization, or replication. There is no verified end-to-end P2P business transport in the release gate.
- Current GitHub Actions evidence: Quality Checks and Web Deploy succeeded on `5d0bb4f3`; the Windows Rust workflow and full unsigned-Windows release workflow succeeded on `594e6f6b`. These are build/test signals only and do not demonstrate CRUD or multi-device convergence.

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
