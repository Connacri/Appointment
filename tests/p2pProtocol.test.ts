import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createP2pEvent,
  getP2pRecordState,
  happensBefore,
  maximalP2pEvents,
  mergeP2pEvents,
  nextP2pClock,
  validateP2pEvent,
  validateP2pCursorAdvance,
  type P2pEvent,
} from '../src/services/p2p/protocol';

function event(
  nodeId: string,
  sequence: number,
  clock: Record<string, number>,
  payload: Record<string, unknown> | null = { value: sequence },
  operation: 'upsert' | 'delete' = 'upsert',
): P2pEvent {
  return {
    protocolVersion: 1,
    eventId: `${nodeId}:${sequence}`,
    nodeId,
    sequence,
    workspaceId: 'workspace-1',
    entity: 'booking',
    entityId: 'booking-1',
    operation,
    payload,
    clock,
    createdAt: '2026-11-22T12:00:00.000Z',
  };
}

test('validates immutable event identity and causal clock', () => {
  validateP2pEvent(event('node-a', 1, { 'node-a': 1 }));
  assert.throws(() => validateP2pEvent(event('node-a', 1, { 'node-a': 0 })), /own node sequence/);
  assert.throws(() => validateP2pEvent({ ...event('node-a', 1, { 'node-a': 1 }), eventId: 'forged' }), /event ID/);
});

test('rejects unknown operations and array payloads before projection', () => {
  const invalidOperation = {
    ...event('node-a', 1, { 'node-a': 1 }),
    operation: 'truncate',
  } as unknown as P2pEvent;
  const arrayPayload = {
    ...event('node-a', 1, { 'node-a': 1 }),
    payload: ['not', 'a', 'record'],
  } as unknown as P2pEvent;

  assert.throws(() => validateP2pEvent(invalidOperation), /Unsupported P2P event operation/);
  assert.throws(() => validateP2pEvent(arrayPayload), /plain object payload/);
});

test('builds a monotonically increasing local clock', () => {
  assert.deepEqual(nextP2pClock({ 'node-a': 3, 'node-b': 7 }, 'node-a'), {
    sequence: 4,
    clock: { 'node-a': 4, 'node-b': 7 },
  });
});

test('new local events causally include every observed remote clock component', () => {
  const receivedClock = { 'node-b': 9, 'node-c': 4 };
  const local = createP2pEvent({
    nodeId: 'node-a',
    workspaceId: 'workspace-1',
    entity: 'booking',
    entityId: 'booking-2',
    operation: 'upsert',
    payload: { id: 'booking-2' },
    createdAt: '2026-11-23T09:02:00.000Z',
    observedClock: receivedClock,
  });

  assert.equal(local.sequence, 1);
  assert.equal(local.clock['node-a'], 1);
  assert.equal(local.clock['node-b'], 9);
  assert.equal(local.clock['node-c'], 4);
});

test('empty inbound pages cannot advance a durable peer cursor', () => {
  assert.equal(validateP2pCursorAdvance(0, 0, 0), true);
  assert.equal(validateP2pCursorAdvance(0, 1, 0), false);
  assert.equal(validateP2pCursorAdvance(4, 5, 1), true);
  assert.equal(validateP2pCursorAdvance(4, 4, 1), false);
  assert.equal(validateP2pCursorAdvance(-1, 0, 0), false);
  assert.equal(validateP2pCursorAdvance(0, 1.5, 1), false);
  assert.equal(validateP2pCursorAdvance(0, 1, -1), false);
});

test('rotating the installation identity prevents event sequence ID reuse after purge', () => {
  const beforePurge = createP2pEvent({
    nodeId: 'node-before-purge',
    workspaceId: 'workspace-1',
    entity: 'booking',
    entityId: 'booking-1',
    operation: 'upsert',
    payload: { id: 'booking-1' },
    createdAt: '2026-11-23T09:00:00.000Z',
    observedClock: {},
  });
  const afterPurge = createP2pEvent({
    nodeId: 'node-after-purge',
    workspaceId: 'workspace-1',
    entity: 'booking',
    entityId: 'booking-1',
    operation: 'upsert',
    payload: { id: 'booking-1' },
    createdAt: '2026-11-23T09:01:00.000Z',
    observedClock: {},
  });

  assert.equal(beforePurge.sequence, 1);
  assert.equal(afterPurge.sequence, 1);
  assert.notEqual(beforePurge.eventId, afterPurge.eventId);
});

test('creates a validated durable-mutation event without losing unknown payload fields', () => {
  const payload = {
    id: 'resource-1',
    futureField: { nested: ['preserve', 42] },
  };
  const created = createP2pEvent({
    nodeId: 'node-a',
    workspaceId: 'workspace-1',
    entity: 'resource',
    entityId: 'resource-1',
    operation: 'upsert',
    payload,
    createdAt: '2026-11-23T09:00:00.000Z',
    observedClock: { 'node-b': 8 },
  });

  assert.equal(created.eventId, 'node-a:1');
  assert.equal(created.clock['node-a'], 1);
  assert.equal(created.clock['node-b'], 8);
  assert.deepEqual(created.payload, payload);
  validateP2pEvent(created);
});

test('merges replicas by set union and is idempotent', () => {
  const a = event('node-a', 1, { 'node-a': 1 });
  const b = event('node-b', 1, { 'node-a': 1, 'node-b': 1 });
  const merged = mergeP2pEvents([a], [b, a]);
  assert.equal(merged.length, 2);
  assert.deepEqual(mergeP2pEvents(merged, [a, b]), merged);
});

test('a local event can advance from a persisted remote causal frontier', () => {
  const remote = event('node-remote', 7, {
    'node-remote': 7,
    'node-third': 3,
  }, { id: 'booking-4', guest: 'Remote' });
  const local = createP2pEvent({
    nodeId: 'node-local',
    workspaceId: 'workspace-1',
    entity: 'booking',
    entityId: 'booking-4',
    operation: 'upsert',
    payload: { id: 'booking-4', guest: 'Local edit' },
    createdAt: '2026-11-23T09:03:00.000Z',
    observedClock: remote.clock,
  });

  assert.equal(local.clock['node-remote'], 7);
  assert.equal(local.clock['node-third'], 3);
  assert.equal(local.clock['node-local'], 1);
});

test('concurrent P2P branches remain an explicit conflict, never last-writer-wins', () => {
  const left = event('node-left', 1, { 'node-left': 1 }, { id: 'booking-3', guest: 'Left' });
  const right = event('node-right', 1, { 'node-right': 1 }, { id: 'booking-3', guest: 'Right' });

  const state = getP2pRecordState(mergeP2pEvents([left], [right]));
  assert.equal(state.kind, 'conflict');
  if (state.kind === 'conflict') assert.equal(state.events.length, 2);
});

test('exact P2P event replay remains idempotent across IndexedDB replicas', () => {
  const original = event('node-a', 4, { 'node-a': 4 }, {
    id: 'booking-1',
    futureField: { preserved: true },
  });
  const replayed = { ...original, clock: { ...original.clock }, payload: { ...original.payload } };

  const merged = mergeP2pEvents([original], [replayed]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0], original);
});

test('rejects node equivocation instead of accepting conflicting duplicate IDs', () => {
  const original = event('node-a', 1, { 'node-a': 1 }, { value: 'original' });
  const forged = event('node-a', 1, { 'node-a': 1 }, { value: 'forged' });
  assert.throws(() => mergeP2pEvents([original], [forged]), /equivocation/);
});

test('recognizes causal succession and converges to the causally latest event', () => {
  const first = event('node-a', 1, { 'node-a': 1 });
  const second = event('node-b', 1, { 'node-a': 1, 'node-b': 1 }, { value: 'later' });
  assert.equal(happensBefore(first, second), true);
  assert.equal(getP2pRecordState([second, first]).kind, 'resolved');
  const state = getP2pRecordState([second, first]);
  assert.equal(state.kind === 'resolved' ? state.event.payload?.value : null, 'later');
});

test('requires all observed vector-clock components for causal succession', () => {
  const prior = event('node-a', 2, { 'node-a': 2, 'node-c': 5 });
  const inconsistentSuccessor = event(
    'node-b',
    2,
    { 'node-a': 2, 'node-b': 2, 'node-c': 4 },
  );

  assert.equal(happensBefore(prior, inconsistentSuccessor), false);
  assert.equal(getP2pRecordState([prior, inconsistentSuccessor]).kind, 'conflict');
});

test('preserves concurrent booking edits as a conflict on every replica', () => {
  const left = event('node-a', 2, { 'node-a': 2, 'node-b': 1 }, { guest: 'Alice' });
  const right = event('node-b', 2, { 'node-a': 1, 'node-b': 2 }, { guest: 'Bob' });
  const mergedAB = mergeP2pEvents([left], [right]);
  const mergedBA = mergeP2pEvents([right], [left]);
  assert.deepEqual(mergedAB, mergedBA);
  assert.deepEqual(maximalP2pEvents(mergedAB), [left, right]);
  assert.equal(getP2pRecordState(mergedAB).kind, 'conflict');
});

test('a concurrent delete and update remains a conflict, not silent resurrection', () => {
  const deletion = event('node-a', 2, { 'node-a': 2, 'node-b': 1 }, null, 'delete');
  const update = event('node-b', 2, { 'node-a': 1, 'node-b': 2 }, { guest: 'Updated' });
  const state = getP2pRecordState(mergeP2pEvents([deletion], [update]));
  assert.equal(state.kind, 'conflict');
});
