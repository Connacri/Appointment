import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildTaskCompletionMutations } from '../src/utils/stockTransactions';
import type { PmsTask, StockItem } from '../src/types/booking';

const source = readFileSync(new URL('../src/db/indexedDb.ts', import.meta.url), 'utf8');

function methodBody(start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `Missing method: ${start}`);
  assert.notEqual(to, -1, `Missing method boundary: ${end}`);
  return source.slice(from, to);
}

const requiredMutationStores = [
  'storeName',
  'outbox',
  'tombstones',
  'workspaceEntities',
  'p2pEvents',
  'p2pTransportQueue',
  'p2pClock',
  'p2pMeta',
  'p2pRecordFrontiers',
];

test('putWithOutbox commits business projection, cloud Outbox and P2P state in one strict transaction', () => {
  const body = methodBody(
    'public async putWithOutbox<',
    '/** Durable local-only booking write',
  );
  assert.match(body, /createStrictTransaction\(\[/);
  for (const store of requiredMutationStores) assert.ok(body.includes(`'${store}'`) || store === 'storeName');
  assert.match(body, /workspaceEntities\.put\(/);
  assert.match(body, /store\.put\(persisted\)/);
  assert.match(body, /objectStore\('outbox'\)\.add\(/);
  assert.match(body, /appendLocalP2pEvent\(/);
  assert.match(body, /waitForTransactionCompletion\(tx, `putWithOutbox/);
});

test('snapshot reconciliation atomically queues every changed workspace entity for cloud and P2P', () => {
  const body = methodBody(
    'public async reconcileSnapshotWithOutbox<',
    'private appendLocalP2pEvent(',
  );
  for (const store of requiredMutationStores) assert.ok(body.includes(`'${store}'`) || store === 'storeName');
  assert.match(body, /workspaceEntities\.put\(/);
  assert.match(body, /store\.put\(persisted\)/);
  assert.match(body, /objectStore\('outbox'\)\.add\(/);
  assert.match(body, /appendLocalP2pEvent\(/);
  assert.match(body, /waitForTransactionCompletion\(tx, `reconcileSnapshotWithOutbox/);
});

test('one P2P append writes immutable event and durable transport queue in the caller transaction', () => {
  const body = methodBody(
    'private appendLocalP2pEvent(',
    '/** Opt-in only: demo/bootstrap data',
  );
  assert.match(body, /objectStore\('p2pEvents'\)\.add\(event\)/);
  assert.match(body, /objectStore\('p2pTransportQueue'\)\.add\(\{ workspaceId, event \}\)/);
  assert.match(body, /objectStore\('p2pRecordFrontiers'\)\.put\(/);
  assert.match(body, /clockStore\.put\(/);
});


const taskFixture: PmsTask = {
  id: 'task-atomic-1',
  room: '101',
  typeId: 'minibar',
  typeName: 'Réapprovisionnement minibar',
  category: 'Minibar & accueil',
  assignee: 'Agent',
  date: '2026-11-27',
  status: 'done',
  priority: 'normal',
  consumedItems: [
    { itemId: 'soap', itemName: 'Savon', quantity: 1 },
    { itemId: 'soap', itemName: 'Savon', quantity: 2 },
  ],
};

const stockFixture: StockItem = {
  id: 'soap', name: 'Savon', category: 'Accueil', unit: 'pcs',
  quantity: 10, minThreshold: 2, unitCost: 50,
};

test('task completion builds one atomic task + aggregated stock movement command', () => {
  let movementSequence = 0;
  const mutations = buildTaskCompletionMutations({
    task: taskFixture,
    stockItems: [stockFixture],
    actor: 'Agent',
    timestamp: '2026-11-27T10:00:00.000Z',
    createMovementId: () => `movement-${++movementSequence}`,
  });

  assert.deepEqual(mutations.map((mutation) => mutation.entity), ['task', 'stock_item', 'stock_movement']);
  const stockMutation = mutations.find((mutation) => mutation.entity === 'stock_item');
  const projected = stockMutation?.applyToCurrent?.(undefined, new Map([
    ['stock_item:soap', stockFixture as unknown as Record<string, unknown>],
  ]));
  assert.equal(projected?.quantity, 7);

  const movement = mutations.find((mutation) => mutation.entity === 'stock_movement');
  const movementPayload = movement?.applyToCurrent?.(undefined, new Map([
    ['stock_item:soap', stockFixture as unknown as Record<string, unknown>],
  ]));
  assert.equal(movementPayload?.delta, -3);
});

test('task completion rejects insufficient stock before any transaction can commit', () => {
  const mutations = buildTaskCompletionMutations({
    task: { ...taskFixture, consumedItems: [{ itemId: 'soap', itemName: 'Savon', quantity: 3 }] },
    stockItems: [stockFixture],
    actor: 'Agent',
    timestamp: '2026-11-27T10:00:00.000Z',
    createMovementId: () => 'movement-insufficient',
  });
  const stockMutation = mutations.find((mutation) => mutation.entity === 'stock_item');
  assert.throws(() => stockMutation?.applyToCurrent?.(undefined, new Map([
    ['stock_item:soap', { ...stockFixture, quantity: 2 } as unknown as Record<string, unknown>],
  ])), /Stock insuffisant/);
});

test('task completion rejects invalid or missing consumed stock rows', () => {
  assert.throws(() => buildTaskCompletionMutations({
    task: { ...taskFixture, consumedItems: [{ itemId: 'soap', itemName: 'Savon', quantity: 0 }] },
    stockItems: [stockFixture], actor: 'Agent', timestamp: '2026-11-27T10:00:00.000Z',
    createMovementId: () => 'movement-invalid',
  }), /Consommation de stock invalide/);
  assert.throws(() => buildTaskCompletionMutations({
    task: { ...taskFixture, consumedItems: [{ itemId: 'missing', itemName: 'Absent', quantity: 1 }] },
    stockItems: [stockFixture], actor: 'Agent', timestamp: '2026-11-27T10:00:00.000Z',
    createMovementId: () => 'movement-missing',
  }), /Article de stock introuvable/);
});

test('AppContext persists task completion and stock deductions through one atomic command', () => {
  const appContext = readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');
  const start = appContext.indexOf('const updateTaskStatus = async');
  const end = appContext.indexOf('const toggleSubtask', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = appContext.slice(start, end);
  assert.match(body, /buildTaskCompletionMutations\(/);
  assert.match(body, /await persistStockMutationsAtomically\(/);
  assert.match(body, /field: 'status', value: 'done'/);
  assert.doesNotMatch(body, /addStockMovement\(/);
  assert.doesNotMatch(body, /localStorage\.setItem\(['"]omnibook_(stock_items|stock_movements)/);
});
