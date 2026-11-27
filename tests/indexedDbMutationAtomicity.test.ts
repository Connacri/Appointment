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


test('task CRUD commands await durable IndexedDB persistence before updating React state', () => {
  const appContext = readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');
  const readBody = (start: string, end: string) => {
    const from = appContext.indexOf(start);
    const to = appContext.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `Missing AppContext command: ${start}`);
    assert.notEqual(to, -1, `Missing AppContext command boundary: ${end}`);
    return appContext.slice(from, to);
  };

  const add = readBody('const addTask = async', 'const updateTaskStatus = async');
  assert.match(add, /await persistTasksAtomically\(/);
  assert.match(add, /setTasks\(/);

  const toggle = readBody('const toggleSubtask = async', 'const deleteTask = async');
  assert.match(toggle, /await persistTasksAtomically\(/);
  assert.match(toggle, /setTasks\(/);

  const remove = readBody('const deleteTask = async', 'const generateTurnoverTasksForCheckout = async');
  assert.match(remove, /await queueBusinessDelete\(/);
  assert.match(remove, /setTasks\(/);

  const turnover = readBody('const generateTurnoverTasksForCheckout = async', 'const addStockMovement = async');
  assert.match(turnover, /await persistTasksAtomically\(/);
  assert.match(turnover, /committedTasks\.length !== generatedTasks\.length/);
});


test('staff creation and optional initial tasks commit as one awaited IndexedDB command', () => {
  const appContext = readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');
  const staffHelperStart = appContext.indexOf('const persistStaffAndTasksAtomically = async');
  const staffHelperEnd = appContext.indexOf('const persistStockMutationsAtomically', staffHelperStart);
  assert.notEqual(staffHelperStart, -1);
  assert.notEqual(staffHelperEnd, -1);
  const helper = appContext.slice(staffHelperStart, staffHelperEnd);
  assert.match(helper, /entity: 'staff_member'/);
  assert.match(helper, /entity: 'task'/);
  assert.match(helper, /await indexedDb\.putLocalBusinessEntitiesAtomically\(mutations\)/);
  assert.match(helper, /await indexedDb\.enqueueWorkspaceUpsertsAtomically\(/);
  assert.match(helper, /committedTasks\.length !== initialTasks\.length/);

  const createStart = appContext.indexOf("const createStaffMember: AppContextType['createStaffMember'] = async");
  const createEnd = appContext.indexOf('const updateStaffAssignment:', createStart);
  assert.notEqual(createStart, -1);
  assert.notEqual(createEnd, -1);
  const create = appContext.slice(createStart, createEnd);
  assert.match(create, /await persistStaffAndTasksAtomically\(record, initialTasks\)/);
  assert.doesNotMatch(create, /commitBusinessUpsert\(/);
  assert.doesNotMatch(create, /initialTasks\.forEach\(/);
  assert.match(create, /return null/);

  const panel = readFileSync(new URL('../src/components/StaffHrPanel.tsx', import.meta.url), 'utf8');
  const submitStart = panel.indexOf('const handleCreateStaffSubmit = async');
  const submitEnd = panel.indexOf('const openAssignmentModal', submitStart);
  assert.notEqual(submitStart, -1);
  assert.notEqual(submitEnd, -1);
  const submit = panel.slice(submitStart, submitEnd);
  assert.match(submit, /await createStaffMember\(/);
  assert.match(submit, /if \(!created\)/);
});


test('staff assignment, career changes and deletion await durable IndexedDB commands', () => {
  const appContext = readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');
  const readBody = (start: string, end: string) => {
    const from = appContext.indexOf(start);
    const to = appContext.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `Missing AppContext command: ${start}`);
    assert.notEqual(to, -1, `Missing AppContext command boundary: ${end}`);
    return appContext.slice(from, to);
  };
  const assignment = readBody("const updateStaffAssignment: AppContextType['updateStaffAssignment'] = async", 'const promoteOrTransferStaff:');
  assert.match(assignment, /await persistStaffAndTasksAtomically\(/);
  assert.match(assignment, /return true/);
  assert.match(assignment, /return false/);
  const career = readBody("const promoteOrTransferStaff: AppContextType['promoteOrTransferStaff'] = async", 'const assignTaskToStaff:');
  assert.match(career, /await persistStaffAndTasksAtomically\(/);
  assert.match(career, /return true/);
  assert.match(career, /return false/);
  const remove = readBody('const deleteStaffMember = async', 'const purgeAllUserData');
  assert.match(remove, /await queueBusinessDelete\('staff_member'/);
  assert.match(remove, /setStaffMembers\(/);
  assert.match(remove, /return false/);

  const panel = readFileSync(new URL('../src/components/StaffHrPanel.tsx', import.meta.url), 'utf8');
  assert.match(panel, /const handleSaveAssignment = async/);
  assert.match(panel, /await updateStaffAssignment\(/);
  assert.match(panel, /const handleSavePromotion = async/);
  assert.match(panel, /await promoteOrTransferStaff\(/);
  assert.match(panel, /await deleteStaffMember\(/);
});


test('supplier and purchase-order CRUD await durable Outbox/tombstone commands before React projections', () => {
  const appContext = readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');
  const readBody = (start: string, end: string) => {
    const from = appContext.indexOf(start);
    const to = appContext.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `Missing AppContext command: ${start}`);
    assert.notEqual(to, -1, `Missing AppContext command boundary: ${end}`);
    return appContext.slice(from, to);
  };
  for (const [start, end] of [
    ["const saveSupplier: AppContextType['saveSupplier'] = async", 'const deleteSupplier = async'],
    ['const createPurchaseOrder: AppContextType[', 'const updatePurchaseOrder = async'],
  ]) {
    const body = readBody(start, end);
    assert.match(body, /await queueBusinessUpsert\(/);
    assert.match(body, /set(Suppliers|PurchaseOrders)\(/);
  }
  const deleteSupplier = readBody('const deleteSupplier = async', 'const createPurchaseOrder:');
  assert.match(deleteSupplier, /await queueBusinessDelete\('supplier'/);
  const updateOrder = readBody('const updatePurchaseOrder = async', 'const deletePurchaseOrder = async');
  assert.match(updateOrder, /await queueBusinessUpsert\(/);
  assert.match(updateOrder, /setPurchaseOrders\(/);
  const deleteOrder = readBody('const deletePurchaseOrder = async', 'const markPurchaseOrderReceived = async');
  assert.match(deleteOrder, /await queueBusinessDelete\('purchase_order'/);
  assert.match(deleteOrder, /setPurchaseOrders\(/);

  const panel = readFileSync(new URL('../src/components/StockManagementView.tsx', import.meta.url), 'utf8');
  assert.match(panel, /const persistOrder = async/);
  assert.match(panel, /await runStockMutation\(\(\) => createPurchaseOrder\(/);
  assert.match(panel, /await runStockMutation\(\(\) => saveSupplier\(/);
  assert.match(panel, /await updatePurchaseOrder\(/);
  assert.match(panel, /await deletePurchaseOrder\(/);
  assert.match(panel, /await deleteSupplier\(/);
});
