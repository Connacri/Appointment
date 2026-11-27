# CRUD / Data Model / Supabase Audit

Baseline: `main` at `3f28b5b5033fc617713b3bf79a6a648bb08ff464` (2026-11-26). Revalidated against the current AppContext, IndexedDB adapter, Supabase repository/sync runner, generated database types, native SQLite adapters, and P2P event protocol. Static code-path audit; not a claim of successful runtime replication.

## Revalidation notes (2026-11-26)

- The recent booking fix classifies demo bookings by booking ID rather than by the resource they occupy. It prevents a real booking on a demo/bootstrap resource from being filtered as demo data; it does not close the other entity CRUD gaps below.
- Direct localStorage mirrors remain in `src/context/AppContext.tsx`. Task, stock, supplier, purchase-order, staff and establishment-profile mutations now enqueue to the generic IndexedDB Outbox/P2P projection when a cloud workspace is active; dynamic rates and invoices remain local-only.
- `supabaseSync.ts` now dispatches task and stock-item upserts/deletes, append-only stock movements, suppliers, purchase orders, staff members and establishment profiles. Suppliers, purchase orders and staff have workspace-scoped tables/repositories. Invoice and dynamic_rate remain deliberately excluded from Supabase Outbox pending atomic/conflict-safe operations.
- The P2P protocol has a 13-entity registry, separate from the 11-entity Supabase Outbox registry. This prevents P2P-only entities from being enqueued into a cloud dispatcher that cannot process them. TypeScript and Rust validate the expanded P2P registry; this is protocol groundwork only, not CRUD integration. LAN discovery advertises peer UUID/name only; it is not authenticated transport, workspace authorization, or replication. There is no verified end-to-end P2P business transport in the release gate.
- Current GitHub Actions evidence on this audit baseline: Quality Checks, including the new P2P mutation-boundary gate, and Web Deploy succeeded. The protocol-change Windows Rust, Android and release workflows were still running at the time of the latest status check. Build/test success does not demonstrate CRUD completeness or multi-device convergence.

## Required invariant
Every business Create/Read/Update/Delete must use a typed domain repository scoped to workspace and establishment. A local mutation must atomically update the local projection, version, Outbox, tombstone (delete), and P2P event. Supabase push requires an entity/version acknowledgement; pull must preserve newer local pending mutations. UI state/localStorage are not business persistence layers.

## Coverage matrix

| Domain / panel | Current local path | Supabase path | Finding |
|---|---|---|---|
| Bookings / Planning | IndexedDB bookings + Outbox/tombstones | bookings + booking_payments; repository CRUD; sync push/pull/delete | Partial: best-covered entity; P2P transport and all nested payment mutations still require end-to-end tests |
| Buildings / resource groups | IndexedDB resourceGroups + Outbox | resource_groups repository and sync | Partial; verify deletes and every setup-panel write path |
| Rooms / resources | IndexedDB resources + Outbox; housekeeping uses putWithOutbox | resources repository; sync upsert/delete | Partial; audit every resource editor path |
| Tasks / housekeeping tasks | legacy localStorage mirror + IndexedDB workspaceEntities/Outbox/P2P event | pms_tasks typed repository; upsert + soft-delete + tombstone pull | Partial: mutation enqueue exists on active cloud workspace; UI enqueue is fire-and-forget and local P2P identity remains cloud-dependent |
| Stock items | legacy localStorage mirror + IndexedDB workspaceEntities/Outbox/P2P event | stock_items typed repository; upsert + soft-delete + tombstone pull | Partial: quantity changes are represented by stock movements; UI enqueue is fire-and-forget |
| Stock movements | legacy localStorage mirror + IndexedDB workspaceEntities/Outbox/P2P event | append-only ledger; atomic apply_stock_movement RPC; paginated read | Partial: cloud ledger insert and stock balance projection are atomic; opening balance/adjustment mutations enqueue movement events |
| Suppliers | legacy localStorage mirror + IndexedDB workspaceEntities/Outbox/P2P event | stock_suppliers typed repository; RLS; soft-delete; Realtime; tombstone pull | Partial: CRUD enqueue/push/pull is connected; same-establishment supplier reference enforced for stock and orders |
| Purchase orders | legacy localStorage mirror + IndexedDB workspaceEntities/Outbox/P2P event | purchase_orders typed repository; RLS; soft-delete; Realtime; tombstone pull | Partial: line snapshot stored as JSONB; receipt movement and order status are not yet one server transaction |
| Invoices / quotes / proformas | localStorage omnibook_invoices; IndexedDB invoices store exists | invoices + invoice_items tables exist | Critical: invoice remains localStorage-backed; no cloud Outbox dispatcher or transactional CRUD path is enabled |
| Dynamic pricing | localStorage omnibook_dynamic_rates | dynamic_rates table; repository list only | Critical: P2P event type is registered, but no typed CRUD mutation, Outbox/push/delete or complete pull merge |
| HR / staff | legacy localStorage mirror + IndexedDB workspaceEntities/Outbox/P2P event | staff_members typed repository; RLS; soft-delete; Realtime; tombstone pull | Partial: staff rows sync; shared role-definition catalog is not yet modeled |
| Roles / permissions | AppContext/browser storage | No workspace role CRUD contract found | Decide explicitly device-local vs workspace-shared; currently not replicated |
| Establishment profile | legacy localStorage mirror + IndexedDB workspaceEntities/Outbox/P2P event | establishments.settings appointmentProfile JSON; repository upsert | Partial: profile mutation queues; establishment must already exist remotely and workspace must be authenticated |
| Channel Manager | Component React useState, seeded initial data | No channel tables/repository | Critical/demo-only: resets on remount/reload; not persisted |
| Spa | Component React useState for appointments/facilities/therapists/treatments | No spa tables/repository | Critical/demo-only: not persisted |
| Event/audit log | IndexedDB eventLogs | audit_events table exists | Partial: local audit trail has no complete cloud sync contract |
| CardLock issued cards/device audit | lockManager + IndexedDB issuedCards/MDB | Not shared PMS entity | Device-local may be intentional; shared revocation requires separate contract |


## P2P-specific revalidation (2026-11-26)

- The event log, vector-clock merge, per-record causal frontier and transactional inbound-batch APIs exist in both IndexedDB and native SQLite. They are persistence primitives, not an end-to-end replication service.
- Windows Rust and Android Kotlin still implement UDP multicast presence discovery only. No authenticated application transport, pairing, workspace authorization, event exchange loop, durable transport ACK, anti-entropy session or peer retry scheduler is wired to the batch-apply APIs. The Windows UI explicitly reports that business transport is not enabled.
- The inbound projection resolves concurrency only for the same `(workspace, entity, entityId)`. It does not enforce cross-record business invariants. Two distinct booking IDs can therefore be individually causally resolved while overlapping the same room/date interval. Stock aggregate constraints have the same class of risk.
- IndexedDB inbound application accepts the P2P registry. Operational projections exist for bookings, resources, invoices and resource groups; task, stock, movement, supplier, purchase-order, staff and profile records use `workspaceEntities`. AppContext restores these generic projections and queues their local mutations. Cloud Outbox acceptance is a separate 11-entity contract.
- The generic native entity-record storage API accepts string entity names for its unreplicated import path. Local replicated writes pass through P2P event validation and must use the canonical singular registry names (`resource`, not `resources`). Native regression tests now use the same registry as IndexedDB.
- TypeScript and Rust now enforce the same 13-entity P2P v1 registry, matching node/entity identity limits, the 256-node vector-clock limit, and the same strict RFC 3339 timestamp subset (commits `cde0591`, `4e28e0c`, `72bfb8e`, `39358a8`). The TypeScript Supabase Outbox registry is separately limited to six dispatched entities. Both runtimes have regression coverage. A shared cross-language fixture harness remains desirable; the two test suites are still maintained separately.
- Native booking projection validates a booking document but does not query other bookings for room/date overlap. IndexedDB projection similarly applies a resolved record without a cross-record reservation constraint. The selected offline policy therefore requires a separate domain-invariant/conflict layer; vector clocks alone cannot implement it.
- Legacy localStorage mirrors remain present. The newly integrated mutations enqueue to IndexedDB before cloud push but UI callbacks still use fire-and-forget enqueue; this is not yet fail-closed mutation completion. A CI diff gate rejects new direct business-key localStorage writes.
- No production P2P claim is justified until authenticated transport, complete CRUD coverage, cross-record conflict handling, anti-entropy, recovery and real multi-device convergence tests pass.

## Selected offline policy

Appointment uses **offline operation with protection of critical operations and strict business rules**. Local validation is necessary but not a global exclusivity guarantee. During a network partition, an offline device cannot know whether another disconnected replica has accepted a conflicting booking, stock deduction or financial operation. Critical actions must therefore be represented as provisional until the required reconciliation/authority condition is met; they must never be silently promoted to globally confirmed based only on local state.

## Cross-layer evidence

- IndexedDB schema version 9 has business stores bookings, invoices, resources, resourceGroups plus indexed generic workspaceEntities. Supabase Outbox registry has 11 dispatched entities; P2P peer registry has 13. A store or registry member alone does not establish CRUD wiring.
- Supabase exposes 21 public tables, including new `stock_suppliers`, `purchase_orders` and `staff_members`. RLS is enabled on all; two technical tables have no policies (default deny).
- Supabase repositories now export supplier, purchase-order, staff, stock movement, establishment profile and soft-delete methods. Invoice and dynamic-rate mutation repositories remain incomplete.
- runSupabaseSync dispatches 11 entity types. Stock movements use an atomic server RPC; task, stock item, supplier, purchase order and staff support delete tombstones. Invoice and dynamic-rate dispatch remain absent.
- AppContext still maintains legacy localStorage mirrors. New mutations enqueue into generic IndexedDB workspaceEntities + Outbox + P2P event transactions, then restore those projections on startup. UI enqueue remains fire-and-forget and must become awaited/fail-closed.
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


## Supabase and mutation integration update (2026-11-26)

- Added additive PostgreSQL tables for suppliers, purchase orders and staff, with tenant/establishment foreign keys, soft-delete, version triggers and RLS. The purchase-order supplier FK enforces same-workspace and same-establishment scope.
- Added preferred supplier reference to stock items and a paginated stock movement read using a single FK join.
- Added the atomic apply_stock_movement RPC. It locks the stock item, checks idempotency, rejects negative quantities and commits ledger + stock projection together.
- AppContext now enqueues task, stock-item, stock-movement, supplier, purchase-order, staff-member and establishment-profile mutations. Generic IndexedDB workspace projections are restored on startup; local tombstones are respected. Supabase tombstones for task, stock item, supplier, purchase order and staff are applied locally and relayed as local P2P delete events.
- This is not complete: UI enqueue is still fire-and-forget; local P2P identity still depends on an authenticated Supabase workspace; dynamic rates and invoices are excluded; remote delete propagation for resource/group and multi-device integration are not yet certified.
- Supabase Security Advisor rechecked on 2026-11-27: two tables have RLS enabled but no policies (`keepalive_pings`, `pms_mdb_imports`), so access is default-deny; leaked-password protection is disabled in Auth. The earlier `keepalive_cap` mutable-search-path finding has been fixed.
- Supabase Performance Advisor rechecked on 2026-11-27: five foreign keys lack covering indexes (`purchase_orders` workspace/establishment and supplier/establishment, `staff_members` establishment, `stock_items` preferred supplier/establishment, `stock_suppliers` establishment). It also reports 68 unused indexes at the current low observed workload; do not remove them blindly before production query-plan and workload review.
- No Supabase schema or Auth settings were changed during this audit.


### Additional invariant gaps after the November 26 integration

- Fire-and-forget enqueue means UI state may still update before IndexedDB confirms the durable Outbox transaction. This must be converted to awaited command/repository calls before claiming fail-closed local mutations.
- Local P2P workspace identity is still derived from the authenticated Supabase workspace. An unauthenticated first-run/offline device can still use legacy local storage but cannot create workspace-scoped P2P Outbox events.
- Dynamic rates remain excluded until a conflict-aware server contract exists; invoices remain excluded until header + line writes and invoice-number allocation are atomic.
- Remote tombstones are now fetched and applied for tasks, stock items, suppliers, purchase orders and staff. Resource/group remote tombstones still require dedicated physical-store projection handling.
- Purchase-order receipt still consists of multiple idempotent movement RPCs followed by a separate PO update; a single receive-purchase-order RPC is needed for atomic multi-line receipt.

- A follow-up function-only migration makes stock movement retries idempotent after the referenced stock item is soft-deleted; a duplicate event still must match the immutable original payload.

- Outbox push preflights server tombstones before task/stock/supplier/order/staff upserts. A matching delete blocks the upsert; a failed tombstone lookup suspends these writes to avoid accidental resurrection. The same preflight result is reused by pull to avoid duplicate queries.

- Remote tombstone pages are applied in IndexedDB batches of at most 500 records, matching the database's bounded page/transaction policy.

- Supabase Security Advisor: keepalive_cap now has an empty search_path and fully qualified table references. Remaining warnings: default-deny RLS on keepalive_pings/pms_mdb_imports and leaked-password protection disabled at Auth configuration level.


## Live Supabase advisor snapshot (2026-11-27)

- Security: two RLS-enabled technical tables remain policy-free by design/default-deny (`keepalive_pings`, `pms_mdb_imports`); leaked-password protection remains disabled at Auth configuration level.
- Performance: five foreign-key index gaps need a tracked migration and query-plan validation. The 68 unused-index notices are observational only; evaluate them against real workload before dropping anything.
- The database currently exposes 21 public tables, all with RLS enabled.
- No production SQL, policies, indexes or Auth settings were modified by this advisor review.


## Migration history consistency check (2026-11-27)

The live Supabase project reports 17 applied migrations. The repository currently tracks 13 SQL migration files. The following remote versions have no matching tracked file: `20261103172324 initial_pms_multi_tenant_schema`, `20261103172339 tenant_integrity_and_membership_hardening`, `20261103172454 foreign_key_indexes_and_policy_cleanup`, and `20261120184245 pms_mdb_imports_sync`. In addition, the repository file `20261120122449_allow_same_day_bookings.sql` does not match the remote applied version `20261120131109 allow_same_day_bookings`.

**This is migration drift.** Do not add invoice RPCs, PO receipt RPCs, indexes or other production DDL until the local migration history is reconciled with the live project and a reproducible baseline is established. No migration or production schema change was made during this check.


## Task completion / stock consumption atomicity (2026-11-27)

- Task completion now builds a single local command containing the task status, each affected stock projection and its immutable stock movement(s).
- Repeated consumed-item lines are aggregated by stock item before transaction creation, preventing duplicate entity keys in one batch.
- The strict IndexedDB transaction commits the task, stock projections, Outbox intents and P2P events together. Local-only mode uses one atomic local-business-entity transaction.
- A transaction precondition rejects a second completion when the persisted task is already `done`; insufficient stock, missing items or invalid consumption abort the whole command.
- The React task state is updated only after the local transaction commits.
- Scope limitation: other task CRUD operations still use the generic enqueue callback; Supabase push of the task and its stock movements is not a single server-side transaction. This closes the local completion boundary, not the global cloud/P2P delivery or all fire-and-forget CRUD gaps.


## Awaited task CRUD integration (2026-11-27)

- Task create, status change, subtask toggle and delete now await IndexedDB commit before changing the React projection.
- Checkout turnover tasks are persisted as one atomic bounded batch; room housekeeping is marked dirty only after the batch commits.
- Staff quick-task assignment waits for the task write before showing success or closing the form.
- Task notification read state is updated only after the completion command succeeds.
- Remaining: optional default-task creation from the staff-creation callback is still a separate asynchronous fan-out; Supabase receives task and stock movement entities through separate dispatchers.


## Atomic staff creation with initial tasks (2026-11-27)

Creating a staff record and its optional default tasks is now one bounded IndexedDB command. In workspace mode, the staff row, task projections, Outbox intents and P2P events are committed together. In local-only mode, the staff row and tasks are committed in one local-business-entity transaction. The React projections, audit events and success feedback are applied only after the transaction resolves. If validation or persistence fails, the command returns no created record and the UI does not report success.


### Awaited staff lifecycle mutations (2026-11-27)

Staff assignment updates, promotions/transfers and deletion now await their IndexedDB Outbox/tombstone operation before updating the React projection or reporting success. The staff UI keeps the relevant modal/confirmation state open when a command fails. These commands are individually durable; they are not a distributed transaction with related tasks.


## Supplier and purchase-order CRUD command boundary (2026-11-27)

The supplier and purchase-order CRUD callbacks no longer use the generic fire-and-forget commit wrappers. They await durable IndexedDB writes/deletes, schedule cloud synchronization only after local commit, and update React state afterward. The stock-management UI awaits these operations and exposes failures through its shared mutation error surface. Multi-line purchase-order receipt still uses its existing local atomic command and separate remote dispatch calls.


### Purchase-order dispatch ordering (2026-11-27)

Dispatch actions now await local purchase-order persistence before writing the sent status and channel. This avoids marking an order as sent when its preceding draft/confirmation command has not committed locally.


### Atomic purchase-order receipt — 2026-11-27

The cloud receipt path now uses one purchase-order Outbox command carrying its immutable
movement set. A single PostgreSQL RPC validates order lines, locks the order and stock rows,
and commits all movement rows, stock balances and the received status together. Individual
movement P2P envelopes remain durable, while duplicate cloud movement dispatch is suppressed.
A retry after a lost ACK is idempotent; subsequent edits for the same order cannot overtake a
failed receipt command. Offline local receipt remains local/provisional until this RPC succeeds.
