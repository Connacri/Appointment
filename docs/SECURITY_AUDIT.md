# Security audit — Appointment PMS

**Audit date:** 27 November 2026  
**Scope:** Supabase PostgreSQL 17.11, exposed `public` schema, RLS policies, SQL functions, client grants and release gates.

## Critical finding and remediation

The initial audit confirmed that the PostgreSQL role `authenticated` had `TRUNCATE` on all 21 public tables. The roles `anon` and `authenticated` also had `MAINTAIN`, `REFERENCES` and `TRIGGER` on all 21 tables. The `anon` role had all table privileges on `keepalive_pings` and `pms_mdb_imports`.

This was a P0 authorization defect: PostgreSQL RLS does not filter table-wide operations such as `TRUNCATE` or `REFERENCES`. RLS policies alone were therefore insufficient to prevent a signed-in client from truncating data across workspaces.

Migration `20261127001800_harden_public_table_privileges.sql`:
- removes all table privileges from `anon`;
- removes `TRUNCATE`, `REFERENCES`, `TRIGGER` and `MAINTAIN` from `authenticated`;
- removes all client privileges from the two technical tables that have no RLS policies;
- reduces default privileges for future objects created by `postgres`;
- extends the existing postgres-owned DDL event trigger so public tables created by platform-managed roles also receive RLS and reduced grants;
- keeps `service_role` grants unchanged;
- does not update, delete or truncate business rows.

The migration is not considered verified until post-deployment privilege queries and a transactional DDL probe pass.

## Existing RLS coverage

The live database contains 21 public tables. RLS was enabled on all 21. There are 67 public policies. Two technical tables — `keepalive_pings` and `pms_mdb_imports` — have no policies and therefore default-deny row access. Client grants on those tables are explicitly removed by the hardening migration.

Workspace policies use `private.has_workspace_access` and `private.has_workspace_role`. The inspected functions use `auth.uid()`, fully qualified table references and an empty search path. The stock movement RPC is `SECURITY INVOKER`, checks `auth.uid()`, validates workspace/establishment scope, locks the stock item and commits the ledger row and stock balance in one transaction.

## Remaining security actions

1. **Auth password protection:** Supabase Auth leaked-password protection is disabled. Enable it in Authentication → Settings → Password Security, then verify the setting.
2. **Foreign-key indexes:** the Performance Advisor reported five unindexed composite foreign keys on procurement, stock supplier and staff tables. Add covering indexes after validating query plans and write overhead.
3. **Unused indexes:** 68 indexes were reported unused. Do not remove them based on a low-traffic sample; collect representative workload statistics first.
4. **Global mutation policy:** the application still does not enforce the selected multi-device read-only policy across every business module and repository boundary.
5. **P2P production security:** authenticated pairing, peer revocation, signed events, Windows↔Android transport, durable ACKs, anti-entropy and real partition/restart tests remain release blockers.
6. **Data CRUD coverage:** invoices, dynamic rates, Channel Manager and Spa still lack complete durable repository and sync paths, as documented in `docs/CRUD_SYNC_AUDIT.md`.

## Release interpretation

A green CI run proves only the checks executed by that workflow. It does not prove multi-device convergence, RLS isolation under adversarial requests, CardLock hardware compatibility or complete CRUD persistence. Production release remains blocked until every relevant gate is demonstrated.
