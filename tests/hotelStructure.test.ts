import test from 'node:test';
import assert from 'node:assert/strict';
import { generateHotelFloorRooms } from '../src/utils/hotelStructure';

test('generates floor-local room numbers and excludes room suffix 13 by default', () => {
  const result = generateHotelFloorRooms({
    buildingNumber: 1, floorNumber: 1, prefix: '1', start: 1, end: 15,
  });
  assert.deepEqual(result.rooms.map((room) => room.name), [
    '101','102','103','104','105','106','107','108','109','110','111','112','114','115',
  ]);
  assert.deepEqual(result.excluded, ['113']);
});

test('preserves padded numbering and applies custom exclusions', () => {
  const result = generateHotelFloorRooms({
    buildingNumber: 2, floorNumber: 3, start: 1, end: 4, padWidth: 2,
    excludedFloorNumbers: ['02'],
  });
  assert.deepEqual(result.rooms.map((room) => room.name), ['01','03','04']);
  assert.deepEqual(result.excluded, ['02']);
});

test('does not create existing room names twice', () => {
  const result = generateHotelFloorRooms({
    buildingNumber: 1, floorNumber: 2, prefix: '2', start: 1, end: 3, padWidth: 2,
    existingNames: ['201'],
  });
  assert.deepEqual(result.rooms.map((room) => room.name), ['202','203']);
  assert.deepEqual(result.duplicates, ['201']);
});

test('rejects invalid and excessive room ranges', () => {
  assert.throws(() => generateHotelFloorRooms({
    buildingNumber: 1, floorNumber: 0, start: 20, end: 10,
  }));
  assert.throws(() => generateHotelFloorRooms({
    buildingNumber: 1, floorNumber: 0, start: 1, end: 2000,
  }));
});
