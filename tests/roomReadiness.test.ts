import test from 'node:test';
import assert from 'node:assert/strict';
import { isRoomReadyForBooking } from '../src/utils/roomReadiness.ts';

test('only an explicitly clean room is bookable', () => {
  assert.equal(isRoomReadyForBooking('clean'), true);
  assert.equal(isRoomReadyForBooking('dirty'), false);
  assert.equal(isRoomReadyForBooking('cleaning'), false);
  assert.equal(isRoomReadyForBooking('out_of_order'), false);
  assert.equal(isRoomReadyForBooking(undefined), false);
  assert.equal(isRoomReadyForBooking(null), false);
});
