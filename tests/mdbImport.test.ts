import test from 'node:test';
import assert from 'node:assert/strict';
import { mdbSnapshotToPlanning, type MdbSnapshot } from '../src/locks/database/mdbImport';

function snapshot(overrides: Partial<MdbSnapshot> = {}): MdbSnapshot {
  return {
    fileName: 'CardLock.mdb', tables: [], fileLastModified: null,
    importedAt: '2026-11-04T00:00:00.000Z',
    buildings: [{ no: 1, name: 'Bâtiment principal' }, { no: 2, name: 'Annexe' }],
    rooms: [
      { building: 1, floor: -1, roomNo: '101', type: 'Single', status: '', price: '', cardCount: 0, maxCards: 2 },
      { building: 2, floor: 2, roomNo: '101', type: 'Double', status: '', price: '8500', cardCount: 1, maxCards: 3 },
    ],
    guests: [
      { roomNo: '2-2-101', name: 'Client valide', comeTime: '2026-11-05T14:00:00.000Z', goTime: '2026-11-07T12:00:00.000Z', cardId: 'C-2', flag: '' },
      { roomNo: '2-999', name: 'Chambre absente', comeTime: '2026-11-05T14:00:00.000Z', goTime: '2026-11-07T12:00:00.000Z', cardId: '', flag: '' },
      { roomNo: '2-1-101', name: 'Étage incohérent', comeTime: '2026-11-05T14:00:00.000Z', goTime: '2026-11-07T12:00:00.000Z', cardId: '', flag: '' },
      { roomNo: '2-2-101', name: 'Dates absentes', comeTime: null, goTime: null, cardId: '', flag: '' },
    ],
    cards: [], systemProfile: null, counts: { cards: 0, guests: 4, rooms: 2, openings: 0 }, warnings: [],
    ...overrides,
  };
}
test('keeps every source building and only source RoomInfo rooms', () => {
  const result = mdbSnapshotToPlanning(snapshot());
  assert.deepEqual(result.resourceGroups.map((group) => group.id), ['mdb-bld-1', 'mdb-bld-2']);
  assert.equal(result.resourceGroups[0].resources.length, 1);
  assert.equal(result.resourceGroups[1].resources.length, 1);
});
test('does not invent a floor or a price when RoomInfo fields are empty', () => {
  const room = mdbSnapshotToPlanning(snapshot()).resourceGroups[0].resources[0];
  assert.equal(room.floor, undefined);
  assert.equal(room.pricePerDay, 0);
});
test('links a stay only to the exact building, floor and room', () => {
  const result = mdbSnapshotToPlanning(snapshot());
  assert.equal(result.bookings.length, 1);
  assert.equal(result.bookings[0].resourceId, result.resourceGroups[1].resources[0].id);
  assert.equal(result.bookings[0].customMetadata?.building, 2);
  assert.equal(result.bookings[0].customMetadata?.floor, 2);
  assert.equal(result.skippedGuests, 3);
  assert.ok(result.warnings.some((warning) => warning.includes('RoomInfo')));
});
test('does not guess when a room number exists in more than one building', () => {
  const source = snapshot({ guests: [{
    roomNo: '101', name: 'Référence ambiguë',
    comeTime: '2026-11-05T14:00:00.000Z', goTime: '2026-11-07T12:00:00.000Z',
    cardId: '', flag: '',
  }] });
  const result = mdbSnapshotToPlanning(source);
  assert.equal(result.bookings.length, 0);
  assert.equal(result.skippedGuests, 1);
});


test('preserves building 0 and floor 0 as valid CardLock identifiers', () => {
  const source = snapshot({
    buildings: [{ no: 0, name: 'Bâtiment zéro' }],
    rooms: [{ building: 0, floor: 0, roomNo: '007', type: 'Single', status: '', price: '', cardCount: 0, maxCards: 2 }],
    guests: [{ roomNo: '0-0-007', name: 'Client zéro', comeTime: '2026-11-05T14:00:00.000Z', goTime: '2026-11-07T12:00:00.000Z', cardId: 'C-0', flag: '' }],
    counts: { cards: 0, guests: 1, rooms: 1, openings: 0 },
  });
  const result = mdbSnapshotToPlanning(source);
  const room = result.resourceGroups[0].resources[0];
  assert.equal(result.resourceGroups[0].id, 'mdb-bld-0');
  assert.equal(room.id, 'mdb-rm-0-007');
  assert.equal(room.building, '0');
  assert.equal(room.floor, '0');
  assert.equal(room.housekeepingStatus, undefined);
  assert.equal(room.pricePerDay, 0);
  assert.equal(result.bookings.length, 1);
  assert.equal(result.bookings[0].customMetadata?.building, 0);
  assert.equal(result.bookings[0].customMetadata?.floor, 0);
});

test('keeps unknown housekeeping status unset instead of marking the room clean', () => {
  const source = snapshot({
    rooms: [{ building: 2, floor: 0, roomNo: '202', type: 'Double', status: 'unknown', price: '0', cardCount: 0, maxCards: 2 }],
    guests: [],
    counts: { cards: 0, guests: 0, rooms: 1, openings: 0 },
  });
  const result = mdbSnapshotToPlanning(source);
  assert.equal(result.resourceGroups[1].resources[0].housekeepingStatus, undefined);
});

test('exposes the restored establishment id and stamps it on every room resource', () => {
  const result = mdbSnapshotToPlanning(snapshot());
  assert.equal(result.establishmentId, 'mdb-bld-1');
  assert.ok(result.resourceGroups[0].resources.length > 0);
  assert.equal(result.resourceGroups[0].resources[0].establishmentId, 'mdb-bld-1');
});

test('returns a null establishment id when the base has no rooms', () => {
  const result = mdbSnapshotToPlanning(snapshot({ buildings: [], rooms: [], guests: [], counts: { cards: 0, guests: 0, rooms: 0, openings: 0 } }));
  assert.equal(result.establishmentId, null);
  assert.equal(result.resourceGroups.length, 0);
});
