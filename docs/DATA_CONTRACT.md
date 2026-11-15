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
- **Floor**: a real floor belonging to one establishment. Preserve source identifiers.
- **Resource**: a real room/unit/asset belonging to one floor and establishment.
- **Booking**: references a real resource and shares its hotel/establishment/tenant scope.
- **Workspace**: technical access/collaboration boundary only; never a hotel, building,
  establishment or other business record. Never create a fake workspace.
- **ResourceGroup**: optional functional classification; never a substitute for a
  building, floor or establishment.

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
- Offline mutations are durable and idempotent. Outbox pending is not synced; only a
  verified server ACK confirms synchronization.
- Imports preserve source IDs/provenance and report orphan/ambiguous rows.

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

The CI gate enforces this change-set discipline. Typecheck, regression tests and production
build remain separate gates. A passing static gate does not replace a live schema diff or
RLS integration test.

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

Update this section only after verifying local schema, migrations, live remote schema,
generated types, repositories, RLS and tests together.
