-- Appointment PMS: common sync metadata for mutable business entities.
-- Existing rows remain intact; version starts at 1 and tombstones are nullable.
alter table public.establishments
  add column if not exists version bigint not null default 1 check (version > 0),
  add column if not exists deleted_at timestamptz;
alter table public.resource_groups
  add column if not exists version bigint not null default 1 check (version > 0),
  add column if not exists deleted_at timestamptz;
alter table public.resources
  add column if not exists version bigint not null default 1 check (version > 0),
  add column if not exists deleted_at timestamptz;
alter table public.guests
  add column if not exists version bigint not null default 1 check (version > 0),
  add column if not exists deleted_at timestamptz;
alter table public.invoices
  add column if not exists version bigint not null default 1 check (version > 0),
  add column if not exists deleted_at timestamptz;
alter table public.pms_tasks
  add column if not exists version bigint not null default 1 check (version > 0),
  add column if not exists deleted_at timestamptz;
alter table public.stock_items
  add column if not exists version bigint not null default 1 check (version > 0),
  add column if not exists deleted_at timestamptz;
alter table public.dynamic_rates
  add column if not exists version bigint not null default 1 check (version > 0),
  add column if not exists deleted_at timestamptz;

create or replace function private.bump_entity_version()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;

revoke all on function private.bump_entity_version() from public;

drop trigger if exists bump_entity_version on public.establishments;
create trigger bump_entity_version before update on public.establishments
for each row execute function private.bump_entity_version();
drop trigger if exists bump_entity_version on public.resource_groups;
create trigger bump_entity_version before update on public.resource_groups
for each row execute function private.bump_entity_version();
drop trigger if exists bump_entity_version on public.resources;
create trigger bump_entity_version before update on public.resources
for each row execute function private.bump_entity_version();
drop trigger if exists bump_entity_version on public.guests;
create trigger bump_entity_version before update on public.guests
for each row execute function private.bump_entity_version();
drop trigger if exists bump_entity_version on public.bookings;
create trigger bump_entity_version before update on public.bookings
for each row execute function private.bump_entity_version();
drop trigger if exists bump_entity_version on public.invoices;
create trigger bump_entity_version before update on public.invoices
for each row execute function private.bump_entity_version();
drop trigger if exists bump_entity_version on public.pms_tasks;
create trigger bump_entity_version before update on public.pms_tasks
for each row execute function private.bump_entity_version();
drop trigger if exists bump_entity_version on public.stock_items;
create trigger bump_entity_version before update on public.stock_items
for each row execute function private.bump_entity_version();
drop trigger if exists bump_entity_version on public.dynamic_rates;
create trigger bump_entity_version before update on public.dynamic_rates
for each row execute function private.bump_entity_version();

create index if not exists idx_establishments_sync_cursor on public.establishments (workspace_id, updated_at, id);
create index if not exists idx_resource_groups_sync_cursor on public.resource_groups (workspace_id, updated_at, id);
create index if not exists idx_resources_sync_cursor on public.resources (workspace_id, updated_at, id);
create index if not exists idx_guests_sync_cursor on public.guests (workspace_id, updated_at, id);
create index if not exists idx_bookings_sync_cursor on public.bookings (workspace_id, updated_at, id);
create index if not exists idx_invoices_sync_cursor on public.invoices (workspace_id, updated_at, id);
create index if not exists idx_pms_tasks_sync_cursor on public.pms_tasks (workspace_id, updated_at, id);
create index if not exists idx_stock_items_sync_cursor on public.stock_items (workspace_id, updated_at, id);
create index if not exists idx_dynamic_rates_sync_cursor on public.dynamic_rates (workspace_id, updated_at, id);
