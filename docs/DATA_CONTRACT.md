# Appointment P2P implementation plan

Status: active engineering plan. Baseline: `main` at `3f28b5b5033fc617713b3bf79a6a648bb08ff464`.

## Objective

Deliver decentralized, offline-first replication between Appointment Windows and Android
installations, with Web participation where browser security permits it. Keep the existing
SQLite (Windows) and IndexedDB (Web/Android) storage engines. Supabase remains an
independent remote replica/backup and must never act as a LAN coordinator.

No database-engine replacement is planned. ObjectBox and FyroDB are out of scope.

## IndexedDB migration safety

Every version-change migration must inspect `db.objectStoreNames` before calling
`transaction.objectStore(name)`. A store introduced by the same migration is not
available until after `createObjectStore` has run. Create all required indexes when
creating a new store, and add missing indexes only to stores that already exist.
Migration failure must abort atomically without deleting or resetting existing data.

Regression coverage: `tests/indexedDbUpgradeGuards.test.ts` checks that archive and
P2P queue index lookups are guarded and that newly created stores receive those indexes.

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

### Phase 2 progress — cross-device booking overlap detection (2026-11-26)

Implemented on branch `feat/p2p-integrity-secure-transport`:
- A pure P2P detector groups immutable booking events by booking ID, retains each
  booking's causal frontier, and compares different IDs sharing a resource.
- The detector applies the existing cancelled-status rule, hotel time defaults and
  symmetric ten-minute turnover. Wall-clock comparison is independent of the host
  operating-system timezone.
- IndexedDB schema v13 adds a durable `p2pBookingConflicts` registry. Schema v14 adds
  a `workspaceResource` index to scope conflict scans to rooms affected by an inbound
  booking batch rather than loading the full P2P event history.
- Newly detected conflict snapshots are committed in the same strict IndexedDB
  transaction as inbound event/projection/frontier changes and the peer cursor. The
  inbound method resolves only after the transaction commits, so its caller can ACK
  durable receipt afterward.
- A paginated-by-limit read API exposes pending conflict snapshots for a future UI.
- Regression tests cover different booking IDs, distinct rooms, cancellation,
  symmetric turnover, stale causal versions and arrival-order-independent IDs.

Additional progress: explicit decisions are now recorded as immutable `booking_conflict`
P2P events. A `keep_booking` decision cancels the losing booking; `reject_both` cancels
both. Each cancellation is committed to the local booking projection, workspace projection,
cloud Outbox and P2P event log in the same strict IndexedDB transaction. The resolution
event references both source event IDs and every cancellation event ID. Receiving peers
accept the resolution only after the cancellation events are present in the current booking
frontiers and the resolution vector clock causally includes those events. Pending conflicts
are rechecked after subsequent inbound batches, so out-of-order resolution delivery remains
pending until its prerequisites arrive.

Not yet implemented: a user-facing conflict-resolution UI, Windows SQLite conflict registry
and resolution parity, authenticated pairing/revocation, live Windows↔Android transport,
anti-entropy, and physical multi-device restart tests. This slice is not a release gate pass
and must not be described as production-ready.

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

Regression coverage retains a workspace-wide event-log reader while restricting the outbound page query to the authenticated local origin.


## Booking update scheduling guard

Creating a booking already checks resource/time overlap. Updates that change resource,
sector, dates or check-in/check-out times now run the same guard while excluding the
booking being edited. Reactivating a cancelled booking is also revalidated. The hotel
turnover buffer is symmetric: a 10-minute gap is required regardless of which booking
comes first. Cancelled bookings do not occupy a slot. Invalid proposed intervals fail
closed; malformed legacy intervals are ignored so they cannot block every future edit.
This remains a device-local check: concurrent offline bookings created on separate peers
still require a P2P cross-record conflict workflow before global confirmation.


### Durable booking command boundary

Booking creation, editing, status transitions, QR check-in and payment confirmation await the IndexedDB transaction before changing React state or displaying success. Workspace-backed writes atomically persist the booking projection, cloud Outbox intent and P2P event. Create, schedule edits and reactivation re-read the bookings store and validate resource/time overlap inside the same read-write transaction, preventing same-device stale-state double booking across tabs. Before workspace authentication, a local-only booking is still durably stored and validated but is not yet queued for cloud or P2P replication. A failed transaction leaves the previous UI projection unchanged. Cross-device concurrent reservations still require a P2P cross-record conflict workflow and must not be silently resolved by last-write-wins.

## Deployment topology and mutation availability policy

The deployment mode is an explicit, versioned establishment setting. It is never inferred
from the number of peers currently discovered, the number of active sessions, or a failed
LAN scan.

### Deployment modes

- `SINGLE_DEVICE`: exactly one device is authorized to mutate shared establishment data.
  That registered device may continue local mutations while both Supabase and P2P are
  unavailable. Mutations remain in the local durable event log/outbox and are synchronized
  when a remote path returns. No second device may be silently treated as a single-device
  installation merely because it is the only visible peer.
- `MULTI_DEVICE`: more than one device is authorized for the establishment. Mutations
  require a live coordination authority: Supabase transactional authorization or an
  authenticated, trusted P2P authority under the agreed coordination protocol. If neither
  is reachable, the entire application enters read-only mode for shared business data.
  Local drafts may be retained only if clearly marked non-authoritative and cannot be
  promoted to confirmed records while isolated.

### Runtime states

- `ONLINE`: a required coordination authority is reachable and has validated the current
  device membership/configuration epoch.
- `LOCAL_SINGLE_DEVICE`: the establishment is explicitly configured as single-device,
  the local device is the registered active device, and local integrity checks pass. Local
  mutations are allowed without Supabase or P2P.
- `RECONNECTING`: connectivity has returned, but membership/configuration refresh,
  anti-entropy, pending-event validation and conflict checks are not complete. Shared
  mutations remain disabled.
- `READ_ONLY`: a multi-device installation has no reachable coordination authority, or
  device trust/configuration cannot be verified. All shared-data mutations are rejected at
  both UI and repository/domain-command boundaries. Reads of the last local snapshot remain
  available.

Browser/network online status and LAN discovery are hints only. A successful peer
announcement is not an authenticated session; an authenticated session is not by itself a
consensus/coordination grant. A health check must prove that the selected authority can
accept and durably validate the relevant operation.

### Device registry and controlled topology change

The establishment device registry is versioned and contains at minimum:
- establishment/workspace scope;
- deployment mode (`SINGLE_DEVICE` or `MULTI_DEVICE`);
- monotonically increasing registry/configuration epoch;
- device ID, public-key fingerprint, authorization state and role for each registered
  device;
- the active single-device ID when in `SINGLE_DEVICE`;
- update timestamp and the administrator/audit event responsible for each change.

Changing `MULTI_DEVICE` to `SINGLE_DEVICE` is an authenticated, explicit administrator
operation. The administrator selects the one device to retain and revokes all other
registered devices. The transition is committed as a new registry epoch and an immutable,
auditable event. The retained device must refresh and verify that epoch before entering
`LOCAL_SINGLE_DEVICE`.

A device that is partitioned at the moment of revocation cannot be notified instantly.
Therefore revocation is authoritative at the new registry epoch and must be checked before
a device can reconnect, pair, submit events, or regain mutation authority. A stale offline
device may still create local-only data on its own storage, but those events must never be
accepted as authorized shared mutations after its revocation is observed. Do not claim
instantaneous remote erasure or instantaneous revocation across a network partition.

Changing back to `MULTI_DEVICE` requires an explicit pairing/authorization flow for every
new device. A revoked device must not regain trust by restoring an old database backup,
reusing an installation ID, or replaying old credentials. Key rotation and re-pairing are
required.

### Enforcement requirements

- Compute the effective runtime state centrally and expose it as a typed capability to UI
  and domain commands.
- In `READ_ONLY` and `RECONNECTING`, disable and visually gray every mutation surface,
  including forms, context menus, keyboard shortcuts, administrative actions and bulk
  operations. Keep navigation and local reads available.
- Enforce the same policy below the UI: every shared-data write command/repository must
  reject mutations unless the current state and registry epoch authorize them. UI disabling
  alone is not a security or consistency boundary.
- Recheck authorization inside the same durable transaction that appends the business
  projection, P2P event and cloud outbox entry. Fail closed if the registry epoch or local
  trust record is missing, stale, revoked or inconsistent.
- On reconnect, stay in `RECONNECTING` until the registry epoch is refreshed, trusted peers
  are authenticated, missing events are repaired, inbound events are validated, and
  business conflicts are reconciled. Only then restore mutation capabilities.
- Never infer `SINGLE_DEVICE` from peer absence, network-interface count, or a timeout.
- Keep CardLock credentials and hardware secrets outside the replicated device registry.

### Required verification

- A genuine single-device installation can create and edit locally while both network paths
  are unavailable, then sync idempotently after reconnect.
- A multi-device installation with all peers and Supabase unavailable becomes read-only,
  even if only one device remains powered on.
- A multi-device installation does not become single-device after peer discovery timeout,
  Wi-Fi client isolation, VLAN separation, firewall filtering or a crashed peer.
- A revoked device cannot pair or submit accepted shared events after it observes the newer
  registry epoch; stale events from an older epoch are rejected by the authority.
- A retained device cannot leave `RECONNECTING` before membership refresh, anti-entropy
  and conflict validation complete.
- UI and repository/domain-command tests prove that every mutation class is blocked in
  `READ_ONLY` and `RECONNECTING`, not merely the reservation confirmation button.

This policy defines topology and availability; it does not by itself implement a distributed
consensus protocol, secure transport, cryptographic device identity, or global room locks.
Those remain separate release-gated engineering work.


### Device topology policy core — initial implementation

The transport-independent policy engine is implemented in `src/services/p2p/deviceTopology.ts`.
It validates a versioned establishment device registry, computes the fail-closed mutation
state, and builds an explicit administrator-only `MULTI_DEVICE` to `SINGLE_DEVICE`
transition with an incremented registry epoch and revocation of every non-retained active
device. Regression tests cover single-device offline operation, multi-device isolation,
missing authenticated coordination, reconnect gating and administrator authorization.

The IndexedDB adapter now stores the registry in the durable `p2pMeta` store and exposes
scope-checked reads plus compare-and-swap epoch writes. This is local persistence only; it is
not yet a shared authority. The policy core is not wired into AppContext/UI or every mutation
repository. Windows SQLite parity, signed administrator transitions, Supabase-authoritative
registry persistence, authenticated P2P transport and end-to-end revocation enforcement
remain required before this policy can be enabled for existing establishments. Until those
are implemented, do not claim global read-only enforcement or production device revocation.


### AppContext policy integration — guarded booking commands

The AppContext now loads the local device registry for the active workspace and establishment,
exposes the computed mutation availability, and displays a read-only warning when the device
is not registered or coordination is unavailable. The durable booking mutation path checks
the policy before writing; this covers booking create/update/status/payment/check-in, while
room reassignment and booking deletion have explicit guards for their direct atomic paths.

A first-time `SINGLE_DEVICE` registry can be initialized only after Supabase Auth identifies
the caller and a fresh workspace membership query confirms that the caller owns the active
workspace. The owner must explicitly press the setup action; no mode is inferred from network
or peer presence. This initial setup is establishment-scoped and local to this installation.

Important limits: this is not yet a global read-only gate for tasks, stock, suppliers, purchase
orders, staff, housekeeping, invoices, settings or every keyboard/context-menu action.
The local registry is not yet authoritative across devices. `MULTI_DEVICE` therefore remains
read-only because no shared registry authority or authenticated P2P coordination transport is
available. Do not treat this slice as production multi-device authorization.


### AppContext registry hydration ordering

The registry refresh callback is allowed to evaluate the deployment policy for either topology only after core
IndexedDB data hydration has completed. Before hydration, the runtime must remain
`RECONNECTING` with `canMutate=false` and reason `data_not_ready`; it must not briefly
expose a writable state while workspace or establishment scope is still being restored.
The hydration state is declared before the callback that consumes it, preserving React hook
order and preventing a TypeScript use-before-declaration error.

Regression coverage explicitly asserts the reconnecting state, disabled mutation capability
and `data_not_ready` reason for both MULTI_DEVICE and SINGLE_DEVICE while core data is not hydrated.


### Public database privilege hardening — 2026-11-27

A live PostgreSQL grant audit found that the default public-schema ACLs had granted
`TRUNCATE`, `REFERENCES`, `TRIGGER` and `MAINTAIN` to `authenticated` across
all 21 public tables. These privileges are not constrained by row-level security.
The `anon` role also had table privileges on the technical `keepalive_pings` and
`pms_mdb_imports` tables.

Migration `20261127001723_harden_public_table_privileges` now:
- revokes all public-table privileges from `anon`;
- removes table-wide RLS-bypass/schema-management privileges from `authenticated`;
- removes client privileges from the two technical default-deny tables;
- hardens default privileges for future `postgres`-created public tables and sequences;
- extends the existing postgres-owned DDL event trigger to enable RLS and remove
  dangerous grants from future public tables/sequences created by platform-managed roles;
- leaves `service_role` grants and business rows unchanged.

This migration changes privileges and an internal DDL trigger function only. It does not
change table/column/function API shapes, so generated `database.types.ts` remains byte-for-byte
identical to the current live schema output.

Post-deployment SQL verification on 2026-11-27 confirmed 21 public tables, zero tables
with any `anon` table privileges, zero tables with dangerous `authenticated` table
privileges, and no loss of authenticated SELECT on the 19 application tables. A
transactional public-table/identity-sequence DDL probe passed and was rolled back.


### Central device-policy enforcement — business command boundaries

The AppContext now exposes `assertBusinessMutationAllowed` and enforces it before
generic business upserts/deletes, atomic stock transactions, housekeeping status changes,
purchase-order receipts, dynamic-rate edits, invoice creation, customer-profile changes,
onboarding completion, role configuration and destructive local-data purge. Physical
proUSB card issuance/revocation, lock-setting changes, CardLock imports, audit-log reads
that persist records, and destructive lock-cache actions also check the same runtime gate. The legacy raw booking/resource state setters are wrapped
with the same guard so components cannot bypass the policy through those two setters.

The only bootstrap exception is the first establishment setup while onboarding is incomplete
and no device registry exists. That exception does not authorize operational reservations,
stock, tasks, staffing, invoices, role configuration or purge operations.

This is a domain-boundary guard, not yet proof of a fully greyed-out UI. Additional
standalone paths now use the same gate: proUSB card issuance/revocation/lock settings,
CardLock import and destructive cache actions; OTA Channel Manager transitions; Spa
appointments, cabin and therapist state; Supabase runtime configuration; and local event-log
deletion. High-risk controls in those views are disabled when write authority is absent.
Customer profile writes and onboarding completion are also guarded. The principal mutation
controls are also disabled in BookingModal/MyBookings, Billing, Stock and purchase orders,
Room Replenishment, Staff HR, Tasks, Housekeeping, Role Management, Dynamic Pricing and
Lost Property. This is targeted UI coverage, not a claim that every interactive surface is
already disabled.

Important limits remain:
- Invoice creation is blocked in read-only mode, but invoice records are still stored by the
  billing view in localStorage and are not yet backed by a durable transactional repository
  and outbox.
- Channel Manager and Spa currently hold their operational state in component memory. The
  topology guard prevents local UI mutation while read-only, but it does not make those
  modules durable or prove that a real OTA/Spa integration exists.
- Not every form, context menu, keyboard shortcut, bulk action and administrative control
  across every view has yet been audited and visually disabled. UI coverage is incremental;
  the repository/domain command guard remains the enforcement boundary.
- The device registry is still local-only and is not a shared authority. MULTI_DEVICE remains
  read-only until an authenticated shared coordination authority is implemented.

Do not claim complete global read-only enforcement or production multi-device authorization
until the remaining UI surfaces, durable repositories and shared authority have passed their
respective regression and integration tests.


## Operational booking retention and historical archive (2026-11-27)

The operational booking projection retains:
- Every booking whose end date is on/after the rolling six-calendar-month cutoff.
- Every non-terminal booking, even when its end date is older than the cutoff.
- Future and in-house bookings regardless of age.

Only `checked_out` and `cancelled` bookings with `endDate < cutoff` are eligible for local archive. A booking with a pending or failed Outbox mutation, or an unacknowledged P2P transport-queue event, is skipped. Archive movement is performed in bounded IndexedDB transactions that write the archive record and manifest before deleting the operational row. Archive records are stored in the separate `bookingArchiveRecords` object store, partitioned by calendar semester, and are queried by exact workspace/date range. The app does not hydrate archive payloads during normal startup.

IndexedDB schema v15 adds:
- `endDate` and compound `statusEndDate` indexes on operational bookings.
- `bookingArchiveRecords` with workspace/end-date and workspace/booking indexes.
- `bookingArchiveManifests` with workspace/archive-time index.

**Current alignment status — partial implementation, not a completed retention pipeline:**
- Local IndexedDB archival, manifest tracking, operational-window hydration and lazy local date-window reads are implemented.
- Supabase still retains the complete booking history. The normal sync pull now requests only rows with end_date on/after the six-month cutoff or a non-terminal status; historical windows remain available through the paginated, overlap-safe listBookingsWindow query using the composite booking calendar index. This change does not delete or move remote rows and does not yet create private Storage archive objects.
- The 365-day analytics view now loads the required historical window lazily from the local archive and supplements it from Supabase; it does not hydrate older rows during normal app startup. If the remote history is unavailable and a device lacks the corresponding local archive, the comparison is explicitly partial/unavailable.
- The authenticated P2P inbound projection still needs an archive-aware projection path so old terminal events cannot repopulate the operational store.
- Windows SQLite parity and archive integrity/restore tests remain open.

The six-month rule is a performance boundary, not a legal-retention rule. Invoices, payments, audit events, card/lock security records and required accounting evidence must retain their own retention policy and must not be deleted merely because a stay is archived. Supabase remains the remote durable replica until a separately verified archive export, checksum, restore test and retention policy exist.

## Workspace membership resolution and initial Gantt load (2026-11-27)

Workspace resolution is based on the authenticated Supabase session and the RLS-filtered
`workspace_members` inner join returned by `listWorkspaces()`. Membership is never
created or inferred by the client when selecting a shared workspace.

Selection order:
- Reuse a previously selected shared workspace only when it is still returned by the
  authenticated membership query.
- If exactly one shared workspace is accessible, select it before creating or selecting
  the user's own personal workspace. This prevents a staff account from silently opening
  a new empty personal workspace instead of its hotel workspace.
- If multiple shared workspaces are accessible and no valid shared selection is cached,
  do not guess a tenant. Workspace selection remains unresolved and the Gantt stays gated.
- If no shared workspace is accessible, use or create the authenticated user's personal
  workspace as before.
- Offline reuse remains limited to the deterministic personal workspace. A shared
  membership cannot be assumed current while disconnected because it may have been revoked.

The Gantt initial-load contract is now explicit:
- Local IndexedDB hydration and workspace resolution must both finish first.
- In an online authenticated workspace, the first sync must complete with phase
  `synced` for that exact workspace before the Gantt mounts.
- `pending`, `error`, `no_workspace`, stale workspace IDs and unresolved workspace
  selection keep the Gantt hidden and expose a retry action.
- Offline and unconfigured/local-only operation remains available after local hydration;
  this is an explicit offline-first exception, not a claim that a remote sync succeeded.
- A successful sync for a previous workspace cannot unlock the Gantt for a different
  workspace.

This selection logic does not grant access to another user's workspace. An administrator
must establish membership through a separately secured invitation/membership workflow.
The current production workspace has one owner membership; additional staff accounts
will not see its data until they are explicitly added.

The browser IndexedDB and Windows Native SQLite stores remain separate physical stores.
The current native Windows companion syncs bookings only; full PMS domain parity is still
open. Do not claim cross-platform database identity or complete Windows replication.

## Canonical establishment identifiers

`stableEstablishmentId` canonicalizes the `est-` prefix. A profile that already
persists an identifier such as `est-hotel-oasis` must resolve to that same identifier;
it must never generate `est-est-hotel-oasis`. This is required for idempotent
backfill and to prevent a second empty establishment from being created when a
profile id is reused as the source slug. Regression coverage exists in
`tests/backfillPlanner.test.ts`. Existing duplicate rows are not automatically
deleted or deactivated by this normalization; they require a separate, verified
data-cleanup decision.


## Local atomic task completion and stock consumption (2026-11-27)

The task completion command is a single durable local mutation:

- The task status transition, affected stock-item projections and immutable stock-movement records are passed to one IndexedDB strict transaction.
- Local-only installations use one atomic `localBusinessEntities` transaction; workspace installations commit workspace projections, Outbox records, tombstones and P2P events together.
- Repeated consumed-item lines are aggregated by stock item. Missing items, invalid quantities and insufficient stock abort the complete command.
- A transaction precondition rejects a second completion if the persisted task is already `done`, preventing duplicate stock deductions from concurrent/repeated completion attempts.
- React state changes only after the transaction commits. The new command does not add direct localStorage business writes.

Boundary: Supabase still dispatches task and stock-movement entities separately. Server-side atomic completion, end-to-end P2P transport and awaited/fail-closed behavior for the remaining generic task CRUD commands are not covered by this local transaction.


Regression guard: `tests/indexedDbMutationAtomicity.test.ts` verifies that the task-completion command stays on the atomic IndexedDB path and does not reintroduce direct localStorage writes for stock projections or movements.


## Awaited task CRUD command boundary (2026-11-27)

Task creation, status updates, subtask toggles, deletion, staff quick-task assignment and checkout turnover-task generation now await durable IndexedDB persistence before updating the React task projection or reporting success. Checkout turnover tasks are inserted as one bounded batch transaction rather than independent fire-and-forget writes. The UI marks task notifications read and closes task-entry flows only after the command returns success.

Task completion with stock consumption retains the atomic combined task/stock command documented above. The staff-creation flow's optional initial-task fan-out and other non-task business entities remain separate work.


## Staff onboarding transaction (2026-11-27)

Staff creation and its optional initial tasks now share one local IndexedDB transaction. Workspace mode emits the staff and task Outbox/P2P records in the same transaction; local-only mode writes both projections atomically. UI success is displayed only after durable commit. This does not yet make later staff assignment, promotion, transfer or deletion commands awaited.
