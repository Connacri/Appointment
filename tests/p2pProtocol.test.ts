import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getP2pRecordState,
  happensBefore,
  maximalP2pEvents,
  mergeP2pEvents,
  nextP2pClock,
  validateP2pEvent,
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

test('builds a monotonically increasing local clock', () => {
  assert.deepEqual(nextP2pClock({ 'node-a': 3, 'node-b': 7 }, 'node-a'), {
    sequence: 4,
    clock: { 'node-a': 4, 'node-b': 7 },
  });
});

test('merges replicas by set union and is idempotent', () => {
  const a = event('node-a', 1, { 'node-a': 1 });
  const b = event('node-b', 1, { 'node-a': 1, 'node-b': 1 });
  const merged = mergeP2pEvents([a], [b, a]);
  assert.equal(merged.length, 2);
  assert.deepEqual(mergeP2pEvents(merged, [a, b]), merged);
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
