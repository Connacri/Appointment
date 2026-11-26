-- data-contract: function-only
create or replace function public.apply_stock_movement(
  p_workspace_id uuid,
  p_establishment_id text,
  p_movement_id text,
  p_item_id text,
  p_timestamp timestamptz,
  p_delta numeric,
  p_reason text,
  p_room text default null,
  p_actor_name text default null
)
returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_quantity numeric;
  next_quantity numeric;
  existing public.stock_movements%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_workspace_id is null or nullif(btrim(p_establishment_id), '') is null
     or nullif(btrim(p_movement_id), '') is null or nullif(btrim(p_item_id), '') is null
     or p_delta is null or p_delta = 0 or nullif(btrim(p_reason), '') is null then
    raise exception 'Invalid stock movement payload' using errcode = '22023';
  end if;

  -- Fast idempotency path: a retry remains successful even if the item was
  -- soft-deleted after the original movement committed.
  select m.* into existing
  from public.stock_movements m
  where m.id = p_movement_id and m.workspace_id = p_workspace_id;

  if found then
    if existing.establishment_id <> p_establishment_id
       or existing.item_id <> p_item_id
       or existing.timestamp <> p_timestamp
       or existing.delta <> p_delta
       or existing.reason <> p_reason
       or existing.room is distinct from p_room
       or existing.actor_name is distinct from p_actor_name then
      raise exception 'Stock movement idempotency conflict' using errcode = '23505';
    end if;
    select s.quantity into current_quantity
    from public.stock_items s
    where s.id = p_item_id and s.workspace_id = p_workspace_id
      and s.establishment_id = p_establishment_id;
    return coalesce(current_quantity, 0);
  end if;

  select s.quantity into current_quantity
  from public.stock_items s
  where s.id = p_item_id
    and s.workspace_id = p_workspace_id
    and s.establishment_id = p_establishment_id
    and s.deleted_at is null
  for update;

  if not found then
    raise exception 'Stock item missing, deleted or outside workspace/establishment' using errcode = '23503';
  end if;

  -- Recheck after acquiring the item lock so concurrent retries cannot apply twice.
  select m.* into existing
  from public.stock_movements m
  where m.id = p_movement_id and m.workspace_id = p_workspace_id;

  if found then
    if existing.establishment_id <> p_establishment_id
       or existing.item_id <> p_item_id
       or existing.timestamp <> p_timestamp
       or existing.delta <> p_delta
       or existing.reason <> p_reason
       or existing.room is distinct from p_room
       or existing.actor_name is distinct from p_actor_name then
      raise exception 'Stock movement idempotency conflict' using errcode = '23505';
    end if;
    return current_quantity;
  end if;

  next_quantity := current_quantity + p_delta;
  if next_quantity < 0 then
    raise exception 'Insufficient stock: movement would make quantity negative' using errcode = '23514';
  end if;

  insert into public.stock_movements (
    id, workspace_id, establishment_id, item_id, timestamp, delta, reason, room, actor_name, created_by
  ) values (
    p_movement_id, p_workspace_id, p_establishment_id, p_item_id, p_timestamp,
    p_delta, p_reason, p_room, p_actor_name, auth.uid()
  );

  update public.stock_items
  set quantity = next_quantity
  where id = p_item_id and workspace_id = p_workspace_id and establishment_id = p_establishment_id;

  if not found then
    raise exception 'Stock quantity projection update failed' using errcode = '40001';
  end if;
  return next_quantity;
end;
$$;
