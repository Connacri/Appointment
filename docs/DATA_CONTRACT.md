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

IndexedDB schema v11 now maintains a durable relay queue for locally authored and
newly received P2P events. It exposes bounded outbound page reads and per-peer durable
ACK cursors. The ACK must match the exact page offered to that peer; arbitrary cursor
jumps and cross-workspace acknowledgements are rejected. Incoming events are re-enqueued
for relay to other peers in the same transaction as event/projection/cursor commit.
Queue compaction remains disabled until trusted peer membership and revocation are
implemented. This is a persistence/protocol layer, not a live network transport.


### Windows SQLite outbound relay and ACK contract

Windows SQLite implements the same per-peer outbound cursor contract as IndexedDB.
The append-only `p2p_events.local_order` log is the relay queue; a schema-v8
`p2p_peer_acks` table stores the current durable cursor and exact offered cursor.
Outbound pages are bounded to 1–500 events. ACKs are accepted only for the exact page
previously offered and only when the cursor identifies an event in the same workspace.
Inbound peer cursors remain separate from outbound ACK cursors. Received events share
the append-only event log and are therefore eligible for relay to other peers.
