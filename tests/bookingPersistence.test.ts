import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isDemoBookingId } from '../src/utils/bookingPersistence';

test('only an explicitly listed booking ID is classified as demo data', () => {
  const demoBookingIds = new Set(['demo-booking-1']);
  assert.equal(isDemoBookingId('demo-booking-1', demoBookingIds), true);
  assert.equal(isDemoBookingId('real-booking-1', demoBookingIds), false);
});

test('a real booking remains real regardless of the resource inventory classification', () => {
  const demoBookingIds = new Set(['demo-booking-1']);
  const realBooking = { id: 'real-booking-1', resourceId: 'demo-room-1' };
  assert.equal(isDemoBookingId(realBooking.id, demoBookingIds), false);
});
