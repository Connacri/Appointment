alter table public.stock_items
  add column if not exists preferred_supplier_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.stock_suppliers'::regclass
      and conname = 'stock_suppliers_id_workspace_establishment_unique'
  ) then
    alter table public.stock_suppliers
      add constraint stock_suppliers_id_workspace_establishment_unique
      unique (id, workspace_id, establishment_id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.stock_items'::regclass
      and conname = 'stock_items_supplier_establishment_fk'
  ) then
    alter table public.stock_items
      add constraint stock_items_supplier_establishment_fk
      foreign key (preferred_supplier_id, workspace_id, establishment_id)
      references public.stock_suppliers(id, workspace_id, establishment_id)
      on delete restrict;
  end if;
end;
$$;

create index if not exists idx_stock_items_preferred_supplier
  on public.stock_items(workspace_id, establishment_id, preferred_supplier_id)
  where preferred_supplier_id is not null and deleted_at is null;
