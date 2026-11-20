# Data contract — Appointment PMS

> Normative, vendor-neutral contract for every human, AI assistant, LLM, coding agent,
> IDE and future automation that reads or changes this repository.

## 1. Non-negotiable invariant

A feature that reads, writes, imports, exports, caches, synchronizes, deletes or displays
business data is incomplete until all affected layers agree: business rules; domain models
and runtime validation; IndexedDB schema/upgrades; PostgreSQL schema/migrations/constraints;
generated Supabase types; repositories; RLS and tenant isolation; import/export; sync;
UI workflows; regression tests; documentation.

TypeScript compilation is not proof of database alignment. Matching column names is not
proof of business-rule alignment. A connected client or successful HTTP request is not
proof of synchronization or referential integrity.

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
  workspace from the real local `EstablishmentProfile` and inventory only. It emits
  establishment → resource group (building) → resource → booking operations with stable,
  workspace-scoped idempotency keys, so re-running it never creates duplicates. A blank
  profile name aborts the plan without inventing an establishment. When the workspace
  already owns exactly one establishment, the plan attaches inventory to it and never
  creates a second root; with several remote roots and no matching local profile id or
  explicit selection, it aborts as ambiguous. The derived (or existing remote) establishment
  id is persisted in the local profile so a later rename updates the same root.
  Demo/bootstrap records are
  excluded and counted as skipped; bookings without a local resource are skipped and reported;
  a resource tagged with another establishment is reported and attached to the real
  backfilled establishment, never silently merged. Payloads stay in the domain camelCase
  shape; the snake_case mapping remains in `pmsRepository`. Values are kept inside the
  remote check constraints: `spa_clinic` (no remote equivalent) is stored as `other`, and
  free-text check-in/out times are normalized to `HH:MM` with a safe default instead of
  failing every retry. Same-day stays are valid when check-out time follows check-in time,
  so migration `20261120122449` replaces the remote `bookings_check` constraint with
  `end_date >= start_date`; an end date before the start date is rejected by
  `isValidBookingDateRange` in the booking form and skipped with a warning by the backfill
  planner. The generated types were regenerated and are unchanged because a CHECK
  constraint does not alter table or column types. Verified by
  `tests/bookingValidation.test.ts` and `tests/backfillPlanner.test.ts`.
- Remote booking reads are paginated: `listBookings` pages through
  `listBookingsWindow` (`idx_bookings_calendar`, overlap-safe `start_date`/`end_date`
  bounds, narrow projection, deterministic `start_date,id` ordering, `.range()`) so a
  large history is never truncated by the PostgREST max-row limit. Local IndexedDB remains
  the instant render source; remote pages merge in the background. Timeline availability uses
  a difference array merged per resource so overlapping bookings are counted once.
  Verified by `tests/pmsRepositorySelect.test.ts` and `tests/availability.test.ts`.
- CardLock MDB source locations are centralized per platform in `src/locks/database/mdbPaths.ts` (Windows: exact live VirtualStore path to use — `%LOCALAPPDATA%\VirtualStore\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem\CardLock.mdb` — and `D:\proUSB_DBBak` backups; no separate Program Files copy path is kept. Android/web have no automatic exact local proUSB path). UI and import guidance must use these canonical exact paths; sandboxed runtimes cannot open arbitrary filesystem paths automatically and must rely on explicit user file/directory selection.

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

Update this section only after verifying local schema, migrations, live remote schema,
generated types, repositories, RLS and tests together.
