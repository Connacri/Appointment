import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeAvailabilityByDay } from '../src/utils/availability';
import type { ResourceItem, TimelineBooking } from '../src/types/booking';

const days = ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21'].map((dateStr) => ({ dateStr }));

const makeResource = (id: string): ResourceItem => ({
  id,
  groupId: 'grp-1',
  name: id,
  type: 'Chambre',
  sector: 'hotel',
  pricePerDay: 8000,
});

const makeBooking = (
  id: string,
  resourceId: string,
  startDate: string,
  endDate: string,
  status: TimelineBooking['status'] = 'confirmed',
): TimelineBooking => ({
  id,
  resourceId,
  resourceName: resourceId,
  sector: 'hotel',
  guestName: `Guest ${id}`,
  guestEmail: '',
  guestPhone: '',
  startDate,
  endDate,
  status,
  totalPrice: 8000,
  paymentStatus: 'pending',
});

const index = (bookings: TimelineBooking[]) => {
  const map = new Map<string, TimelineBooking[]>();
  for (const booking of bookings) {
    const bucket = map.get(booking.resourceId) ?? [];
    bucket.push(booking);
    map.set(booking.resourceId, bucket);
  }
  return map;
};

test('availability subtracts each occupied night and frees the checkout day', () => {
  const resources = [makeResource('room-101'), makeResource('room-102')];
  const bookings = [makeBooking('bkg-1', 'room-101', '2026-11-18', '2026-11-20')];

  assert.deepEqual(computeAvailabilityByDay(resources, index(bookings), days), {
    '2026-11-18': 1,
    '2026-11-19': 1,
    '2026-11-20': 2,
    '2026-11-21': 2,
  });
});

test('availability counts a double-booked resource only once', () => {
  const resources = [makeResource('room-101'), makeResource('room-102')];
  const bookings = [
    makeBooking('bkg-1', 'room-101', '2026-11-18', '2026-11-20'),
    makeBooking('bkg-2', 'room-101', '2026-11-19', '2026-11-21'),
  ];

  assert.deepEqual(computeAvailabilityByDay(resources, index(bookings), days), {
    '2026-11-18': 1,
    '2026-11-19': 1,
    '2026-11-20': 1,
    '2026-11-21': 2,
  });
});

test('availability ignores cancelled bookings and bookings outside the window', () => {
  const resources = [makeResource('room-101'), makeResource('room-102')];
  const bookings = [
    makeBooking('bkg-cancelled', 'room-101', '2026-11-18', '2026-11-21', 'cancelled'),
    makeBooking('bkg-past', 'room-101', '2026-11-01', '2026-11-05'),
    makeBooking('bkg-future', 'room-102', '2026-12-01', '2026-12-05'),
  ];

  assert.deepEqual(computeAvailabilityByDay(resources, index(bookings), days), {
    '2026-11-18': 2,
    '2026-11-19': 2,
    '2026-11-20': 2,
    '2026-11-21': 2,
  });
});

test('availability clamps long bookings to the rendered window', () => {
  const resources = [makeResource('room-101'), makeResource('room-102')];
  const bookings = [makeBooking('bkg-long', 'room-101', '2026-11-01', '2026-12-15')];

  assert.deepEqual(computeAvailabilityByDay(resources, index(bookings), days), {
    '2026-11-18': 1,
    '2026-11-19': 1,
    '2026-11-20': 1,
    '2026-11-21': 1,
  });
});

test('availability returns an empty record without resources or days', () => {
  assert.deepEqual(computeAvailabilityByDay([], index([]), days), {});
  assert.deepEqual(computeAvailabilityByDay([makeResource('room-101')], index([]), []), {});
});
