-- data-contract: function-only
-- Commit purchase-order receipt, immutable movement ledger and stock projections atomically.
-- The receiptMovements array in the single purchase_order Outbox envelope is the authoritative cloud batch.
create or replace function public.apply_purchase_order_receipt(
  p_workspace_id uuid,
  p_establishment_id text,
  p_order_id text,
  p_received_at timestamptz,
  p_actor_name text,
  p_movements jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.purchase_orders%rowtype;
  v_movement record;
  v_stock public.stock_items%rowtype;
  v_existing public.stock_movements%rowtype;
  v_expected_qty numeric;
  v_expected_count integer;
  v_unique_item_count integer;
  v_unique_movement_count integer;
  v_matching_count integer;
  v_new_quantity numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_workspace_id is null
     or nullif(btrim(p_establishment_id), '') is null
     or nullif(btrim(p_order_id), '') is null
     or p_received_at is null
     or nullif(btrim(p_actor_name), '') is null
     or p_movements is null
     or jsonb_typeof(p_movements) is distinct from 'array' then
    raise exception 'Invalid purchase-order receipt payload' using errcode = '22023';
  end if;
  if jsonb_array_length(p_movements) < 1 or jsonb_array_length(p_movements) > 100 then
    raise exception 'Purchase-order receipt movement count is outside the allowed range' using errcode = '22023';
  end if;

  -- Serialize all receipt attempts for this order before checking its state.
  select po.* into v_order
  from public.purchase_orders po
  where po.id = p_order_id
    and po.workspace_id = p_workspace_id
    and po.establishment_id = p_establishment_id
    and po.deleted_at is null
  for update;

  if not found then
    raise exception 'Purchase order missing, deleted or outside workspace/establishment' using errcode = '23503';
  end if;

  if jsonb_typeof(v_order.items) <> 'array' or jsonb_array_length(v_order.items) = 0
     or exists (
       select 1
       from jsonb_array_elements(v_order.items) as line(value)
       where jsonb_typeof(line.value) <> 'object'
          or nullif(btrim(line.value->>'itemId'), '') is null
          or jsonb_typeof(line.value->'orderQty') <> 'number'
          or case
               when jsonb_typeof(line.value->'orderQty') = 'number'
               then (line.value->>'orderQty')::numeric <= 0
               else true
             end
     ) then
    raise exception 'Purchase order contains invalid receipt lines' using errcode = '22023';
  end if;

  select count(*) into v_expected_count
  from (
    select line.value->>'itemId'
    from jsonb_array_elements(v_order.items) as line(value)
    group by line.value->>'itemId'
  ) expected;

  select count(distinct movement.value->>'itemId'),
         count(distinct movement.value->>'id')
    into v_unique_item_count, v_unique_movement_count
  from jsonb_array_elements(p_movements) as movement(value);

  if v_unique_item_count <> jsonb_array_length(p_movements)
     or v_unique_movement_count <> jsonb_array_length(p_movements)
     or v_expected_count <> jsonb_array_length(p_movements) then
    raise exception 'Receipt must contain exactly one unique movement per ordered stock item' using errcode = '22023';
  end if;

  -- Validate every supplied movement against the immutable purchase-order lines.
  for v_movement in
    select movement.value->>'id' as movement_id,
           movement.value->>'itemId' as item_id,
           (movement.value->>'timestamp')::timestamptz as movement_at,
           (movement.value->>'delta')::numeric as delta,
           movement.value->>'reason' as reason,
           nullif(movement.value->>'room', '') as room,
           nullif(movement.value->>'user', '') as actor_name
    from jsonb_array_elements(p_movements) as movement(value)
    order by movement.value->>'itemId'
  loop
    if nullif(btrim(v_movement.movement_id), '') is null
       or nullif(btrim(v_movement.item_id), '') is null
       or v_movement.delta is null or v_movement.delta <= 0
       or v_movement.movement_at is distinct from p_received_at
       or v_movement.actor_name is distinct from p_actor_name
       or v_movement.reason is distinct from ('Réception commande ' || v_order.order_number) then
      raise exception 'Invalid or inconsistent purchase-order receipt movement' using errcode = '22023';
    end if;

    select coalesce(sum((line.value->>'orderQty')::numeric), 0)
      into v_expected_qty
    from jsonb_array_elements(v_order.items) as line(value)
    where line.value->>'itemId' = v_movement.item_id;

    if v_expected_qty <= 0 or v_expected_qty <> v_movement.delta then
      raise exception 'Receipt quantity does not match the ordered quantity for item %', v_movement.item_id
        using errcode = '23514';
    end if;
  end loop;

  if v_order.status = 'received' then
    -- Lost-ACK retry: prove that the exact complete ledger batch already committed.
    if v_order.received_at is distinct from p_received_at then
      raise exception 'Purchase order was received by a different receipt command' using errcode = '23505';
    end if;

    select count(*) into v_matching_count
    from jsonb_array_elements(p_movements) as movement(value)
    join public.stock_movements existing
      on existing.id = movement.value->>'id'
     and existing.workspace_id = p_workspace_id
     and existing.establishment_id = p_establishment_id
     and existing.item_id = movement.value->>'itemId'
     and existing.timestamp = (movement.value->>'timestamp')::timestamptz
     and existing.delta = (movement.value->>'delta')::numeric
     and existing.reason = movement.value->>'reason'
     and existing.room is not distinct from nullif(movement.value->>'room', '')
     and existing.actor_name is not distinct from nullif(movement.value->>'user', '');

    if v_matching_count <> jsonb_array_length(p_movements) then
      raise exception 'Received purchase order does not match the immutable receipt movement batch' using errcode = '23505';
    end if;

    return jsonb_build_object(
      'orderId', p_order_id,
      'movementCount', v_matching_count,
      'idempotent', true
    );
  end if;

  if v_order.status not in ('confirmed', 'sent') then
    raise exception 'Only confirmed or sent purchase orders can be received' using errcode = '23514';
  end if;

  -- Lock stock rows in deterministic item-id order to avoid cross-order deadlocks.
  for v_movement in
    select movement.value->>'id' as movement_id,
           movement.value->>'itemId' as item_id,
           (movement.value->>'timestamp')::timestamptz as movement_at,
           (movement.value->>'delta')::numeric as delta,
           movement.value->>'reason' as reason,
           nullif(movement.value->>'room', '') as room,
           nullif(movement.value->>'user', '') as actor_name
    from jsonb_array_elements(p_movements) as movement(value)
    order by movement.value->>'itemId'
  loop
    select item.* into v_stock
    from public.stock_items item
    where item.id = v_movement.item_id
      and item.workspace_id = p_workspace_id
      and item.establishment_id = p_establishment_id
      and item.deleted_at is null
    for update;

    if not found then
      raise exception 'Stock item missing, deleted or outside workspace/establishment: %', v_movement.item_id
        using errcode = '23503';
    end if;

    select movement.* into v_existing
    from public.stock_movements movement
    where movement.id = v_movement.movement_id;

    if found then
      raise exception 'Receipt movement id already belongs to another mutation: %', v_movement.movement_id
        using errcode = '23505';
    end if;

    v_new_quantity := v_stock.quantity + v_movement.delta;
    if v_new_quantity < 0 then
      raise exception 'Receipt would make stock quantity negative' using errcode = '23514';
    end if;

    insert into public.stock_movements (
      id, workspace_id, establishment_id, item_id, timestamp, delta, reason, room, actor_name, created_by
    ) values (
      v_movement.movement_id, p_workspace_id, p_establishment_id, v_movement.item_id,
      v_movement.movement_at, v_movement.delta, v_movement.reason, v_movement.room,
      v_movement.actor_name, auth.uid()
    );

    update public.stock_items
    set quantity = v_new_quantity
    where id = v_movement.item_id
      and workspace_id = p_workspace_id
      and establishment_id = p_establishment_id;

    if not found then
      raise exception 'Stock quantity projection update failed for item %', v_movement.item_id
        using errcode = '40001';
    end if;
  end loop;

  update public.purchase_orders
  set status = 'received',
      received_at = p_received_at
  where id = p_order_id
    and workspace_id = p_workspace_id
    and establishment_id = p_establishment_id
    and status in ('confirmed', 'sent')
    and deleted_at is null;

  if not found then
    raise exception 'Purchase-order receipt state transition failed' using errcode = '40001';
  end if;

  return jsonb_build_object(
    'orderId', p_order_id,
    'movementCount', jsonb_array_length(p_movements),
    'idempotent', false
  );
end;
$$;

revoke all on function public.apply_purchase_order_receipt(uuid,text,text,timestamptz,text,jsonb) from public, anon;
grant execute on function public.apply_purchase_order_receipt(uuid,text,text,timestamptz,text,jsonb) to authenticated, service_role;
