import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20261127001723_harden_public_table_privileges.sql', import.meta.url),
  'utf8',
);

test('migration is explicitly marked as a non-type-changing function/privilege change', () => {
  assert.match(migration, /^-- data-contract: function-only/m);
});

test('existing public tables remove RLS-bypass and schema-management privileges', () => {
  assert.match(migration, /REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon/i);
  assert.match(
    migration,
    /REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN\s+ON ALL TABLES IN SCHEMA public\s+FROM anon, authenticated/i,
  );
  assert.match(
    migration,
    /REVOKE ALL PRIVILEGES ON TABLE public\.keepalive_pings, public\.pms_mdb_imports\s+FROM anon, authenticated/i,
  );
});

test('future postgres-created public tables and sequences use reduced default grants', () => {
  assert.match(migration, /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE ALL ON TABLES FROM anon/i);
  assert.match(
    migration,
    /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES FROM authenticated/i,
  );
  assert.match(migration, /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE ALL ON SEQUENCES FROM anon/i);
  assert.match(migration, /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE UPDATE ON SEQUENCES FROM authenticated/i);
});

test('the public DDL event trigger hardens supabase_admin-created objects too', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.rls_auto_enable\(\)/i);
  assert.match(migration, /SECURITY DEFINER\s+SET search_path TO 'pg_catalog'/i);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON TABLE %I\.%I FROM anon/i);
  assert.match(migration, /REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE %I\.%I FROM anon, authenticated/i);
  assert.match(migration, /REVOKE UPDATE ON SEQUENCE %I\.%I FROM anon, authenticated/i);
  assert.match(migration, /RAISE;/i);
});
