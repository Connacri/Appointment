# Data contract — Appointment PMS

> Normative, vendor-neutral contract for every human, AI assistant, LLM, coding agent,
> IDE and future automation that reads or changes this repository.

## 1. Non-negotiable invariant

## Zero-loss data policy (release gate)

Appointment MUST fail closed rather than discard or silently replace user data.

1. **No destructive schema migration.** Every migration is additive or performs a verified
   copy-and-swap inside one SQLite transaction. Before any production migration, the
   application must create and verify a SQLite online-backup snapshot (including WAL
   contents), retain the previous schema/data, and abort startup if the backup cannot
   be completed. A failed migration must leave the original database readable.
2. **No implicit workspace reuse.** Reusing a workspace ID with a different owner or
   metadata is an error. Never infer ownership from a local workspace name.
3. **No equal-version overwrite.** A lower server/entity version is stale and ignored;
   an equal version with identical content is an idempotent replay; an equal version
   with different content is a conflict and must preserve the existing record and
   quarantine the incoming mutation for explicit resolution.
4. **No physical business-record deletion.** Deletions are versioned tombstones with
   durable Outbox/P2P events. Tombstones cannot be garbage-collected until all known
   replicas and the server have acknowledged a retention/checkpoint boundary.
5. **Atomic local writes.** Business mutation, version increment, tombstone (if any),
   Outbox entry, and P2P event must commit in the same SQLite/IndexedDB transaction.
   If any component fails, the entire mutation rolls back.
6. **ACK is evidence, not an assumption.** A mutation is marked synced only after the
   server confirms the exact idempotency key/entity/version and the ACK is committed
   locally. A timeout is an unknown outcome and is retried idempotently, never treated
   as success.
7. **Pull is replay-safe.** Apply a remote page and advance its cursor in one transaction.
   Never advance the cursor past an unapplied row. Replays are expected and must be safe.
   When one inbound Supabase pull contains multiple remote booking tombstones, apply them
   sequentially inside the same IndexedDB transaction. Each local P2P event advances the
   persisted per-node vector clock before the next tombstone is processed; never generate
   concurrent events from the same observed clock or weaken the unique node-sequence index.
   Regression coverage: `tests/serialQueue.test.ts`.
8. **Preserve unknown fields and source provenance.** Do not reconstruct complete
   records from a partial projection. Unknown JSON fields and import provenance survive
   read/write cycles.
9. **Backups and restore are tested.** Release validation must exercise backup integrity,
   restore to a separate file, migration from every supported schema, crash/rollback
   behavior, disk-full/write-failure handling, and preservation of pending/conflicted
   Outbox entries.
10. **No "zero data loss" claim without proof.** P2P partitions can create concurrent
    writes; without quorum/coordinator, convergence is possible but global linearizability
    is not. Conflicts must remain visible and recoverable, never silently resolved.

Current implementation status: native SQLite now creates a verified SQLite
`VACUUM INTO` snapshot before upgrading an existing older schema, checks SQLite
integrity, exact user-table inventory and per-table row counts, and refuses to open a
database created by a newer schema. A restore-drill test copies the verified snapshot
to a fresh database path and verifies that all source rows remain readable.
Equal-version entity conflicts are rejected, stale writes are ignored, workspace
identity mismatch is rejected, and generic physical entity deletion is disabled pending
tombstone/Outbox integration. Broader crash/disk-full restore drills and atomic coupling of every business mutation to the P2P event log remain release
blockers. Do not enable production P2P synchronization until these gates are implemented
and tested.

A feature that reads, writes, imports, exports, caches, synchronizes, deletes or displays
business data is incomplete until all affected layers agree: business rules; domain models
and runtime validation; IndexedDB schema/upgrades; PostgreSQL schema/migrations/constraints;
generated Supabase types; repositories; RLS and tenant isolation; import/export; sync;
UI workflows; regression tests; documentation.

TypeScript compilation is not proof of database alignment. Matching column names is not
proof of business-rule alignment. A connected client or successful HTTP request is not
proof of synchronization or referential integrity.


### Replication write boundary

New business-data mutations MUST NOT persist directly through `localStorage.setItem`.
They must enter the typed domain repository and commit the local projection, version,
Outbox intent, tombstone when applicable, and P2P event atomically. Existing legacy
business-key writes are tracked as migration debt; they are not approved patterns and
must be removed as each entity is migrated. The CI P2P mutation-boundary gate rejects
new direct `localStorage.setItem` calls whose literal key identifies business data.
This static gate complements, but does not replace, repository-level transaction tests.

### P2P protocol v1 contract

The protocol event envelope has one shared entity registry in
`src/services/p2p/protocol.ts`, consumed by IndexedDB and mirrored by Rust:
`booking`, `resource`, `resource_group`, `establishment`, `task`,
`stock_item`, and `invoice`. Unknown entity types are rejected before projection.
The TypeScript and Rust validators enforce the same identity-length limits, a maximum
of 256 vector-clock nodes, and a strict RFC 3339 timestamp subset (Gregorian calendar
date validation, uppercase `T`/ `Z`, seconds 00–59, optional fractional seconds and
UTC offset). Any protocol change must update both validators and their regression tests
in the same change set. This is a wire contract: do not widen one platform independently.

## 2. Canonical business hierarchy

`Hotel → Establishment → Floor → Resource`

- **Hotel**: parent commercial/operating entity. One hotel may own several establishments.
- **Establishment**: one real physical building/site belonging to one hotel. Each actual
  CardLock `BuildingInfo` record maps to one establishment under the explicitly selected hotel.
  When `BuildingInfo` metadata is missing but `RoomInfo.BldNo` provides valid source evidence
  of a building, the importer may recover that building (with an explicit fallback label and a
  warning) rather than dropping its rooms; this is source-backed recovery, not invention.
  Rooms with invalid or missing building identifiers remain excluded and reported.
- **Floor**: a real floor belonging to one establishment. Preserve source identifiers.
- **Resource**: a real room/unit/asset belonging to one floor and establishment.
- **Booking**: references a real resource and shares its hotel/establishment/tenant scope.
- **Workspace**: technical access/collaboration boundary only; never a hotel, building,
  establishment or other business record. Never create a fake workspace. Each authenticated
  Supabase account gets exactly one real personal workspace, owned by that account with an
  `owner` membership row. `WorkspaceContext` creates it on first authenticated load using the
  stable account id as the workspace id (`src/services/supabase/workspaceSelection.ts`) and
  selects it automatically; there is no user-facing workspace selector or creation form. The
  stable id and owner identity (not the display name) identify the personal workspace.
  `createWorkspace` is idempotent: it reuses an existing owned row, self-heals a missing
  `owner` membership with `ON CONFLICT DO NOTHING`, and tolerates a concurrent primary-key
  insert. The `workspaces_select_member` RLS policy lets an owner read its own workspace
  before the membership exists (migration `20261119122428`), breaking the circular dependency
  that previously blocked new accounts. Shared workspaces remain available to the account but
  are never selected automatically. If creation or RLS access still fails, sync stays in the
  evidence-based `no_workspace`/error state rather than inventing a local tenant.
- **ResourceGroup**: optional functional classification; never a substitute for a
  building, floor or establishment. The top-bar building selector and the Gantt filter
  use `ResourceGroup.id` from the local IndexedDB inventory (`selectedBuildingGroupId`).
  That local building id is **not** an establishment id and must never be used as
  `establishmentId` in Supabase writes, RLS scopes or the Outbox. `selectedEstablishmentId`
  remains the verified remote establishment scope used by synchronization.
  Display labels for buildings are capitalized on their first Latin letter only
  (`src/utils/text.ts`); Arabic labels are preserved unchanged.
  When no remote establishment exists yet and the UI selection is `'all'`, sync falls back
  to an establishment id derived from the local `EstablishmentProfile` (`stableEstablishmentId`)
  so the personal workspace can be seeded from local inventory without blocking on a remote
  root or an explicit UI selection. Verified by `tests/supabaseSync.test.ts`.

Never invent a hotel, establishment, building, floor, room, workspace, guest or booking to
satisfy a UI default, import fallback or migration. Never silently merge several buildings
into one establishment.

**Demo-data classification:** A booking is demo data only when its own booking ID belongs to the explicit demo-booking ID set. A resource/room being part of the demo inventory must never cause a real booking to be excluded from IndexedDB persistence, the Outbox, deletion tombstones, Supabase sync or snapshot reconciliation. Real bookings may reference any valid resource ID; only the booking identity controls demo exclusion. Regression coverage: `tests/bookingPersistence.test.ts`.

## 3. Integrity and business rules

- Every persisted business entity has stable identity and explicit ownership scope.
- Every child reference is checked in application code and enforced by database constraints.
- A resource's floor belongs to its establishment; the establishment belongs to the
  selected hotel and workspace.
- A booking/task/payment/document cannot reference a parent from another establishment
  or workspace. Use composite foreign keys for tenant/parent integrity where supported.
- Unique constraints reflect real business uniqueness and are scoped to the correct parent.
- Dates, amounts, currencies, capacities, statuses and transitions are validated as
  business invariants, not only by UI forms.
- Financial postings, payments and stock movements preserve append-only/audit semantics
  where required.
- Deletion follows explicit retention/tombstone rules; never cascade-delete history by
  accident.
- Every exposed Supabase table has RLS. Client-side filtering is not security.
- `resource_groups` and `resources` have two foreign keys. Repository reads that embed
  resources must name `resources!resources_group_tenant_fk(*)` so PostgREST joins on the
  composite `(group_id, workspace_id)` relationship and cannot cross a workspace boundary.
  An unqualified `resources(*)` embed is ambiguous (`PGRST201`) and is not aligned.
- Offline mutations are durable and idempotent. Outbox pending is not synced; only a
  verified server ACK confirms synchronization.
- Imports preserve source IDs/provenance and report orphan/ambiguous rows.
- Automatic bidirectional Supabase sync (`WorkspaceContext`, `src/context/AppContext.tsx`, `src/services/supabase/supabaseSync.ts`, `src/services/supabase/cloudRecovery.ts`, `src/db/indexedDb.ts`) runs when online, configured, authenticated, and scoped to a real workspace (on startup/hydration, online reconnect, focus/visibility, periodic interval, debounced Outbox writes, or explicit **Force sync**). It pushes pending Outbox mutations sequentially in causal order (`establishment` → `resource_group` → `resource` → `booking`; a group exists before its resources and a resource before its bookings), marking synced only after verified server ACK and applying exponential backoff on failures, pulls remote workspace rows, merges without resurrecting locally tombstoned deletions or overwriting pending local Outbox upserts (including backed-off retries), and exposes strictly evidence-based sync status (never reporting `synced` while any Outbox event remains pending or failed). Force sync also emits structured `onEvent` telemetry
(`src/services/supabase/syncLog.ts`) consumed by the bottom terminal: `syncLogSynced` is
emitted only when `fullyVerifiedSynced` is true, while offline, unconfigured,
unauthenticated, no-workspace, pending and failed states each emit their own event.
Redundant trigger de-duplication is allowed only when the Outbox is empty **and** a verified
successful sync is still fresh (`shouldSkipRedundantSync`): any pending, failed or due local
record always forces a push, and a stale or missing `lastSyncedAt` always performs the pull
so Supabase-side edits from another device remain detectable within one poll interval. A
skipped attempt keeps `phase: 'synced'` only because both sides were already verified, never
for an unverified operation. Verified by `tests/cloudRecovery.test.ts` and
`tests/supabaseSync.test.ts`.
- Personal-workspace backfill (`src/services/supabase/backfillPlanner.ts`) seeds the remote
  workspace from the real local `EstablishmentProfile` and inventory only. A blank profile
  name aborts the plan; the caller must not replace it with a synthetic label such as
  "Établissement". It emits establishment → resource group (building) → resource → booking
  operations with workspace-, establishment- and payload-revision-scoped idempotency keys.
  An identical rerun reuses the exact immutable intent; a rename, re-parent or business-data
  edit produces a distinct idempotency key and a new monotonic local entity version rather
  than colliding with the earlier Outbox operation. The same key can never be repurposed for
  different content. `enqueueOutboxOnly` reads the idempotency row, materialized entity
  version and tombstone in the same strict read/write transaction used to append Outbox and
  P2P state; exact retries preserve the original intent and never overwrite newer projections.
  When the workspace already owns exactly one establishment, the plan attaches inventory to
  it and never creates a second root; with several remote roots and no matching local profile
  id or explicit selection, it aborts as ambiguous. The derived (or existing remote)
  establishment id is persisted in the local profile so a later rename updates the same root.
  Demo/bootstrap records are excluded and counted as skipped; bookings without a local
  resource are skipped and reported; a resource tagged with another establishment is reported
  and attached to the real backfilled establishment, never silently merged. Payloads stay in
  the domain camelCase shape; the snake_case mapping remains in `pmsRepository`. Values are
  kept inside the remote check constraints: `spa_clinic` (no remote equivalent) is stored as
  `other`, and free-text check-in/out times are normalized to `HH:MM` with a safe default.
  Same-day stays are valid when check-out time follows check-in time; an end date before the
  start date is rejected and skipped with a warning. A CHECK constraint does not alter
  generated column types. Verified by `tests/bookingValidation.test.ts` and
  `tests/backfillPlanner.test.ts`.
- Remote booking reads are paginated: `listBookings` pages through
  `listBookingsWindow` (`idx_bookings_calendar`, overlap-safe `start_date`/`end_date`
  bounds, narrow projection, deterministic `start_date,id` ordering, `.range()`) so a
  large history is never truncated by the PostgREST max-row limit. Local IndexedDB remains
  the instant render source; remote pages merge in the background. Timeline availability uses
  a difference array merged per resource so overlapping bookings are counted once.
  Verified by `tests/pmsRepositorySelect.test.ts` and `tests/availability.test.ts`.
- CardLock MDB source locations are centralized per platform in `src/locks/database/mdbPaths.ts` (Windows: exact live VirtualStore path to use — `%LOCALAPPDATA%\VirtualStore\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem\CardLock.mdb` — and `D:\proUSB_DBBak` backups; no separate Program Files copy path is kept. Android/web have no automatic exact local proUSB path). UI and import guidance must use these canonical exact paths; sandboxed runtimes cannot open arbitrary filesystem paths automatically and must rely on explicit user file/directory selection.
- Local operational audit log (`src/types/eventLog.ts`, `src/utils/eventLog.ts`, `src/db/indexedDb.ts` v6 `eventLogs` store): stores bounded (`2000` max) device-local live audit events with before/after field diffs (`computeBookingDiff`) alongside deterministic read-only history seeds derived from real persisted bookings, stock movements, proUSB cards/audits, and invoices (`buildHistoricalEventSeeds`). It is local-only (not enqueued to Supabase Outbox, no remote schema change), never fabricates records, supports CSV formula-safe export (`formatEventLogsAsCsv`), and is cleared atomically inside `indexedDb.clearAll()` during GDPR user data purge. Verified by `tests/eventLog.test.ts`.
- Multi-person occupant completeness & lossless booking persistence (`src/types/booking.ts`, `src/utils/bookingOccupants.ts`, `src/utils/bookingValidation.ts`, `src/db/bookingMigration.ts`, `src/db/indexedDb.ts` v7, `src/services/supabase/bookingMapper.ts`, `src/services/supabase/cloudRecovery.ts`, `src/context/AppContext.tsx`, `src/components/BookingModal.tsx`):
  - Every booking tracks canonical occupancy (`adults >= 1`, `children >= 0`) synchronized across `adultGuests`, `occupantsList` (unified adults + children with `id`, `role`, `isAdult`, `isPrimary`, `fullName`, `phone`, `email`, `documentType`, `documentNumber`, `documentExpiryDate`), and `customMetadata` (`hotelAdults`/`hotelChildren` or `resortOccupants`). Person #1 always stays in sync with primary guest identity/contact fields.
  - Whenever `adults + children > 1` (Hotel) or `resortOccupants > 1` (Resort), `validateBookingOccupants` enforces that **every** occupant (primary guest, each additional adult, and each child) has valid `fullName`, `documentType`, and `documentNumber` (plus `specialAuthorizationDesc` when `idPieceType === 'special_authorization'`), and that the primary guest (`isPrimary`) has a valid `phone`, before persistence in `AppContext.addBooking` / `updateBooking` or enqueueing to the Supabase Outbox. Phone numbers for additional adults (2+) and children, as well as e-mail addresses for all occupants (including the primary guest), are optional and validated only when provided. Single-person bookings never fabricate fallback phone numbers or `@example.com` emails.
  - IndexedDB v7 (`migrateBookingRecordV7`) upgrades `bookings` and `workspaceEntities` (`entity === 'booking'`) non-destructively while preserving sync metadata (`workspaceId`, `establishmentId`, `syncVersion`, `deletedAt`) and adds the `sectorStartDate` index.
  - `bookingMapper.ts` (`toSupabaseBookingRow` / `fromSupabaseBookingRow`) maps the entire booking contract losslessly across verified `public.bookings` columns in `database.types.ts`: `occupants` (`occupantsList`), `currency`, `payments_summary` (`paymentCurrency`, `originalCurrencyAmount`, `currencyRateToDzd`, `paymentMethodType`, `payments`), and `guest_metadata._pms` (check-in/out times, identity/passport/visa/police fields, diet preferences, valuables, forgotten items, guest alerts, modification history) while keeping domain `customMetadata` isolated.
  - Police sheets (`src/utils/bookingPrintReport.ts`, `src/components/PoliceSheetModal.tsx`), print reports (`BookingPrintReportModal.tsx`), search (`timelineSearch.ts`, `bookingFinder.ts`), and audit logs (`eventLog.ts`) surface all co-occupants and children. Verified by `tests/multiPersonAlignment.test.ts` and `tests/bookingPrintReport.test.ts`.
- Pre-authentication branding and tenant-data boundary (`src/services/supabase/SupabaseAuthGate.tsx`, `src/hooks/useBrandIconSync.ts`, `src/utils/faviconSync.ts`): the authentication gate displays only the static product asset `/favicon.svg`; it does not load an establishment profile, workspace, booking or other tenant record before authentication. After the authenticated application shell mounts, `MainLayout` may set the document title and browser/touch icons from the locally persisted `EstablishmentProfile.name/logoUrl`. `sanitizeBrandIconUrl` rejects unsafe schemes and accepts only supported image data URLs, blob URLs, HTTP(S) URLs or root-relative assets. This branding path is presentation-only: it does not change credentials, session handling, auth events, workspace resolution, RLS, ownership, IndexedDB stores, Supabase schema, generated types, repositories or Outbox/sync semantics. The static URL sanitization, fallback and link updates are covered by `tests/faviconSync.test.ts`; any future change to the auth/session or workspace behavior remains a data-contract change and must be traced independently.

## 4. Mandatory change protocol

Before editing a data-related feature, the agent must:

1. Read this document, `AGENTS.md`, `docs/ARCHITECTURE.md`, relevant models, IndexedDB,
   generated Supabase types, repositories, SQL migrations and tests.
2. Trace the full read/write path from UI through validation/local storage to remote schema
   and synchronization, including the return path.
3. Identify affected entities, ownership scope, constraints, transitions, legacy data,
   import/export behavior, offline behavior and failure modes.
4. Define the intended contract change and migration/backfill/rollback strategy.
5. Change all affected layers as one coherent contract. Never knowingly leave model and
   database drift without a documented and guarded transition.
6. Regenerate Supabase types from the authoritative schema; never hand-edit generated types
   to conceal schema drift.
7. Add tests for domain invariants, local upgrades, repository behavior, tenant isolation,
   invalid references, import and sync behavior.
8. Update this document when the canonical model, invariants or known alignment status changes.
9. Run relevant checks and inspect actual results. A commit or triggered workflow is not proof.

If the remote baseline, credentials, test environment or permissions are missing, do not
guess, fabricate a schema or claim alignment. Keep the change safely blocked and report the
exact missing prerequisite.

## 5. Validation matrix

| Layer | Minimum proof |
|---|---|
| Domain | Runtime validation and tests for required fields, enums, dates, amounts and transitions |
| IndexedDB | Versioned upgrade tests, legacy conversion, indexes, atomicity and data preservation |
| PostgreSQL | Versioned migrations, constraints, indexes, triggers and schema diff |
| RLS / tenancy | Allowed and denied reads/writes across users, workspaces, hotels and establishments |
| Repository | CRUD, invalid references, idempotency, tombstones and error propagation |
| Import/export | Real fixtures, orphan/ambiguous rows, multi-building and provenance tests |
| Sync | Offline queue, push ACK, pull cursor, conflicts, retries, tombstones and convergence |
| UI | Correct parent selectors, no fake defaults, loading/empty/error/offline states |
| Release | Typecheck, regression suite, i18n parity and production build |

A remote schema change is incomplete until its migration is versioned, replayed in a
non-production environment, checked against the target schema, and generated types refreshed.
Production migration is a separate controlled operation; never run destructive DDL or
backfills against production as an incidental code edit.

## 6. CI change-set policy

For any change to domain models, local persistence, repositories, synchronization, imports
or SQL migrations, the same change set must include:
- relevant regression tests;
- an update to this document describing the changed invariant/alignment status;
- a versioned SQL migration whenever remote schema or constraints change.

The CI gate enforces this change-set discipline. A migration that changes only RLS policies
or grants must declare `-- data-contract: policy-only` as its first line. A migration that
changes only a CHECK constraint and therefore cannot alter generated types must declare
`-- data-contract: constraint-only` as its first line. Either marker skips the generated-types
requirement for that migration but still requires tests and this document. Typecheck,
regression tests and production build remain separate gates. A passing static gate does not
replace a live schema diff or RLS integration test.

## 7. Known alignment gaps — NOT resolved

The last documented remote audit found no `hotels` table or `floors` table;
`establishments` has no `hotel_id`; `resources.building` and `resources.floor` are text.
The local resource model also retains optional textual building/floor fields. Therefore the
complete relational `Hotel → Establishment → Floor → Resource` model and end-to-end sync
are not yet proven aligned.

The exact SQL source for the historical remote baseline was not fully versioned in the
repository at the last audit. Recover and version that baseline before claiming a
reproducible fresh deployment. Do not apply speculative production DDL.

Cloud CardLock import of multiple buildings remains blocked until each building can be
mapped to its own real establishment under an explicitly selected hotel. This is a safety
guard, not completed multi-building support.

The local building selector, Gantt bar geometry fix and sync terminal do not change this
alignment status; they only read existing local inventory and report observed sync events.

At the last live audit the remote `bookings_check` constraint was still
`CHECK ((end_date > start_date))`, so same-day bookings were rejected by Supabase. Migration
`20261120122449` is versioned locally and the client now validates the same rule, but the
migration had not been applied remotely because the project-scoped MCP connection is
read-only and the Supabase CLI is not linked in this environment. Same-day Force sync will
keep failing until that migration is applied with a write-enabled, owner-reviewed path.

Multi-person occupant completeness (`adults + children > 1`) is enforced in the UI (`BookingModal`),
application persistence layer (`AppContext`), IndexedDB v7 migration, and lossless `bookingMapper`
round-trips using the existing verified `public.bookings.occupants` and `guest_metadata` columns
from `src/services/supabase/database.types.ts`. No remote SQL DDL (`booking_occupants` normalized
table or database-level PostgreSQL `CHECK` constraint verifying `jsonb_array_length(occupants) >= adults + children`)
was created or applied because Supabase CLI is unavailable and the MCP connection is read-only.
Server-side enforcement via versioned SQL migration remains a separate owner-reviewed step once
a write-enabled migration environment is available.

Update this section only after verifying local schema, migrations, live remote schema,
generated types, repositories, RLS and tests together.


## 8. Native Windows migration alignment

The independent Rust/Win32 client is a separate implementation target, not a wrapper around the React application. Its booking persistence contract must remain compatible with the current TypeScript `TimelineBooking` payload:

- Shared identity, resource, guest, date, status and payment-status fields serialize using TypeScript camelCase names. Legacy snake_case payloads remain readable during the staged migration.
- The Rust booking extension map preserves unmodeled optional fields (including occupants, extras, payment metadata, guest-age/client-segment metadata and future additions) verbatim through serialization. This compatibility mechanism does **not** mean those fields already have native validation, UI, analytics or sync behavior.
- The local date-only invariant is `endDate >= startDate`; same-day bookings are accepted by the current TypeScript validator and native Rust domain. Check-in/check-out time semantics remain a separate acceptance gate. The live Supabase constraint must still be verified independently before claiming cloud acceptance.
- Rust-normalized money uses integer minor units and an explicit ISO currency code. Until the currency-exponent-aware mapper is implemented, TypeScript `totalPrice` and `paymentCurrency` remain in the flattened extension map and the normalized Rust amount/currency stay unset; the native UI must not treat them as zero-valued settled money. A conversion for bookings, extras, invoices or payments requires an explicit currency exponent and rounding policy; never multiply by 100 indiscriminately.
- SQLite schema version 2 indexes both camelCase and legacy snake_case start-date payloads without dropping existing booking rows.
- The latest mainline capabilities added role-based access control, role management, staff HR/career history, staff notifications, task productivity analytics, bulk dynamic pricing, housekeeping utilities and stock procurement/replenishment. These remain **not migrated** to native Windows unless separately marked implemented in `windows-native/docs/PORTING_MATRIX.md`.

The React Web and Android clients remain authoritative for their existing workflows until native fixture parity, persistence parity, sync convergence and Windows runtime tests pass. A passing native build is not a claim of functional parity.


## 9. Role, staff and procurement additions (2026-11-22)

The 2026-11-22 mainline update extends the application domain with role-based UI capabilities,
staff records and career history, staff-task attribution, staff notifications, supplier
records, purchase orders and room-consumable deductions:

- `src/types/roles.ts` adds the `chef_du_personnel` role, role icons, shift/employment
  states, `StaffMemberRecord` and promotion/transfer history. `src/data/roles.ts`
  defines built-in navigation tabs and permission flags; `src/utils/rolePermissions.ts`
  resolves role capabilities and persists customized role configuration locally.
- `src/types/booking.ts` adds supplier and purchase-order structures. `src/utils/staffHr.ts`,
  `src/utils/staffNotifications.ts`, `src/utils/stockProcurement.ts` and
  `src/utils/bookingAnalyticsEngine.ts` contain local domain calculations for staffing,
  derived notifications, stock deductions/procurement messages and task productivity metrics.
- Current local persistence boundary: role configuration is stored through
  `saveStoredRolesPayload` in browser `localStorage`; staff, supplier and purchase-order
  records use `omnibook_staff_members`, `omnibook_stock_suppliers` and
  `omnibook_purchase_orders`; the selected role and read-notification IDs are also stored
  in browser `localStorage`. These records are not currently represented as
  workspace-scoped IndexedDB Outbox entities and are not synchronized to Supabase.
- Role permission checks in React navigation and views are client-side UI capabilities.
  They are not a replacement for authenticated server authorization or PostgreSQL RLS,
  and must not be treated as proof that a user is authorized to mutate remote data.
- No PostgreSQL migration or generated Supabase type update was included for these new
  staffing/supplier/procurement records. They remain browser-profile-local and are not
  multi-user, cross-device or remotely authoritative. Before enabling shared staff,
  permissions, suppliers or purchase orders, add explicit workspace/establishment ownership,
  versioned IndexedDB migrations, Outbox/repository mappings, server-side RLS policies,
  SQL migrations, generated types and tenant-isolation/sync-convergence tests.

The productivity charts and staff notifications are derived from the currently available
local task, room and stock state; they do not imply a remote event stream, server-side audit
trail, push-notification delivery or synchronized HR system.


## 10. Native booking and occupant contract mapping (2026-11-22)

The Rust domain now models the canonical TypeScript booking payload rather than treating
occupants and payment details only as opaque extension fields:

- `windows-native/src/domain.rs` defines typed booking occupants, extras, payments,
  valuables, forgotten items, guest alerts, modification history, guest identity,
  check-in/out metadata, dietary preferences and the existing booking scalar fields.
  Unknown future fields remain in a flattened extension map. CamelCase is the canonical
  serialized shape; the original shared snake_case booking keys remain readable.
- `Booking::normalize_occupants` applies the TypeScript count precedence: explicit
  `adults` / `children`, then sector-specific `customMetadata` counts, then the same
  defaults as the Web client. The primary slot is synchronized from the booking guest
  fields; additional adults are merged from `adultGuests` and `occupantsList`; children
  are read from child entries in `occupantsList` or the legacy adult list. Empty contact
  and identity fields stay empty; normalization does not fabricate user data.
- Native validation follows the current TypeScript rules: a single-person booking needs
  a valid primary name and syntax-checks contacts only when supplied. A multi-person
  booking requires a full name and identity document for every occupant, a valid phone
  for the primary guest, and validates optional companion contacts only when present.
  A special-authorization booking also requires its description.
- Booking amounts remain in major units as supplied by TypeScript. Conversion is available
  only for the explicit exponent table: `DA` aliases to `DZD`, `RMB` aliases to `CNY`,
  and `DZD`, `EUR`, `USD`, `CNY`, `GBP`, and `SAR` currently use exponent 2.
  Positive values are rounded to the nearest minor unit using Rust's half-away-from-zero
  rounding. Unknown currency strings are preserved, but minor-unit conversion returns an
  explicit unsupported-currency error. Legacy native `totalPriceMinor` / `currencyCode`
  pairs remain readable for existing local records.
- `windows-native/src/booking_mapper.rs` maps to and from the verified
  `public.bookings` columns in `src/services/supabase/database.types.ts`: scalar booking
  columns, `currency`, `payments_summary`, `extras`, `occupants`,
  `guest_metadata` and its internal `_pms` envelope. `workspace_id` and
  `establishment_id` are mandatory mapper arguments; there is no default tenant.
- SQLite upsert and Outbox serialization now use the normalized booking representation.
  Unit tests cover occupant normalization, validation, money aliases/exponents,
  Supabase-row round-trips, metadata separation and tenant-scope requirements.

This is a local contract and deterministic mapping milestone only. It does not implement
Supabase authentication, HTTP requests, server ACK handling, remote pull/push, conflict
resolution, workspace membership resolution or live RLS verification. No SQL migration
or remote schema mutation is part of this step. The native application must not expose a
successful sync state until a future sync engine has received a verified server ACK.

## 11. Native Windows credential vault (2026-11-22)

The native Windows client stores Supabase refresh tokens only through the Windows Credential Manager generic-credential APIs. Credential targets are namespaced by the authenticated Supabase user UUID:

Connacri/Appointment/Supabase/refresh-token/{auth-user-uuid}

The implementation:
- Uses CRED_TYPE_GENERIC and CRED_PERSIST_LOCAL_MACHINE, scoped to the current Windows user's credential set and retained across that user's logon sessions on the same computer.
- Rejects invalid user UUIDs, empty refresh tokens and tokens larger than the documented CRED_MAX_CREDENTIAL_BLOB_SIZE value of 2,560 bytes.
- Returns an explicit absent state when a credential is not found; deleting an absent credential is idempotent.
- Does not put refresh tokens in SQLite, JSON configuration or logs. The vault does not persist passwords, access tokens, service-role keys or database connection strings.
- Does not yet implement sign-in, token refresh, in-memory access-token lifecycle, Supabase HTTP transport or authenticated workspace membership resolution.

A stored refresh token is a bearer credential: it must only be loaded for the matching authenticated user and cleared on sign-out or account removal. The next auth integration slice must refresh through Supabase Auth over HTTPS, keep access tokens in memory, and establish user/workspace identity from the authenticated server response rather than a local workspace selector.

## 12. Native Supabase authentication transport (2026-11-22)

The native client adds a WinHTTP HTTPS transport and an Auth service matching the existing TypeScript password sign-in/sign-up contract:
- POST /auth/v1/token?grant_type=password
- POST /auth/v1/signup
- POST /auth/v1/token?grant_type=refresh_token
- POST /auth/v1/logout

The transport requires an HTTPS Supabase URL, uses the Windows WinHTTP stack and does not disable TLS certificate validation. The public publishable key is sent as the apikey header. No service-role key is supported.

Refresh tokens are rotated and stored in Windows Credential Manager. A separate non-secret active-user UUID pointer identifies which account to restore after restart. Access tokens are held only by the in-memory AuthSession and are not serialized to SQLite or files. Passwords are not persisted.

This service layer is not yet wired to a native login screen or application startup lifecycle. It does not resolve workspace membership, enforce business-data RLS, or implement remote data synchronization. Authentication success must not be interpreted as workspace authorization or sync success.


## 8. Distributed P2P contract — protocol v1 foundation

The P2P event envelope is transport-neutral and shared by TypeScript Web and Rust
native implementations (`src/services/p2p/protocol.ts`,
`windows-native/src/p2p.rs`). Each installation has a stable node identity and a
monotonic per-node sequence. Events are scoped to a workspace and entity and carry
a causal vector clock.

Replicas merge event sets by idempotent set union. A repeated event ID with
different content is treated as node equivocation and rejected. Causally dominated
events are not part of the current materialized frontier; concurrent maximal events
remain a conflict. No last-write-wins rule may silently discard concurrent booking,
stock or financial mutations. Concurrent delete/update operations are also conflicts,
not automatic resurrection or deletion.

The TypeScript runtime validator is part of the untrusted-transport boundary: only the
explicit `upsert` and `delete` operations are accepted; an upsert payload must be a
non-array object, and a delete payload must be null. Unknown operation values must be
rejected before projection. This mirrors Rust's tagged enum and prevents an unknown
operation from falling through to the delete projection.

LAN discovery is implemented for the native Windows EXE and Android APK. Both
endpoints advertise the same IPv4 multicast protocol (239.255.42.99:45871,
protocol version 1, JSON fields protocolVersion, peerId and peerName). The stable
installation UUID identifies the device installation; peerName is an optional,
sanitized display label (Windows computer name or Android manufacturer/model) used
only by the header. It is untrusted display metadata, not an identity proof. Announcements
must never carry a workspace ID, user identity, credentials, access token, port, or
business payload. Browser-only web builds cannot open raw UDP sockets and are not
directly discoverable.

Discovery is not a trusted connection. It does not authenticate the peer, prove
workspace membership, authorize a user, create a secure channel, exchange events or
mark any data as synchronized. Android discovery pauses when the Activity is
backgrounded. Android 16 normally permits target-SDK-36 LAN access; if its opt-in
compatibility restriction blocks multicast, the plugin requests Nearby devices.
ACCESS_LOCAL_NETWORK is required only when the app targets SDK 37 or higher.

File-backed native SQLite runs in WAL mode with `synchronous=FULL`; the commit
boundary therefore requests durable WAL persistence before a successful mutation is
reported. Windows Native CI verifies formatting, tests, Clippy, release compilation and
the installer/browser-independence checks.

Native Windows SQLite schema v7 persists the workspace-scoped append-only event log,
merged vector clock, peer transport cursors and per-record causal frontiers. Canonical
local mutation APIs `upsert_booking`, `delete_booking`, `upsert_entity_record` and
`delete_entity_record` atomically persist business state, version/tombstone, Supabase
Outbox intent, P2P event and vector-clock advancement. Fault-injection tests prove that
failed P2P appends roll back both business and Outbox writes.

Native inbound batches now append events, merge clocks, compute causal frontiers, apply
resolved booking/entity projections, retain concurrent conflicts, and advance the
peer cursor in one SQLite transaction. An empty inbound page is forbidden from
advancing the durable cursor: an incomplete/empty response must never skip events.
 A projection failure rolls back the received
events and cursor. Pending local Outbox mutations block remote projection overwrite;
after a verified server ACK, the blocked frontier is re-evaluated in the same ACK
transaction. Conflict frontiers remain stored rather than using last-write-wins.

Android/Web IndexedDB schema v8 now creates durable P2P event, vector-clock, shared
node identity, peer-cursor and record-frontier stores. Outbox-backed local upserts,
deletes and outbox-only entity mutations append their event and update the vector clock
and local frontier in the same strict-durability IndexedDB transaction as the business
projection and Outbox entry. Pre-v8 workspace rows with no local P2P frontier are
backfilled as immutable events without rewriting their business payload. React
booking/resource/resource-group snapshots now use a
bounded, version-aware reconciliation path: unchanged rows are no-ops, missing rows are
never inferred as deletions, unscoped/cross-workspace rows are rejected, and a snapshot
cannot resurrect a tombstoned row. Direct business-store writes and physical deletes
are disabled; full replacement is explicitly migration-only. The Android discovery
plugin adopts the same persisted node identity.
An explicit full local-data purge rotates the node identity before clearing the old
event sequence, preventing reuse of old node/sequence event IDs.

IndexedDB inbound batches now append immutable events, merge vector clocks, calculate
causal frontiers, apply resolved projections, retain conflicts, block overwrites while
local Outbox mutations remain pending, and advance the peer cursor in one transaction.
A verified Outbox ACK re-evaluates blocked frontiers in the same transaction. Server ACK
does not purge tombstones; peer-wide checkpoint-based retention is still required.
Inbound P2P projection currently does not create a second Supabase Outbox mutation:
the originating node's durable Outbox remains responsible for cloud delivery. A
recoverable cloud-relay path for a peer that receives an event while its origin is lost
is still outstanding. The native Windows Supabase adapter currently pushes booking
Outbox records only; resource, resource-group, invoice and other generic entity cloud
adapters remain incomplete. Their local/P2P durability must not be reported as Supabase
synchronization.

This remains a foundation, not production activation. Native Win32 application
workflows are not yet wired to the canonical atomic APIs, and the LAN discovery plugin
still announces presence only: no authenticated event transport currently exchanges
these batches. Encrypted and authenticated peer pairing, workspace-level authorization,
replay-safe transport framing, anti-entropy/checkpointing, bounded tombstone retention,
user-facing conflict resolution, cloud relay/recovery, cross-platform crash/power-loss
tests and migration/restore drills remain release gates. P2P business replication
remains disabled until every gate is implemented and tested.

**Partition invariant:** with no coordinator or quorum, independent peers may accept
conflicting operations while disconnected. Appointment cannot guarantee globally
exclusive room allocation or globally serializable financial postings during a LAN
partition. Such concurrent operations must be detected after reconnection and
presented as explicit conflicts. The application must not display a globally
consistent/synced status merely because local writes succeeded.

## 13. Supabase Realtime invalidation and cross-client UI refresh (2026-11-24)

The React Web and Android Capacitor runtimes subscribe to workspace-filtered Supabase Postgres Changes for `bookings`, `establishments`, `resource_groups`, `resources`, `pms_tasks`, `stock_items` and `dynamic_rates` through `src/services/supabase/supabaseRealtime.ts`.

- Realtime payloads are invalidation signals only. They are never applied directly to business state. The client debounces bursts, then invokes the existing Supabase Outbox push/pull/merge pipeline, preserving workspace checks, server versions, pending local intent and tombstone precedence.
- A successful channel subscription triggers one pull to close the initial snapshot/subscription race. The old 45-second polling loop is replaced by a five-minute watchdog for dropped notifications and channel outages; focus/visibility and reconnect still trigger a pull.
- A Realtime-triggered pull bypasses the ordinary redundant-pull freshness guard. If a sync is already running, the invalidation is queued and a subsequent pass runs after the current pass; notifications are not discarded while the UI is busy.
- `supabase/migrations/20261124140011_enable_workspace_realtime.sql` idempotently adds the seven workspace tables to `supabase_realtime`. This migration must be applied to the target Supabase project before expecting Postgres Changes delivery. A channel reporting `SUBSCRIBED` alone does not prove that every table is in the publication.
- Realtime does not replace the durable Outbox, server ACK, local IndexedDB transaction, periodic recovery or RLS. A notification can be duplicated or missed; replay-safe pull/merge remains authoritative.
- The independent Rust/Win32 client currently has authenticated WinHTTP REST push/pull for bookings but no persistent Supabase Realtime WebSocket listener or native UI invalidation loop. It is not yet at Realtime parity with Web/Android. Do not claim all-platform real-time convergence until native WebSocket lifecycle, incremental pull wake-up, reconnect/backoff, cancellation and UI refresh are implemented and tested.
- Existing business model gaps remain: localStorage-only and UI-state-only panels documented in `docs/CRUD_SYNC_AUDIT.md` do not become synchronized merely because their neighboring tables emit Realtime events.

Realtime acceptance requires a remote mutation on one client to appear on a second Web/Android client without waiting for the watchdog, while an offline local mutation remains durable and wins over stale remote state until its server ACK is verified. Native Windows requires the same acceptance test before parity can be claimed.
## Supabase alignment progress — 2026-11-26

Supabase is an independent remote replica. It is not the P2P coordinator and must not be
required for local P2P writes. A local mutation is eligible for cloud push only when the
authenticated workspace and target establishment are verified.

The peer-event registry contains 13 entity types. The Supabase Outbox currently contains
11 dispatched types: booking, resource, resource_group, establishment, task, stock_item,
stock_movement, supplier, purchase_order, staff_member and establishment_profile.
Invoice and dynamic_rate remain P2P protocol entities but are not Supabase Outbox entities
until invoice header/lines can be committed atomically and dynamic-rate concurrent updates
have an explicit conflict policy.

The November 26 schema migrations are additive and versioned under supabase/migrations:
- 20261126125047_align_inventory_procurement_and_staff_entities.sql: adds workspace-scoped suppliers,
  purchase orders and staff records with soft-delete columns, tenant foreign keys, version
  triggers, RLS and authenticated-only grants.
- 20261126125222_enable_procurement_and_staff_realtime.sql: adds these tables to
  supabase_realtime; Realtime messages are invalidation signals, not trusted row payloads.
- 20261126125552_enforce_supplier_establishment_scope.sql: prevents a purchase order from
  referencing a supplier from another establishment in the same workspace.
- 20261126125656_apply_stock_movement_atomically.sql: adds apply_stock_movement, a
  security-invoker PostgreSQL transaction that locks the stock row, rejects negative
  balances, verifies movement idempotency, appends the ledger row and updates the stock
  projection atomically.
- 20261126130041_align_stock_preferred_supplier_reference.sql: persists the optional
  preferred supplier reference with workspace/establishment-scoped referential integrity.
- 20261126130712_fix_stock_movement_retry_after_soft_delete.sql: makes duplicate movement
  retries succeed idempotently even when the stock item was soft-deleted after the first
  commit, while preserving content-equivocation checks.

Generated Supabase types are regenerated from the live project after schema changes.
Repositories now read/write suppliers, purchase orders and staff members; stock movement
reads are paginated (500 rows/page) and use one relationship join for item names.
AppContext queues task, stock-item, stock-movement, supplier, purchase-order, staff-member
and establishment-profile mutations through the IndexedDB generic workspace projection,
Outbox and P2P event transaction. The generic projection is restored on startup and local
tombstones are respected during restoration. Stock quantity adjustments are represented by
append-only movements; a new item's initial quantity is represented by an opening movement.

This is an integration milestone, not proof of complete convergence. Remaining gates:
1. Make P2P workspace identity independent of the Supabase workspace; current cloud Outbox
   creation still requires a verified Supabase workspace and establishment.
2. Propagate Supabase tombstones for supplier, purchase-order, staff and stock-item deletes
   to every peer, and test replay/restart behavior.
3. Replace fire-and-forget UI enqueue calls with awaited repository mutation results so a
   failed IndexedDB transaction cannot be presented as a committed business mutation.
4. Add conflict-aware dynamic-rate and invoice RPCs, including atomic invoice line writes
   and an offline-safe invoice-number strategy.
5. Add live PostgreSQL RLS tests, two-device convergence tests, and failure/restart tests.
6. Implement secure peer transport and pairing. LAN discovery remains discovery only.

Do not claim all business CRUD is synchronized or production-ready until these gates pass.


Supabase pull ordering is guarded against resurrection: before pushing upserts for soft-delete-capable entities, the sync engine reads server tombstones. Matching upserts are held for explicit resolution; if tombstone lookup is unavailable, those upserts are suspended. The normal pull reuses the preflight result instead of querying tombstones twice and retries lookup only if preflight failed. Repository page size is centralized at 500 rows for supplier, order, staff, movement and tombstone reads.

Remote tombstone application is chunked into pages of 500 before entering IndexedDB, so a workspace with a large deletion history does not exceed the local transaction safety limit.

The AppContext tombstone adapter uses the IndexedDB method's inferred report type, keeping the P2P entity union single-sourced from the storage contract.


Security hardening: migration 20261126131639_harden_keepalive_function_search_path.sql sets an empty search_path on the fully schema-qualified keepalive_cap trigger function. The remaining Security Advisor warnings are the two technical RLS tables with default-deny/no policies and Supabase Auth leaked-password protection disabled.

## 12. UI mutation acknowledgement boundary

For workspace-backed tasks, suppliers, purchase orders, staff records and the
establishment profile, the React projection is updated only after
`queueBusinessUpsert` or `queueBusinessDelete` resolves. These queue operations
commit the workspace projection, Outbox intent, tombstone state (for upserts,
superseding an older tombstone), P2P event, vector clock and record frontier in
one IndexedDB transaction. A rejected transaction leaves the previous UI
projection intact and is surfaced through the mutation failure reporter.

Do not treat the callback's synchronous return value as a persistence
acknowledgement: the legacy context API still returns created records
synchronously for compatibility, while the UI state commit is asynchronous.
Callers requiring a user-visible completion result must be migrated to an
explicit Promise-returning command API before presenting a success toast. The
current AppContext boundary covers tasks, suppliers, purchase orders, staff
records and the establishment profile. It does not yet provide an awaited
completion result to the calling component.

Stock quantity changes, stock movement batches, resource/booking mutations and
invoice/dynamic-rate persistence are not covered by this UI acknowledgement
change. Purchase-order receiving is explicitly blocked until a single local
transaction can commit the order status, stock item projections, stock movement
ledger, Outbox records and P2P events together. These operations require
 dedicated atomic command contracts and must not be described as fully
fail-closed by this section.

### Purchase-order receipt transaction boundary

A purchase order MUST NOT transition to `received` until one local IndexedDB transaction
has committed all three effects together: the purchase-order status/receipt timestamp,
the affected stock-item quantity projections, and the corresponding stock-movement
ledger entries. The same transaction must include the Outbox/P2P replication intent.
A failure must leave all effects unchanged and must not enqueue a partial mutation.
The UI currently blocks receipt because this atomic command is not implemented; this
is an intentional fail-closed limitation, not a completed receiving workflow.
Regression coverage: `tests/purchaseOrderReceiptSafety.test.ts`.


### Atomic purchase-order receipt command

Purchase-order receipt is implemented as a single local command. The command validates every
line, aggregates repeated stock-item references, rejects missing stock items and invalid
quantities, then commits the purchase-order status, stock-item projections, stock-movement
ledger, Outbox rows and sequential P2P events in one strict IndexedDB transaction. Event
append is serialized inside that transaction so each event observes the preceding vector-clock
advance. A concurrent second receipt is rejected by a transaction-level status precondition.

For installations without an authenticated workspace identity, the same business rows are
written atomically to `localBusinessEntities`; this is durable local-only storage and does not
emit P2P events or claim peer synchronization. React state is updated only after that local
transaction completes; no new business-data localStorage mirror is written. Once a workspace
identity is established, workspace-scoped replication remains a separate migration/pairing requirement.

Regression coverage: `tests/purchaseOrderReceiptSafety.test.ts`.
