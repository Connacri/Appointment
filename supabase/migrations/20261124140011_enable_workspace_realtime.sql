do $$
declare
  target_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'create publication supabase_realtime';
  end if;

  foreach target_table in array array[
    'bookings',
    'establishments',
    'resource_groups',
    'resources',
    'pms_tasks',
    'stock_items',
    'dynamic_rates'
  ] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end;
$$;

-- Realtime payloads are invalidation signals only. Clients re-read through RLS
-- and apply the existing version, Outbox and tombstone safeguards locally.