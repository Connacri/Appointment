# CRUD / Data Model / Supabase Audit

Baseline: `main` at `39358a80e23cceef181b3b0b24e51e4fe66d6abf` (2026-11-26). Revalidated against the current AppContext, IndexedDB adapter, Supabase repository/sync runner, generated database types, native SQLite adapters, and P2P event protocol. Static code-path audit; not a claim of successful runtime replication.

## Revalidation notes (2026-11-26)

- The recent booking fix classifies demo bookings by booking ID rather than by the resource they occupy. It prevents a real booking on a demo/bootstrap resource from being filtered as demo data; it does not close the other entity CRUD gaps below.
- Direct localStorage persistence remains present in `src/context/AppContext.tsx`: task create/status/subtask/delete; stock item create/update/delete and stock movement ledger; supplier and purchase-order mutations; dynamic-rate mutations; staff mutations; establishment profile; invoice creation. These paths are not equivalent to the transactional IndexedDB Outbox/P2P write path.
- The current `src/services/supabase/supabaseSync.ts` dispatches task and stock-item **upserts only**. It has booking/resource delete dispatch, but no invoice dispatch and no task/stock-item delete dispatch. Invoice is deliberately excluded from the Supabase Outbox until a real push dispatcher and complete repository contract exist; the IndexedDB invoice store alone is not a sync pipeline.
- The P2P protocol now has a 13-entity registry, separate from the six-entity Supabase Outbox registry. This prevents P2P-only entities from being enqueued into a cloud dispatcher that cannot process them. TypeScript and Rust validate the expanded P2P registry; this is protocol groundwork only, not CRUD integration. LAN discovery advertises peer UUID/name only; it is not authenticated transport, workspace authorization, or replication. There is no verified end-to-end P2P business transport in the release gate.
- Current GitHub Actions evidence on this audit baseline: Quality Checks, including the new P2P mutation-boundary gate, and Web Deploy succeeded. The protocol-change Windows Rust, Android and release workflows were still running at the time of the latest status check. Build/test success does not demonstrate CRUD completeness or multi-device convergence.

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
| Stock movements | localStorage omnibook_stock_movements | stock_movements table; repository insert helper | Critical: P2P event type is registered, but no typed CRUD mutation, canonical local projection or complete read/pull ledger is wired |
| Suppliers | localStorage omnibook_stock_suppliers | No matching table/repository found | Critical: P2P event type is registered, but no typed CRUD mutation or local P2P projection is wired |
| Purchase orders | localStorage omnibook_purchase_orders | No matching table/repository found | Critical: P2P event type is registered, but no typed CRUD mutation or local P2P projection is wired |
| Invoices / quotes / proformas | localStorage omnibook_invoices; IndexedDB invoices store exists | invoices + invoice_items tables exist | Critical: invoice remains localStorage-backed; no cloud Outbox dispatcher or transactional CRUD path is enabled |
| Dynamic pricing | localStorage omnibook_dynamic_rates | dynamic_rates table; repository list only | Critical: P2P event type is registered, but no typed CRUD mutation, Outbox/push/delete or complete pull merge |
| HR / staff | localStorage omnibook_staff_members | No dedicated staff table in generated types | Critical: P2P event type is registered, but no typed CRUD mutation or local P2P projection is wired |
| Roles / permissions | AppContext/browser storage | No workspace role CRUD contract found | Decide explicitly device-local vs workspace-shared; currently not replicated |
| Establishment profile | localStorage omnibook_establishment_profile | establishments repository and Outbox upsert exist | Critical: setEstablishmentProfile writes local-only, competing with cloud repository path |
| Channel Manager | Component React useState, seeded initial data | No channel tables/repository | Critical/demo-only: resets on remount/reload; not persisted |
| Spa | Component React useState for appointments/facilities/therapists/treatments | No spa tables/repository | Critical/demo-only: not persisted |
| Event/audit log | IndexedDB eventLogs | audit_events table exists | Partial: local audit trail has no complete cloud sync contract |
| CardLock issued cards/device audit | lockManager + IndexedDB issuedCards/MDB | Not shared PMS entity | Device-local may be intentional; shared revocation requires separate contract |


## P2P-specific revalidation (2026-11-26)

- The event log, vector-clock merge, per-record causal frontier and transactional inbound-batch APIs exist in both IndexedDB and native SQLite. They are persistence primitives, not an end-to-end replication service.
- Windows Rust and Android Kotlin still implement UDP multicast presence discovery only. No authenticated application transport, pairing, workspace authorization, event exchange loop, durable transport ACK, anti-entropy session or peer retry scheduler is wired to the batch-apply APIs. The Windows UI explicitly reports that business transport is not enabled.
- The inbound projection resolves concurrency only for the same `(workspace, entity, entityId)`. It does not enforce cross-record business invariants. Two distinct booking IDs can therefore be individually causally resolved while overlapping the same room/date interval. Stock aggregate constraints have the same class of risk.
- IndexedDB inbound application accepts the P2P registry. Operational projections exist only for bookings, resources, invoices and resource groups; the other entity types are stored in `workspaceEntities`. This generic inbound projection is not proof that their CRUD workflows, parent relationships or UI hydration are complete. Cloud Outbox acceptance is a separate six-entity contract.
- The generic native entity-record storage API accepts string entity names for its unreplicated import path. Local replicated writes pass through P2P event validation and must use the canonical singular registry names (`resource`, not `resources`). Native regression tests now use the same registry as IndexedDB.
- TypeScript and Rust now enforce the same 13-entity P2P v1 registry, matching node/entity identity limits, the 256-node vector-clock limit, and the same strict RFC 3339 timestamp subset (commits `cde0591`, `4e28e0c`, `72bfb8e`, `39358a8`). The TypeScript Supabase Outbox registry is separately limited to six dispatched entities. Both runtimes have regression coverage. A shared cross-language fixture harness remains desirable; the two test suites are still maintained separately.
- Native booking projection validates a booking document but does not query other bookings for room/date overlap. IndexedDB projection similarly applies a resolved record without a cross-record reservation constraint. The selected offline policy therefore requires a separate domain-invariant/conflict layer; vector clocks alone cannot implement it.
- The localStorage business-data bypasses listed in the matrix remain present. A CI diff gate now rejects new direct business-key `localStorage.setItem` writes, but it does not migrate or certify the existing legacy paths.
- No production P2P claim is justified until authenticated transport, complete CRUD coverage, cross-record conflict handling, anti-entropy, recovery and real multi-device convergence tests pass.

## Selected offline policy

Appointment uses **offline operation with protection of critical operations and strict business rules**. Local validation is necessary but not a global exclusivity guarantee. During a network partition, an offline device cannot know whether another disconnected replica has accepted a conflicting booking, stock deduction or financial operation. Critical actions must therefore be represented as provisional until the required reconciliation/authority condition is met; they must never be silently promoted to globally confirmed based only on local state.

## Cross-layer evidence

- IndexedDB schema version 8 has business stores bookings, invoices, resources, resourceGroups. Supabase Outbox registry: booking, resource, resource_group, establishment, task and stock_item. P2P peer registry is broader (13 entities). A store or registry member alone does not establish CRUD wiring.
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

Audit status: **NOT READY for full CRUD replication or production P2P**. This is an architectural audit; no production records were modified.


## Phase 1 progress (2026-11-26)

- Completed foundation: separated the 13-entity peer-event registry from the six-entity Supabase Outbox registry. The Outbox is intentionally limited to entities with implemented push dispatchers; invoice is no longer advertised as cloud-push-capable.
- TypeScript and Rust P2P validation tests now assert the same expanded peer entity list. This change does not migrate AppContext localStorage CRUD paths and does not make these entities operationally replicable yet.
- Remaining Phase 1 work: transactional local repositories and resumable legacy migration for tasks, stock items/movements, suppliers, purchase orders, invoices, dynamic rates, staff and establishment profile; then CRUD-level failure/rollback and restart tests.
