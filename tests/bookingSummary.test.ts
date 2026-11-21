import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildBookingModalSummary,
  buildGuestCheckoutPayload,
  resolveHeldValuablesOnCheckout,
} from '../src/utils/bookingSummary';
import type { TimelineBooking } from '../src/types/booking';

function makeBooking(overrides: Partial<TimelineBooking> = {}): TimelineBooking {
  return {
    id: 'bkg_101',
    resourceId: 'res_101',
    resourceName: 'Chambre 101',
    sector: 'hotel',
    guestName: 'Amine Benali',
    guestEmail: 'amine@example.com',
    guestPhone: '0550123456',
    guestType: 'algerian',
    adults: 2,
    children: 1,
    startDate: '2026-11-20',
    endDate: '2026-11-23',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    status: 'confirmed',
    paymentStatus: 'paid',
    totalPrice: 24000,
    originalCurrencyAmount: 165,
    paymentCurrency: 'EUR',
    ...overrides,
  };
}

test('buildBookingModalSummary extracts all reservation summary details cleanly', () => {
  const summary = buildBookingModalSummary(makeBooking(), 'DA');

  assert.equal(summary.roomName, 'Chambre 101');
  assert.equal(summary.status, 'confirmed');
  assert.equal(summary.guestName, 'Amine Benali');
  assert.equal(summary.guestType, 'algerian');
  assert.equal(summary.adults, 2);
  assert.equal(summary.children, 1);
  assert.equal(summary.totalOccupants, 3);
  assert.equal(summary.startDate, '2026-11-20');
  assert.equal(summary.endDate, '2026-11-23');
  assert.equal(summary.checkInTime, '14:00');
  assert.equal(summary.checkOutTime, '12:00');
  assert.equal(summary.displayAmount, 165);
  assert.equal(summary.currency, 'EUR');
  assert.equal(summary.paymentStatus, 'paid');
});

test('buildBookingModalSummary falls back safely when optional fields are missing', () => {
  const summary = buildBookingModalSummary(
    makeBooking({
      resourceName: '',
      adults: undefined,
      children: undefined,
      guestType: undefined,
      nationality: 'Française',
      originalCurrencyAmount: undefined,
      paymentCurrency: undefined,
      checkInTime: undefined,
      checkOutTime: undefined,
    }),
    'DA',
    'Suite 101'
  );

  assert.equal(summary.roomName, 'Suite 101');
  assert.equal(summary.guestType, 'foreigner');
  assert.equal(summary.totalOccupants, 1);
  assert.equal(summary.displayAmount, 24000);
  assert.equal(summary.currency, 'DA');
  assert.equal(summary.checkInTime, '14:00');
  assert.equal(summary.checkOutTime, '12:00');
});

test('buildGuestCheckoutPayload computes local date, checkout time, ISO timestamp, and +10min turnover', () => {
  const morning = new Date(2026, 10, 21, 9, 55, 12);
  const payload = buildGuestCheckoutPayload(morning);

  assert.equal(payload.endDate, '2026-11-21');
  assert.equal(payload.checkOutTime, '09:55');
  assert.equal(payload.status, 'checked_out');
  assert.equal(payload.turnoverReadyAt, '10:05');
  assert.equal(payload.actualCheckOutAt, morning.toISOString());

  const nearMidnight = new Date(2026, 10, 21, 23, 54, 0);
  assert.equal(buildGuestCheckoutPayload(nearMidnight).turnoverReadyAt, '00:04');
});

test('resolveHeldValuablesOnCheckout resolves held valuables without window.confirm', () => {
  const updated = resolveHeldValuablesOnCheckout(
    [
      { id: 'v1', description: 'Passeport', recordedAt: '2026-11-20', status: 'held' },
      { id: 'v2', description: 'Montre', recordedAt: '2026-11-20', status: 'held' },
      { id: 'v3', description: 'Clés voiture', recordedAt: '2026-11-19', status: 'returned', returnedAt: '2026-11-20' },
    ],
    { v1: true, v2: false },
    '2026-11-21T11:00:00.000Z'
  );

  assert.equal(updated[0].status, 'returned');
  assert.equal(updated[0].returnedAt, '2026-11-21T11:00:00.000Z');
  assert.equal(updated[1].status, 'forgotten');
  assert.equal(updated[2].status, 'returned');
  assert.equal(updated[2].returnedAt, '2026-11-20');
});
