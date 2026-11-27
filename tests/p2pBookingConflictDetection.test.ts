import assert from 'node:assert/strict';
import test from 'node:test';
import { detectP2pBookingConflicts, isBookingConflictSuperseded } from '../src/services/p2p/bookingConflictDetection';
import type { P2pEvent } from '../src/services/p2p/protocol';

function bookingEvent(nodeId: string, bookingId: string, payload: Record<string, unknown>, sequence = 1): P2pEvent {
  return {
    protocolVersion: 1,
    eventId: `${nodeId}:${sequence}`,
    nodeId,
    sequence,
    workspaceId: 'hotel-1',
    entity: 'booking',
    entityId: bookingId,
    operation: 'upsert',
    payload: { id: bookingId, resourceId: 'room-101', sector: 'hotel', status: 'confirmed', ...payload },
    clock: { [nodeId]: sequence },
    createdAt: '2026-11-26T10:00:00.000Z',
  };
}

const stay = (id: string, startDate: string, endDate: string, extra: Record<string, unknown> = {}) =>
  bookingEvent(`node-${id}`, id, { startDate, endDate, ...extra });

test('detects same-room overlap even when offline devices generated different booking IDs', () => {
  const conflicts = detectP2pBookingConflicts([
    stay('A', '2026-12-01', '2026-12-04'),
    stay('B', '2026-12-03', '2026-12-05'),
  ], '2026-11-26T12:00:00.000Z');
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].firstBookingId, 'A');
  assert.equal(conflicts[0].secondBookingId, 'B');
  assert.equal(conflicts[0].status, 'pending');
});

test('does not report different rooms, cancelled stays, or non-overlapping stays', () => {
  const conflicts = detectP2pBookingConflicts([
    stay('A', '2026-12-01', '2026-12-02'),
    stay('B', '2026-12-02', '2026-12-03'),
    stay('C', '2026-12-01', '2026-12-03', { resourceId: 'room-102' }),
    stay('D', '2026-12-01', '2026-12-03', { status: 'cancelled' }),
  ]);
  assert.equal(conflicts.length, 0);
});

test('applies the ten-minute hotel turnover symmetrically', () => {
  const before = bookingEvent('node-A', 'A', {
    startDate: '2026-12-01', endDate: '2026-12-02', checkOutTime: '12:00',
  });
  const afterWithin = bookingEvent('node-B', 'B', {
    startDate: '2026-12-02', endDate: '2026-12-03', checkInTime: '12:05',
  });
  const afterOutside = bookingEvent('node-C', 'C', {
    startDate: '2026-12-02', endDate: '2026-12-03', checkInTime: '12:10',
  });
  assert.equal(detectP2pBookingConflicts([before, afterWithin]).length, 1);
  assert.equal(detectP2pBookingConflicts([before, afterOutside]).length, 0);
});

test('uses only the causal frontier of each booking and ignores stale versions', () => {
  const stale = stay('A', '2026-12-01', '2026-12-05');
  const newer: P2pEvent = {
    ...stale,
    eventId: 'node-A:2',
    sequence: 2,
    clock: { 'node-A': 2, 'node-B': 1 },
    payload: { ...(stale.payload as object), startDate: '2026-12-01', endDate: '2026-12-02' },
    createdAt: '2026-11-26T10:01:00.000Z',
  };
  const other = stay('B', '2026-12-03', '2026-12-04');
  assert.equal(detectP2pBookingConflicts([stale, newer, other]).length, 0);
});

test('produces stable conflict identifiers independent of event arrival order', () => {
  const a = stay('A', '2026-12-01', '2026-12-04');
  const b = stay('B', '2026-12-03', '2026-12-05');
  const detectedAt = '2026-11-26T12:00:00.000Z';
  assert.deepEqual(
    detectP2pBookingConflicts([a, b], detectedAt),
    detectP2pBookingConflicts([b, a], detectedAt),
  );
});

test('does not compare bookings across workspace boundaries', () => {
  const a = stay('A', '2026-12-01', '2026-12-04');
  const b = { ...stay('B', '2026-12-03', '2026-12-05'), workspaceId: 'another-hotel' };
  assert.equal(detectP2pBookingConflicts([a, b]).length, 0);
});

test('ignores malformed legacy booking intervals without blocking valid records', () => {
  const malformed = stay('A', '2026-02-30', '2026-03-04');
  const valid = stay('B', '2026-03-01', '2026-03-04');
  assert.equal(detectP2pBookingConflicts([malformed, valid]).length, 0);
});


test('marks an overlap superseded only when a newer booking frontier replaces a source event', () => {
  const originalA = stay('A', '2026-12-01', '2026-12-05');
  const originalB = stay('B', '2026-12-03', '2026-12-04');
  const [conflict] = detectP2pBookingConflicts([originalA, originalB]);
  assert.ok(conflict);
  assert.equal(isBookingConflictSuperseded(conflict, [originalA, originalB]), false);

  const newerA: P2pEvent = {
    ...originalA,
    eventId: 'node-A:2',
    sequence: 2,
    clock: { 'node-A': 2, 'node-B': 1 },
    payload: { ...(originalA.payload as object), endDate: '2026-12-02' },
    createdAt: '2026-11-26T10:01:00.000Z',
  };
  assert.equal(detectP2pBookingConflicts([newerA, originalB]).length, 0);
  assert.equal(isBookingConflictSuperseded(conflict, [newerA, originalB]), true);
});

test('does not supersede a conflict when one booking frontier is unavailable', () => {
  const a = stay('A', '2026-12-01', '2026-12-05');
  const b = stay('B', '2026-12-03', '2026-12-04');
  const [conflict] = detectP2pBookingConflicts([a, b]);
  assert.ok(conflict);
  assert.equal(isBookingConflictSuperseded(conflict, [a]), false);
});
