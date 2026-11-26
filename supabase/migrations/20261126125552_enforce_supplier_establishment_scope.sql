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

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.purchase_orders'::regclass
      and conname = 'purchase_orders_supplier_tenant_fk'
  ) then
    alter table public.purchase_orders drop constraint purchase_orders_supplier_tenant_fk;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.purchase_orders'::regclass
      and conname = 'purchase_orders_supplier_establishment_fk'
  ) then
    alter table public.purchase_orders
      add constraint purchase_orders_supplier_establishment_fk
      foreign key (supplier_id, workspace_id, establishment_id)
      references public.stock_suppliers(id, workspace_id, establishment_id)
      on delete restrict;
  end if;
end;
$$;
