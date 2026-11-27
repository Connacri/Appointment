-- data-contract: function-only
-- Harden exposed PostgreSQL privileges without changing business rows.
-- RLS filters row operations; TRUNCATE, REFERENCES and MAINTAIN are table-level
-- privileges and are not constrained by row policies.
--
-- The application uses authenticated workspace membership. No public/anon table
-- access is part of the supported client contract.

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated;

-- These technical tables have no client-facing RLS policies and are not part of
-- the authenticated PMS repository contract. Keep server-side service_role access.
REVOKE ALL PRIVILEGES ON TABLE public.keepalive_pings, public.pms_mdb_imports
  FROM anon, authenticated;

-- Keep sequence USAGE/SELECT for authenticated identity inserts, but never allow
-- public callers to read/advance sequences or authenticated callers to setval().
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE UPDATE ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- The default ACLs for objects created by postgres must not reintroduce bypass
-- privileges in future migrations.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE UPDATE ON SEQUENCES FROM authenticated;

-- Supabase's supabase_admin default ACLs are platform-managed. The existing
-- postgres-owned event trigger is also the enforcement point for newly created
-- public tables/sequences, regardless of which platform role created them.
-- Any failure aborts the DDL instead of silently leaving an exposed object.
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
  object_name name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_catalog.pg_event_trigger_ddl_commands()
    WHERE (
      command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table', 'partitioned table')
    ) OR (
      command_tag = 'CREATE SEQUENCE'
      AND object_type = 'sequence'
    )
  LOOP
    IF cmd.schema_name = 'public' THEN
      BEGIN
        SELECT c.relname
          INTO object_name
        FROM pg_catalog.pg_class c
        WHERE c.oid = cmd.objid;

        IF object_name IS NULL THEN
          CONTINUE;
        END IF;

        IF cmd.object_type IN ('table', 'partitioned table') THEN
          EXECUTE format(
            'ALTER TABLE IF EXISTS %I.%I ENABLE ROW LEVEL SECURITY',
            cmd.schema_name,
            object_name
          );
          EXECUTE format(
            'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM anon',
            cmd.schema_name,
            object_name
          );
          EXECUTE format(
            'REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE %I.%I FROM anon, authenticated',
            cmd.schema_name,
            object_name
          );
        ELSIF cmd.object_type = 'sequence' THEN
          EXECUTE format(
            'REVOKE ALL PRIVILEGES ON SEQUENCE %I.%I FROM anon',
            cmd.schema_name,
            object_name
          );
          EXECUTE format(
            'REVOKE UPDATE ON SEQUENCE %I.%I FROM anon, authenticated',
            cmd.schema_name,
            object_name
          );
        END IF;

        RAISE LOG 'appointment privilege hardening applied to %.%', cmd.schema_name, object_name;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'appointment privilege hardening failed for %: %', cmd.object_identity, SQLERRM;
          RAISE;
      END;
    END IF;
  END LOOP;
END;
$function$;
