import test from 'node:test';
import assert from 'node:assert/strict';
import { getCardLockBuildingNumbers, getCardLockFloorNumbers } from '../src/locks/cards/scope.ts';

test('keeps CardLock building zero and buildings without rooms', () => {
  assert.deepEqual(getCardLockBuildingNumbers([{ no: 0 }, { no: 1 }, { no: -1 }], [
    { building: 0, floor: 0 }, { building: 1, floor: 2 },
  ]), [0, 1]);
});

test('returns floors only for the selected building and keeps ground floor zero', () => {
  const rooms = [
    { building: 0, floor: 0 }, { building: 0, floor: 1 },
    { building: 1, floor: 1 }, { building: 1, floor: 2 },
  ];
  assert.deepEqual(getCardLockFloorNumbers(rooms, 0), [0, 1]);
  assert.deepEqual(getCardLockFloorNumbers(rooms, 1), [1, 2]);
});
