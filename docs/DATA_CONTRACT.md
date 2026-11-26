# Appointment P2P implementation plan

Status: active engineering plan. Baseline: `main` at `3f28b5b5033fc617713b3bf79a6a648bb08ff464`.

## Objective

Deliver decentralized, offline-first replication between Appointment Windows and Android
installations, with Web participation where browser security permits it. Keep the existing
SQLite (Windows) and IndexedDB (Web/Android) storage engines. Supabase remains an
independent remote replica/backup and must never act as a LAN coordinator.

No database-engine replacement is planned. ObjectBox and FyroDB are out of scope.

## Accepted consistency policy

**Offline with protection of critical operations and strict business rules.**

Each device may persist locally validated operations while disconnected. Critical operations
must carry a provisional state until the relevant peers have reconciled. A vector clock
detects causality; it does not detect business conflicts across different record IDs.

### Domain rules

| Domain | Local offline behavior | Reconciliation rule |
|---|---|---|
| Reservations | Check dates, resource, status and locally known overlaps. Mark as provisional when peer state is not current. | Check all active bookings for overlapping intervals on the same resource, even when booking IDs differ. Preserve both events and open a domain conflict. |
| Inventory | Check known local quantity; append a unique immutable stock movement. | Recompute from the movement ledger. Negative or conflicting balances require explicit reconciliation. |
| Invoices | Create drafts with globally unique IDs. | Finalize legally sequential numbers only from a preallocated range or after the required online/peer authorization. |
| Payments | Record immutable idempotent payment intents/receipts. | Distinguish locally recorded from externally settled. |
| Tasks | Create/update offline with stable IDs and versioned events. | Merge non-conflicting fields; retain concurrent incompatible changes for resolution. |
| Resources / buildings | Validate parent/workspace/establishment relationships locally. | Reject cross-workspace references; reconcile concurrent structural changes explicitly. |
| Establishment configuration | Versioned offline edits. | Explicit conflict policy for singleton configuration records. |
| CardLock device audit | Device-local unless a separate shared revocation contract is approved. | Do not replicate credentials or hardware secrets. |

A partitioned coordinator-free system cannot guarantee global room exclusivity, non-negative
shared stock or globally serializable financial numbering. If a workflow requires that
guarantee, it must remain provisional offline or consume preallocated escrow rights. No
local success indicator may imply global confirmation.

## Target architecture

1. **Discovery:** retain UDP multicast presence discovery on Windows and Android. Discovery
   is untrusted metadata, not identity or authorization.
2. **Pairing and trust:** explicit device pairing, workspace membership approval, device
   revocation, key rotation and a durable trust store. Never infer workspace access from
   a multicast announcement.
3. **Secure transport:** authenticated encrypted peer channels (mTLS or equivalent) with
   bounded framing, protocol negotiation, timeouts, backpressure and reconnect. Sign
   immutable events at origin so relayed events remain attributable to their author.
4. **Replication session:** exchange workspace-scoped event pages; persist received events,
   projections/conflict records and peer cursors atomically; send a durable-receipt ACK only
   after commit. ACK means durable receipt, not business conflict resolution.
5. **Anti-entropy:** compare vector-clock summaries/checkpoints, request missing ranges,
   recover interrupted sessions and relay events to other authorized peers. Avoid unbounded
   event echo and define compaction only after every retained replica has crossed a checkpoint.
6. **Domain invariant engine:** run cross-record rules in the same transaction as inbound
   projection. Store domain conflicts separately from per-record causal frontiers.
7. **Persistence adapters:** retain SQLite and IndexedDB but enforce the same event schema,
   entity registry, limits, invariants and conformance tests.
8. **Supabase adapter:** independent push/pull with idempotent ACKs, origin/provenance and
   loop prevention. Cloud outage must not stop LAN replication.
9. **Web participation:** browsers cannot open arbitrary UDP/TCP sockets. Use a
   browser-compatible WebRTC/WebSocket path or a local companion transport. A companion
   must not become a database server or coordinator.

## Delivery sequence

### Phase 0 — contract and audit
- Revalidate current `main` before each change.
- Maintain the CRUD matrix across UI command, repository, transaction, event, inbound
  projection, Supabase path, migration and tests.
- Keep the data-contract gate and P2P mutation-boundary CI gate green.
- Establish a versioned entity registry and a cross-platform protocol conformance suite.

### Phase 1 — complete local mutation boundaries

Progress (2026-11-26): the P2P registry (13 entities) is separate from the 11-entity
Supabase Outbox. AppContext now queues tasks, stock items/movements, suppliers, purchase
orders, staff and establishment profiles into generic IndexedDB workspace projections,
Outbox and P2P events. Startup restores those projections. Supabase schema/repositories,
soft-delete tombstones and sync dispatch are present for those entities. Stock movement
and stock balance updates are atomic on PostgreSQL via apply_stock_movement.

This is not complete: UI enqueue calls remain fire-and-forget, local P2P identity still
requires an active Supabase workspace, remote delete propagation and multi-device tests
remain incomplete. Invoice and dynamic rates remain excluded from cloud Outbox.

Remaining work:
- Migrate tasks, stock items, stock movements, suppliers, purchase orders, invoices,
  dynamic rates, staff and establishment profile away from direct localStorage business
  persistence.
- Preserve every existing ID, timestamp, owner/workspace scope and unknown field.
- Use idempotent, resumable migration with backup/checksum verification; never clear legacy
  data before the new copy is verified.
- Route every Create/Update/Delete through typed repositories. Reads must hydrate from the
  same canonical stores.
- Ensure each local transaction commits projection + version + Outbox + tombstone + P2P
  event, or commits none of them.

### Phase 2 — critical domain invariants
- Add reservation overlap detection across different booking IDs and resources.
- Add immutable stock movement ledger and derived balance reconciliation.
- Define invoice draft/final numbering and payment settlement states.
- Add a durable domain-conflict registry and user-facing resolution workflow.
- Test each invariant on local commands and inbound P2P application.

### Phase 3 — Windows ↔ Android secure transport
- Implement explicit pairing, authentication, event origin signatures and workspace
  authorization.
- Implement bounded paginated event exchange, durable ACK, reconnect and backpressure.
- Keep discovery and transport state separate in the UI.
- Never report synchronization from discovery presence alone.

### Phase 4 — anti-entropy and Web
- Add missing-range repair, checkpoints, event retention and crash recovery.
- Add browser-compatible peer connectivity or a local companion path.
- Verify Android/Windows/Web protocol conformance.

### Phase 5 — independent Supabase replication
- Progress: additive tables, RLS, generated types, Realtime, repositories and push/pull/delete
  dispatch are implemented for tasks, stock items/movements, suppliers, purchase orders,
  staff and establishment profiles. Invoice and dynamic-rate sync are deliberately blocked
  pending transaction-safe/conflict-aware contracts.
- Complete schema/RLS/repository/push/pull/delete coverage for approved shared entities.
- Preserve P2P origin metadata and prevent cloud-to-peer-to-cloud echo loops.
- Test cloud offline/online transitions independently of LAN sessions.

### Phase 6 — production verification
- Multi-device Windows/Android tests on a real LAN.
- Partition, packet loss, duplicate/reordered delivery, process kill, reboot and disk-full tests.
- Concurrent same-room booking, same-stock consumption, invoice-number and payment tests.
- Workspace isolation, unauthorized peer, revoked peer, forged event and replay tests.
- Backup/restore and tombstone/checkpoint drills.
- Demonstrate deterministic convergence and explicit conflict preservation before enabling
  business replication by default.

## Release gates

P2P production remains disabled until all are true:

- Every shared CRUD operation is repository-backed and transactionally evented.
- Every supported entity has an inbound projection and tested parent/child integrity.
- Windows and Android authenticate peers and authorize workspaces.
- Event origin authenticity, replay protection and bounded payload validation are verified.
- Peer cursor ACKs are durable and crash-safe.
- Anti-entropy repairs missing events without loops or data loss.
- Critical domain conflicts are persisted and resolvable.
- Supabase is independent of LAN replication.
- Multi-device integration tests demonstrate convergence under partitions and recovery.
- UI distinguishes local, provisional, durably received, conflicted and reconciled states.

Never claim P2P operational based only on discovery, unit tests, a successful build or a
successful event append.


### Phase 3 progress — durable outbound pages (2026-11-26)

IndexedDB schema v11 introduced a durable outbound queue and per-peer ACK cursors.
Schema v12 restricts that queue to events authored by the local node and removes any
third-party events left by the earlier relay prototype. Inbound events are committed to
the event log, projection/conflict state and inbound peer cursor, but are not queued for
outbound delivery. Until immutable origin signatures are implemented, a peer may submit
only events whose nodeId matches its authenticated peer ID. Multi-hop relay is disabled;
each device sends its own events directly to its peers. Queue compaction remains disabled
until trusted peer membership and revocation are implemented. This is a persistence/
protocol layer, not a live network transport.


### Windows SQLite outbound relay and ACK contract

Windows SQLite implements the same per-peer outbound cursor contract as IndexedDB.
The append-only `p2p_events.local_order` log is the relay queue; a schema-v8
`p2p_peer_acks` table stores the current durable cursor and exact offered cursor.
Outbound pages are bounded to 1–500 events. ACKs are accepted only for the exact page
previously offered and only when the cursor identifies an event in the same workspace.
Inbound peer cursors remain separate from outbound ACK cursors. Received events remain
in the append-only event log for local reconciliation but are excluded from outbound pages
until end-to-end event-origin signatures are available.

The Windows SQLite schema-v8 outbound relay implementation uses the same exact-offer ACK rule as IndexedDB; its native regression test covers pagination, stale ACK rejection, and workspace isolation.


P2P inbound and outbound pages are also byte-bounded: a maximum of 500 events and 4 MiB of serialized envelopes per batch/page, with a 1 MiB per-event ceiling. The page reader stops before the next event would exceed the byte budget and leaves that event for the next cursor page. This bounds memory, transaction duration and network framing independently of event count.

The Windows SQLite regression suite additionally verifies that a page containing large event payloads stops before exceeding the 4 MiB serialized-byte budget, while preserving the next event for a subsequent page.

The Windows schema migration regression now asserts schema version 8 and verifies that `p2p_peer_acks` is present alongside the v7 inbound cursor and record-frontier tables.

IndexedDB schema v12 removes non-local events from any queue created by the earlier relay prototype. The SQLite outbound page API also requires the local node ID and skips events authored by other nodes. Multi-hop relay remains disabled until immutable event-origin signatures and verification are in place.

The SQLite page scanner uses a bounded indexed query and skips non-origin events without serializing them into the outbound frame; the cursor advances across skipped rows and stops at the next local-origin event when a page limit is reached.

Windows inbound SQLite pages now enforce the same origin and framing rules as IndexedDB: every event nodeId must equal the authenticated peer ID, each event is at most 1 MiB, and the full page is at most 4 MiB. The batch is rejected before opening the persistence transaction if any of these checks fail.

Regression coverage includes a forged-origin batch: a sender identified as node-b cannot append a node-c event or advance node-b's inbound cursor.

The SQLite inbound-origin regression verifies that a node-b transport session cannot submit a node-c event and that the failed batch leaves both the event log and node-b inbound cursor unchanged.

Windows SQLite schema v9 adds a covering workspace/node/local-order index. Outbound pages query only rows whose persisted node_id matches the local installation identity, so foreign-origin events are excluded by the database query rather than scanned and skipped. This avoids empty cursor-advance pages and keeps per-peer resume cursors aligned with the last locally authored event actually sent.

The outbound paging regression also includes a foreign-origin event in the same workspace and verifies that a node-a page contains only node-a events.

The general SQLite event-log inspection API remains workspace-wide and includes all origins; only the peer-specific outbound page API filters by the local node identity. The workspace event history must not be narrowed by transport-specific sender filtering.
