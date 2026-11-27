import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

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
    '/** Append a local immutable P2P event',
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
