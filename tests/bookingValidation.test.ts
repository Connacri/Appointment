import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isValidBookingDateRange,
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

test('allows same-day bookings but rejects an end date before the start date', () => {
  assert.equal(isValidBookingDateRange('2026-11-20', '2026-11-20'), true);
  assert.equal(isValidBookingDateRange('2026-11-20', '2026-11-21'), true);
  assert.equal(isValidBookingDateRange('2026-11-21', '2026-11-20'), false);
  assert.equal(isValidBookingDateRange('2026-11-20', 'invalid'), false);
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
  assert.equal(planning.resourceGroups[0].resources[0].id, 'mdb-rm-1-1-101');
  assert.equal(planning.resourceGroups[1].resources[0].id, 'mdb-rm-2-1-101');
  assert.equal(planning.bookings[0].resourceId, 'mdb-rm-1-1-101');
  assert.equal(planning.bookings[1].resourceId, 'mdb-rm-2-1-101');
});

test('CardLock import resolves three-part building-floor-room stay references', () => {
  const snapshot: MdbSnapshot = {
    fileName: 'CardLock(1).mdb',
    fileLastModified: null,
    importedAt: '2026-11-03T00:00:00.000Z',
    buildings: [{ no: 1, name: 'Bâtiment principal' }, { no: 2, name: 'Annexe' }],
    rooms: [
      { building: 1, floor: 1, roomNo: '12064', type: 'Single', status: '', price: '8000', cardCount: 0, maxCards: 2 },
      { building: 1, floor: 3, roomNo: '3012', type: 'Suite', status: '', price: '20000', cardCount: 0, maxCards: 2 },
      { building: 2, floor: 1, roomNo: '12074', type: 'Double', status: '', price: '12000', cardCount: 0, maxCards: 2 },
    ],
    guests: [
      { roomNo: '1-1-12064', name: 'Client étage 1', comeTime: '2026-11-04T14:00:00.000Z', goTime: '2026-11-06T11:00:00.000Z', cardId: '1', flag: '' },
      { roomNo: '1-3-3012', name: 'Client étage 3', comeTime: '2026-11-04T14:00:00.000Z', goTime: '2026-11-06T11:00:00.000Z', cardId: '2', flag: '' },
      { roomNo: '2-1-12074', name: 'Client annexe', comeTime: '2026-11-04T14:00:00.000Z', goTime: '2026-11-06T11:00:00.000Z', cardId: '3', flag: '' },
    ],
    cards: [],
    systemProfile: null,
    counts: { cards: 0, guests: 3, rooms: 3, openings: 0 },
    warnings: [],
  };

  const planning = mdbSnapshotToPlanning(snapshot);
  assert.deepEqual(
    planning.bookings.map((booking) => [booking.resourceId, booking.customMetadata?.floor]),
    [
      ['mdb-rm-1-1-12064', 1],
      ['mdb-rm-1-3-3012', 3],
      ['mdb-rm-2-1-12074', 1],
    ]
  );
});

test('CardLock import preserves building, floor and room type as separate Gantt dimensions', () => {
  const snapshot: MdbSnapshot = {
    fileName: 'CardLock.mdb',
    fileLastModified: null,
    importedAt: '2026-11-03T00:00:00.000Z',
    buildings: [{ no: 1, name: 'Bâtiment principal' }, { no: 3, name: 'Annexe' }],
    rooms: [
      { building: 1, floor: 1, roomNo: '101', type: 'Single', status: '', price: '8000', cardCount: 0, maxCards: 2 },
      { building: 1, floor: 1, roomNo: '102', type: 'Double', status: '', price: '12000', cardCount: 0, maxCards: 2 },
      { building: 1, floor: 2, roomNo: '201', type: 'Suite', status: '', price: '20000', cardCount: 0, maxCards: 2 },
      { building: 3, floor: 1, roomNo: '101', type: 'Studio', status: '', price: '10000', cardCount: 0, maxCards: 2 },
    ],
    guests: [],
    cards: [],
    systemProfile: null,
    counts: { cards: 0, guests: 0, rooms: 4, openings: 0 },
    warnings: [],
  };

  const planning = mdbSnapshotToPlanning(snapshot);
  assert.deepEqual(planning.resourceGroups.map((group) => group.name.fr), ['Bâtiment principal', 'Annexe']);
  assert.deepEqual(
    planning.resourceGroups[0].resources.map((room) => [room.name, room.building, room.floor, room.type]),
    [
      ['101', '1', '1', 'Single'],
      ['102', '1', '1', 'Double'],
      ['201', '1', '2', 'Suite'],
    ]
  );
  assert.deepEqual(
    planning.resourceGroups[1].resources.map((room) => [room.name, room.building, room.floor, room.type]),
    [['101', '3', '1', 'Studio']]
  );
});

test('CardLock import does not fabricate building or floor 1 when source fields are missing', () => {
  const snapshot: MdbSnapshot = {
    fileName: 'CardLock.mdb',
    fileLastModified: null,
    importedAt: '2026-11-03T00:00:00.000Z',
    buildings: [],
    rooms: [
      { building: -1, floor: -1, roomNo: 'X01', type: 'Chambre spéciale', status: '', price: '', cardCount: 0, maxCards: 1 },
    ],
    guests: [],
    cards: [],
    systemProfile: null,
    counts: { cards: 0, guests: 0, rooms: 1, openings: 0 },
    warnings: [],
  };

  const planning = mdbSnapshotToPlanning(snapshot);
  assert.deepEqual(planning.resourceGroups, []);
  assert.equal(planning.bookings.length, 0);
  assert.ok(planning.warnings.some((warning) => warning.includes('1 chambre(s) exclue(s)')));
});



import { hasBookingScheduleConflict } from '../src/utils/bookingValidation';
import type { TimelineBooking } from '../src/types/booking';

const scheduleBooking = (
  id: string,
  startDate: string,
  endDate: string,
  overrides: Partial<TimelineBooking> = {},
): TimelineBooking => ({
  id,
  resourceId: 'room-101',
  resourceName: '101',
  sector: 'hotel',
  guestName: id,
  guestEmail: '',
  guestPhone: '',
  startDate,
  endDate,
  checkInTime: '14:00',
  checkOutTime: '12:00',
  status: 'confirmed',
  totalPrice: 100,
  paymentStatus: 'pending',
  ...overrides,
});

test('booking update guard detects overlaps against a different booking ID', () => {
  const existing = scheduleBooking('existing', '2026-11-27', '2026-11-29');
  const candidate = scheduleBooking('edited', '2026-11-28', '2026-11-30');
  assert.equal(hasBookingScheduleConflict([existing], candidate, 'edited'), true);
});

test('booking update guard applies the hotel turnover buffer in both directions', () => {
  const existing = scheduleBooking('existing', '2026-11-27', '2026-11-28');
  const candidateAfter = scheduleBooking('edited', '2026-11-28', '2026-11-29', {
    checkInTime: '12:05',
  });
  const candidateBefore = scheduleBooking('edited', '2026-11-26', '2026-11-27', {
    checkOutTime: '13:55',
  });
  assert.equal(hasBookingScheduleConflict([existing], candidateAfter, 'edited'), true);
  assert.equal(hasBookingScheduleConflict([existing], candidateBefore, 'edited'), true);
});

test('booking update guard allows a sufficient turnover gap and ignores cancelled bookings', () => {
  const existing = scheduleBooking('existing', '2026-11-27', '2026-11-28');
  const candidate = scheduleBooking('edited', '2026-11-28', '2026-11-29', {
    checkInTime: '12:11',
  });
  assert.equal(hasBookingScheduleConflict([existing], candidate, 'edited'), false);
  assert.equal(
    hasBookingScheduleConflict([{ ...existing, status: 'cancelled' }], candidate, 'edited'),
    false,
  );
});

test('booking update guard fails closed for an invalid candidate interval', () => {
  const candidate = scheduleBooking('edited', '2026-11-29', '2026-11-28');
  assert.equal(hasBookingScheduleConflict([], candidate, 'edited'), true);
});

test('booking update guard ignores malformed legacy intervals rather than blocking all edits', () => {
  const malformed = scheduleBooking('legacy', 'not-a-date', '2026-11-28');
  const candidate = scheduleBooking('edited', '2026-11-28', '2026-11-29');
  assert.equal(hasBookingScheduleConflict([malformed], candidate, 'edited'), false);
});


test('booking write validation rejects a second concurrent same-resource reservation before persistence', () => {
  const existing = scheduleBooking('booking-a', '2026-11-27', '2026-11-29');
  const concurrent = scheduleBooking('booking-b', '2026-11-28', '2026-11-30');
  assert.equal(hasBookingScheduleConflict([existing], concurrent, concurrent.id), true);
});

test('booking write validation permits a non-overlapping reservation for the same resource', () => {
  const existing = scheduleBooking('booking-a', '2026-11-27', '2026-11-29');
  const later = scheduleBooking('booking-b', '2026-11-29', '2026-11-30', { checkInTime: '12:20' });
  assert.equal(hasBookingScheduleConflict([existing], later, later.id), false);
});
