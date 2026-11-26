-- Appointment PMS: workspace-scoped suppliers, purchase orders and HR records.
-- Additive only. Existing local and remote business rows are not modified.
create table if not exists public.stock_suppliers (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  establishment_id text not null,
  name text not null check (length(btrim(name)) > 0),
  category text not null default 'Général',
  contact_name text,
  phone text,
  email text,
  preferred_channel text not null default 'whatsapp' check (preferred_channel in ('whatsapp','email','sms')),
  notes text,
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_suppliers_id_workspace_unique unique (id, workspace_id),
  constraint stock_suppliers_establishment_tenant_fk foreign key (establishment_id, workspace_id)
    references public.establishments(id, workspace_id) on delete restrict
);

create table if not exists public.purchase_orders (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  establishment_id text not null,
  order_number text not null,
  supplier_id text,
  supplier_name text not null,
  supplier_phone text,
  supplier_email text,
  created_by text not null,
  status text not null default 'draft' check (status in ('draft','confirmed','sent','received')),
  note text,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  confirmed_at timestamptz,
  sent_at timestamptz,
  sent_via text check (sent_via is null or sent_via in ('whatsapp','email','sms','copy')),
  received_at timestamptz,
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_orders_establishment_tenant_fk foreign key (establishment_id, workspace_id)
    references public.establishments(id, workspace_id) on delete restrict,
  constraint purchase_orders_supplier_tenant_fk foreign key (supplier_id, workspace_id)
    references public.stock_suppliers(id, workspace_id) on delete restrict,
  constraint purchase_orders_workspace_order_number_key unique (workspace_id, order_number)
);

create table if not exists public.staff_members (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  establishment_id text not null,
  full_name text not null check (length(btrim(full_name)) > 0),
  phone text,
  role_id text not null,
  assignment text not null default '',
  shift text not null check (shift in ('Matin','Soir','Nuit','Polyvalent')),
  default_tasks jsonb not null default '[]'::jsonb check (jsonb_typeof(default_tasks) = 'array'),
  employment_status text not null default 'active' check (employment_status in ('active','on_leave','inactive')),
  hired_at timestamptz not null default now(),
  history jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array'),
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_members_establishment_tenant_fk foreign key (establishment_id, workspace_id)
    references public.establishments(id, workspace_id) on delete restrict
);

create index if not exists idx_stock_suppliers_sync_cursor on public.stock_suppliers(workspace_id, updated_at, id);
create index if not exists idx_stock_suppliers_establishment on public.stock_suppliers(workspace_id, establishment_id, name) where deleted_at is null;
create index if not exists idx_purchase_orders_sync_cursor on public.purchase_orders(workspace_id, updated_at, id);
create index if not exists idx_purchase_orders_establishment_status on public.purchase_orders(workspace_id, establishment_id, status, created_at desc) where deleted_at is null;
create index if not exists idx_staff_members_sync_cursor on public.staff_members(workspace_id, updated_at, id);
create index if not exists idx_staff_members_establishment on public.staff_members(workspace_id, establishment_id, full_name) where deleted_at is null;

drop trigger if exists stock_suppliers_touch_updated_at on public.stock_suppliers;
create trigger stock_suppliers_touch_updated_at before update on public.stock_suppliers for each row execute function private.touch_updated_at();
drop trigger if exists stock_suppliers_bump_version on public.stock_suppliers;
create trigger stock_suppliers_bump_version before update on public.stock_suppliers for each row execute function private.bump_entity_version();
drop trigger if exists purchase_orders_touch_updated_at on public.purchase_orders;
create trigger purchase_orders_touch_updated_at before update on public.purchase_orders for each row execute function private.touch_updated_at();
drop trigger if exists purchase_orders_bump_version on public.purchase_orders;
create trigger purchase_orders_bump_version before update on public.purchase_orders for each row execute function private.bump_entity_version();
drop trigger if exists staff_members_touch_updated_at on public.staff_members;
create trigger staff_members_touch_updated_at before update on public.staff_members for each row execute function private.touch_updated_at();
drop trigger if exists staff_members_bump_version on public.staff_members;
create trigger staff_members_bump_version before update on public.staff_members for each row execute function private.bump_entity_version();

alter table public.stock_suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.staff_members enable row level security;

drop policy if exists stock_suppliers_select on public.stock_suppliers;
create policy stock_suppliers_select on public.stock_suppliers for select to authenticated using (private.has_workspace_access(workspace_id));
drop policy if exists stock_suppliers_insert on public.stock_suppliers;
create policy stock_suppliers_insert on public.stock_suppliers for insert to authenticated with check (private.has_workspace_role(workspace_id, array['owner','admin','manager']));
drop policy if exists stock_suppliers_update on public.stock_suppliers;
create policy stock_suppliers_update on public.stock_suppliers for update to authenticated using (private.has_workspace_role(workspace_id, array['owner','admin','manager'])) with check (private.has_workspace_role(workspace_id, array['owner','admin','manager']));

drop policy if exists purchase_orders_select on public.purchase_orders;
create policy purchase_orders_select on public.purchase_orders for select to authenticated using (private.has_workspace_access(workspace_id));
drop policy if exists purchase_orders_insert on public.purchase_orders;
create policy purchase_orders_insert on public.purchase_orders for insert to authenticated with check (private.has_workspace_role(workspace_id, array['owner','admin','manager']));
drop policy if exists purchase_orders_update on public.purchase_orders;
create policy purchase_orders_update on public.purchase_orders for update to authenticated using (private.has_workspace_role(workspace_id, array['owner','admin','manager'])) with check (private.has_workspace_role(workspace_id, array['owner','admin','manager']));

drop policy if exists staff_members_select on public.staff_members;
create policy staff_members_select on public.staff_members for select to authenticated using (private.has_workspace_access(workspace_id));
drop policy if exists staff_members_insert on public.staff_members;
create policy staff_members_insert on public.staff_members for insert to authenticated with check (private.has_workspace_role(workspace_id, array['owner','admin','manager']));
drop policy if exists staff_members_update on public.staff_members;
create policy staff_members_update on public.staff_members for update to authenticated using (private.has_workspace_role(workspace_id, array['owner','admin','manager'])) with check (private.has_workspace_role(workspace_id, array['owner','admin','manager']));

revoke all on table public.stock_suppliers, public.purchase_orders, public.staff_members from anon;
grant select, insert, update on table public.stock_suppliers, public.purchase_orders, public.staff_members to authenticated;
grant all on table public.stock_suppliers, public.purchase_orders, public.staff_members to service_role;
