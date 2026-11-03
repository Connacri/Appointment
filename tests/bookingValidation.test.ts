import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isValidCalendarDate,
  shouldMarkPaymentAsPaid,
} from '../src/utils/bookingValidation';

test('accepts real ISO calendar dates', () => {
  assert.equal(isValidCalendarDate('2026-11-02'), true);
  assert.equal(isValidCalendarDate('2024-02-29'), true);
});

test('rejects impossible or non-ISO calendar dates', () => {
  assert.equal(isValidCalendarDate('2026-02-31'), false);
  assert.equal(isValidCalendarDate('2025-02-29'), false);
  assert.equal(isValidCalendarDate('02/11/2026'), false);
  assert.equal(isValidCalendarDate('2026-13-01'), false);
});

test('pending payment stays pending when cash was not received', () => {
  assert.equal(shouldMarkPaymentAsPaid('pending', false), false);
  assert.equal(shouldMarkPaymentAsPaid(undefined, false), false);
});

test('payment settles only after explicit cash receipt or if already paid', () => {
  assert.equal(shouldMarkPaymentAsPaid('pending', true), true);
  assert.equal(shouldMarkPaymentAsPaid('paid', false), true);
});
import { waitForTransactionCompletion } from '../src/db/indexedDbTransaction';

test('IndexedDB writes resolve only after the transaction commits', async () => {
  const transaction = new EventTarget() as EventTarget & { error: DOMException | null };
  transaction.error = null;
  let settled = false;
  const completion = waitForTransactionCompletion(
    transaction as unknown as IDBTransaction,
    'test write'
  ).then(() => {
    settled = true;
  });

  // A request may succeed while its containing transaction is still pending.
  await Promise.resolve();
  assert.equal(settled, false);

  transaction.dispatchEvent(new Event('complete'));
  await completion;
  assert.equal(settled, true);
});

test('IndexedDB transaction abort rejects the write promise', async () => {
  const transaction = new EventTarget() as EventTarget & { error: DOMException | null };
  transaction.error = new DOMException('Quota exceeded', 'QuotaExceededError');
  const completion = waitForTransactionCompletion(
    transaction as unknown as IDBTransaction,
    'test write'
  );

  transaction.dispatchEvent(new Event('abort'));
  await assert.rejects(completion, /Quota exceeded/);
});

test('IndexedDB transaction errors reject instead of reporting success', async () => {
  const transaction = new EventTarget() as EventTarget & { error: DOMException | null };
  transaction.error = new DOMException('Constraint violation', 'ConstraintError');
  const completion = waitForTransactionCompletion(
    transaction as unknown as IDBTransaction,
    'test write'
  );

  transaction.dispatchEvent(new Event('error'));
  await assert.rejects(completion, /Constraint violation/);
});

import { mdbSnapshotToPlanning, type MdbSnapshot } from '../src/locks/database/mdbImport';

test('CardLock import recovers buildings missing from BuildingInfo using RoomInfo.BldNo', () => {
  const snapshot: MdbSnapshot = {
    fileName: 'CardLock.mdb',
    fileLastModified: null,
    importedAt: '2026-11-03T00:00:00.000Z',
    // Simulate a legacy MDB where BuildingInfo contains only the first building.
    buildings: [{ no: 1, name: 'Bâtiment Centre' }],
    rooms: [
      { building: 1, floor: 1, roomNo: '101', type: 'Double', status: '', price: '10000', cardCount: 1, maxCards: 2 },
      { building: 2, floor: 2, roomNo: '201', type: 'Suite', status: '', price: '20000', cardCount: 0, maxCards: 2 },
    ],
    guests: [],
    cards: [],
    systemProfile: null,
    counts: { cards: 0, guests: 0, rooms: 2, openings: 0 },
    warnings: [],
  };

  const planning = mdbSnapshotToPlanning(snapshot);
  assert.deepEqual(planning.resourceGroups.map((group) => group.id), ['mdb-bld-1', 'mdb-bld-2']);
  assert.equal(planning.resourceGroups[1].name.fr, 'Bâtiment 2');
  assert.equal(planning.resourceGroups[1].resources.length, 1);
});

test('CardLock import uses building-qualified room IDs and links stays to the correct building', () => {
  const snapshot: MdbSnapshot = {
    fileName: 'CardLock.mdb',
    fileLastModified: null,
    importedAt: '2026-11-03T00:00:00.000Z',
    buildings: [{ no: 1, name: 'Centre' }, { no: 2, name: 'Plage' }],
    rooms: [
      { building: 1, floor: 1, roomNo: '101', type: 'Double', status: '', price: '10000', cardCount: 0, maxCards: 2 },
      { building: 2, floor: 1, roomNo: '101', type: 'Double', status: '', price: '12000', cardCount: 0, maxCards: 2 },
    ],
    guests: [
      { roomNo: '1-101', name: 'Client Centre', comeTime: '2026-11-04T14:00:00.000Z', goTime: '2026-11-06T11:00:00.000Z', cardId: '1', flag: '' },
      { roomNo: '2-101', name: 'Client Plage', comeTime: '2026-11-04T14:00:00.000Z', goTime: '2026-11-06T11:00:00.000Z', cardId: '2', flag: '' },
    ],
    cards: [],
    systemProfile: null,
    counts: { cards: 0, guests: 2, rooms: 2, openings: 0 },
    warnings: [],
  };

  const planning = mdbSnapshotToPlanning(snapshot);
  assert.equal(planning.resourceGroups[0].resources[0].id, 'mdb-rm-1-101');
  assert.equal(planning.resourceGroups[1].resources[0].id, 'mdb-rm-2-101');
  assert.equal(planning.bookings[0].resourceId, 'mdb-rm-1-101');
  assert.equal(planning.bookings[1].resourceId, 'mdb-rm-2-101');
});
