import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ResourceItem, TimelineBooking } from '../src/types/booking';
import { planRoomReassignment } from '../src/utils/roomReassignment';

const resources: ResourceItem[] = [
  { id: 'r1', name: '101', type: 'Room', sector: 'hotel', pricePerDay: 100, housekeepingStatus: 'clean' },
  { id: 'r2', name: '102', type: 'Room', sector: 'hotel', pricePerDay: 120, housekeepingStatus: 'clean' },
  { id: 'r3', name: '103', type: 'Room', sector: 'hotel', pricePerDay: 110, housekeepingStatus: 'out_of_order' },
];

const booking = (id: string, resourceId: string, startDate: string, endDate: string): TimelineBooking => ({
  id, resourceId, resourceName: resourceId, sector: 'hotel',
  guestName: id, guestEmail: '', guestPhone: '', startDate, endDate,
  checkInTime: '14:00', checkOutTime: '12:00', status: 'confirmed',
  totalPrice: 100, paymentStatus: 'pending',
});

test('moves an in-progress stay to a free room when its whole interval is available', () => {
  const current = booking('a', 'r1', '2026-11-25', '2026-11-28');
  const result = planRoomReassignment([current], resources, 'a', 'r2');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.mode, 'move');
    if (result.mode === 'move') assert.equal(result.booking.resourceId, 'r2');
  }
});

test('swaps two reservations atomically when both final room assignments are conflict-free', () => {
  const a = booking('a', 'r1', '2026-11-25', '2026-11-28');
  const b = booking('b', 'r2', '2026-11-26', '2026-11-27');
  const result = planRoomReassignment([a, b], resources, 'a', 'r2');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.mode, 'swap');
    if (result.mode === 'swap') {
      assert.deepEqual(result.bookings.map((item) => item.resourceId), ['r2', 'r1']);
    }
  }
});

test('uses the original room when the edited booking dates and target room change together', () => {
  const original = booking('a', 'r1', '2026-11-25', '2026-11-28');
  const edited = { ...original, resourceId: 'r2', startDate: '2026-11-26', endDate: '2026-11-29' };
  const other = booking('b', 'r2', '2026-11-27', '2026-11-28');
  const result = planRoomReassignment([edited, other], resources, 'a', 'r2', original.resourceId);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.mode, 'swap');
    if (result.mode === 'swap') assert.equal(result.bookings[1].resourceId, 'r1');
  }
});

test('rejects a swap if a third reservation conflicts with either final assignment', () => {
  const a = booking('a', 'r1', '2026-11-25', '2026-11-28');
  const b = booking('b', 'r2', '2026-11-26', '2026-11-27');
  const third = booking('c', 'r1', '2026-11-26', '2026-11-27');
  const result = planRoomReassignment([a, b, third], resources, 'a', 'r2');
  assert.deepEqual(result, { ok: false, reason: 'target_conflict' });
});

test('rejects out-of-order rooms and resources from another sector', () => {
  const a = booking('a', 'r1', '2026-11-25', '2026-11-28');
  assert.deepEqual(planRoomReassignment([a], resources, 'a', 'r3'), { ok: false, reason: 'room_out_of_order' });
  const spa = { ...resources[1], sector: 'spa' as const };
  assert.deepEqual(planRoomReassignment([a], [resources[0], spa], 'a', 'r2'), { ok: false, reason: 'sector_mismatch' });
});
