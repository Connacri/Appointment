import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Supabase business entity migrations are additive and tenant-scoped', () => {
  const schema = read('../supabase/migrations/20261126125047_align_inventory_procurement_and_staff_entities.sql');
  const scope = read('../supabase/migrations/20261126125552_enforce_supplier_establishment_scope.sql');
  const preferredSupplier = read('../supabase/migrations/20261126130041_align_stock_preferred_supplier_reference.sql');

  for (const table of ['stock_suppliers', 'purchase_orders', 'staff_members']) {
    assert.match(schema, new RegExp('create table if not exists public\\.' + table, 'i'));
    assert.match(schema, new RegExp('alter table public\\.' + table + ' enable row level security', 'i'));
    assert.match(schema, new RegExp('create policy ' + table + '_select', 'i'));
    assert.match(schema, new RegExp('create policy ' + table + '_insert', 'i'));
    assert.match(schema, new RegExp('create policy ' + table + '_update', 'i'));
  }

  assert.match(schema, /revoke all on table[\\s\\S]*from anon/i);
  assert.match(schema, /grant select, insert, update[\\s\\S]*to authenticated/i);
  assert.match(scope, /foreign key \\(supplier_id, workspace_id, establishment_id\\)/i);
  assert.match(preferredSupplier, /foreign key \\(preferred_supplier_id, workspace_id, establishment_id\\)/i);
});

test('stock movement RPC applies ledger and quantity in one guarded transaction', () => {
  const sql = read('../supabase/migrations/20261126125656_apply_stock_movement_atomically.sql');
  const retry = read('../supabase/migrations/20261126130712_fix_stock_movement_retry_after_soft_delete.sql');
  const hardening = read('../supabase/migrations/20261126131639_harden_keepalive_function_search_path.sql');
  assert.match(sql, /security invoker/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /idempotency conflict/i);
  assert.match(sql, /next_quantity < 0/i);
  assert.match(sql, /insert into public\\.stock_movements/i);
  assert.match(sql, /update public\\.stock_items/i);
  assert.match(sql, /grant execute[\\s\\S]*to authenticated/i);
  assert.match(retry, /fast idempotency path/i);
  assert.match(retry, /stock movement idempotency conflict/i);
  assert.match(retry, /s.deleted_at is null/i);
  assert.match(hardening, /alter function public\\.keepalive_cap\\(\\) set search_path = ''/i);
});

test('repositories and application mutation paths are connected to the new entities', () => {
  const repository = read('../src/services/supabase/pmsRepository.ts');
  const appContext = read('../src/context/AppContext.tsx');
  const indexedDb = read('../src/db/indexedDb.ts');
  const sync = read('../src/services/supabase/supabaseSync.ts');
  const types = read('../src/services/supabase/database.types.ts');

  for (const method of [
    'listStockSuppliers', 'saveStockSupplier', 'deleteStockSupplier',
    'listPurchaseOrders', 'savePurchaseOrder', 'deletePurchaseOrder',
    'listStaffMembers', 'saveStaffMember', 'deleteStaffMember',
    'saveStockMovement', 'listStockMovements', 'saveEstablishmentProfile',
  ]) assert.match(repository, new RegExp('export async function ' + method + '\\b'));

  for (const entity of ['task', 'stock_item', 'stock_movement', 'supplier', 'purchase_order', 'staff_member', 'establishment_profile']) {
    assert.ok(appContext.includes("queueBusinessUpsert('" + entity + "'"));
  }
  assert.ok(sync.includes("record.entity === 'stock_movement'"));
  assert.ok(sync.includes("record.entity === 'supplier'"));
  assert.ok(sync.includes("record.entity === 'purchase_order'"));
  assert.ok(sync.includes("record.entity === 'staff_member'"));
  assert.ok(sync.includes("remoteTombstoneLookupAvailable"));
  assert.ok(sync.includes("remoteTombstoneKeys.has(tombstoneKey)"));
  assert.ok(repository.includes('const SUPABASE_PAGE_SIZE = 500;'));
  assert.ok(sync.includes("remoteTombstoneLookupAvailable"));
  assert.ok(sync.includes("remoteTombstoneKeys.has(tombstoneKey)"));
  assert.ok(sync.includes("Lecture des tombstones Supabase indisponible"));
  assert.ok(indexedDb.includes('applyRemoteWorkspaceTombstones'));
  assert.ok(appContext.includes('offset += 500'));
  assert.ok(appContext.includes('Awaited<ReturnType<typeof indexedDb.applyRemoteWorkspaceTombstones>>'));
  assert.ok(indexedDb.includes("activePending.some((row) => row.operation === 'upsert')"));
  for (const table of ['stock_suppliers', 'purchase_orders', 'staff_members']) assert.ok(types.includes(table + ':'));
  assert.ok(types.includes('apply_stock_movement'));
});

test('workspace task and establishment UI projections wait for durable outbox commits', () => {
  const appContext = read('../src/context/AppContext.tsx');
  const upsertHelper = appContext.slice(
    appContext.indexOf('const commitBusinessUpsert ='),
    appContext.indexOf('const commitBusinessDelete ='),
  );
  const deleteHelper = appContext.slice(
    appContext.indexOf('const commitBusinessDelete ='),
    appContext.indexOf('const reportQueueFailure ='),
  );

  assert.match(upsertHelper, /queueBusinessUpsert\([\s\S]*?\.then\(\(\) => \{\s*commit\(\)/);
  assert.match(deleteHelper, /queueBusinessDelete\([\s\S]*?\.then\(\(\) => \{\s*commit\(\)/);
  assert.match(appContext, /commitBusinessUpsert\('task'/);
  assert.match(appContext, /commitBusinessDelete\('task'/);
  assert.match(appContext, /commitBusinessUpsert\('establishment_profile'/);
  assert.equal(appContext.includes("localStorage.setItem('omnibook_pms_tasks'"), false);
  assert.equal(appContext.includes("localStorage.setItem('omnibook_establishment_profile'"), false);
});
