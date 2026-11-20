import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ResourceGroup, TimelineBooking } from '../src/types/booking';
import {
  buildBookingSearchText,
  DEFAULT_BOOKING_FINDER_FILTERS,
  findBookings,
  matchesElasticQuery,
} from '../src/utils/bookingFinder';

const makeBooking = (id: string, overrides: Partial<TimelineBooking> = {}): TimelineBooking => ({
  id,
  resourceId: 'room-101',
  resourceName: '101',
  sector: 'hotel',
  guestName: 'Amélie Martin',
  guestEmail: 'amelie@example.com',
  guestPhone: '0550 12 34 56',
  startDate: '2026-11-25',
  endDate: '2026-11-28',
  status: 'confirmed',
  totalPrice: 45000,
  paymentStatus: 'pending',
  ...overrides,
});

const groups: ResourceGroup[] = [
  {
    id: 'grp-1',
    name: { fr: 'Bâtiment A', en: 'Building A', ar: 'مبنى أ' },
    sector: 'hotel',
    resources: [
      {
        id: 'room-101',
        groupId: 'grp-1',
        name: '101',
        type: 'Chambre Mer',
        sector: 'hotel',
        pricePerDay: 15000,
        floor: '2',
        building: 'Bâtiment A',
        view: 'Mer',
        amenities: ['balcon', 'wifi'],
      },
    ],
  },
];

test('matchesElasticQuery is diacritic-insensitive, token-based and tolerant of typos', () => {
  const haystack = buildBookingSearchText({
    booking: makeBooking('b1'),
    resource: groups[0].resources[0],
  });
  assert.equal(matchesElasticQuery(haystack, ''), true);
  assert.equal(matchesElasticQuery(haystack, 'amelie'), true);
  assert.equal(matchesElasticQuery(haystack, 'amélie 101 mer'), true);
  assert.equal(matchesElasticQuery(haystack, '0550123456'), true);
  // Every token must match; a subsequence fallback bridges small omissions.
  assert.equal(matchesElasticQuery(haystack, 'amelie 999'), false);
  assert.equal(matchesElasticQuery(haystack, 'chmbre'), true);
});

test('buildBookingSearchText includes room and guest details, not just names', () => {
  const text = buildBookingSearchText({
    booking: makeBooking('b1', { identityNumber: 'AA123456', notes: 'anniversaire' }),
    resource: groups[0].resources[0],
    groupLabel: 'Bâtiment A',
  });
  for (const needle of ['aa123456', 'anniversaire', 'chambre', 'mer', 'etage', 'balcon', 'batiment']) {
    assert.ok(text.includes(needle), `missing ${needle} in ${text}`);
  }
});

test('findBookings applies status, payment, period and sector filters', () => {
  const bookings = [
    makeBooking('b-active', { startDate: '2026-11-19', endDate: '2026-11-21', status: 'checked_in' }),
    makeBooking('b-next', { startDate: '2026-12-01', endDate: '2026-12-03', status: 'confirmed' }),
    makeBooking('b-old', { startDate: '2026-10-01', endDate: '2026-10-03', status: 'checked_out' }),
    makeBooking('b-resort', { sector: 'resort', resourceName: 'Villa 4', startDate: '2026-12-02', endDate: '2026-12-04' }),
  ];
  const find = (query: string, filters = DEFAULT_BOOKING_FINDER_FILTERS) =>
    findBookings({
      bookings,
      resourceGroups: groups,
      query,
      filters,
      todayIso: '2026-11-20',
    }).map((hit) => hit.booking.id);

  assert.deepEqual(find(''), ['b-resort', 'b-next', 'b-active', 'b-old']);
  assert.deepEqual(find('', { ...DEFAULT_BOOKING_FINDER_FILTERS, status: 'confirmed' }), ['b-resort', 'b-next']);
  assert.deepEqual(find('', { ...DEFAULT_BOOKING_FINDER_FILTERS, payment: 'paid' }), []);
  assert.deepEqual(find('', { ...DEFAULT_BOOKING_FINDER_FILTERS, period: 'current' }), ['b-active']);
  assert.deepEqual(find('', { ...DEFAULT_BOOKING_FINDER_FILTERS, period: 'upcoming' }), ['b-resort', 'b-next']);
  assert.deepEqual(find('', { ...DEFAULT_BOOKING_FINDER_FILTERS, period: 'past' }), ['b-old']);
  assert.deepEqual(find('', { ...DEFAULT_BOOKING_FINDER_FILTERS, sector: 'hotel' }), ['b-next', 'b-active', 'b-old']);
});

test('findBookings searches any room or guest detail and narrows results', () => {
  const bookings = [
    makeBooking('b1'),
    makeBooking('b2', { guestName: 'Karim Bensalem', resourceId: 'room-other', resourceName: 'Villa 7', guestPhone: '0770 00 00 00' }),
  ];
  const find = (query: string) =>
    findBookings({ bookings, resourceGroups: groups, query, todayIso: '2026-11-20' }).map((hit) => hit.booking.id);

  assert.deepEqual(find('balcon'), ['b1']);
  assert.deepEqual(find('etage 2'), ['b1']);
  assert.deepEqual(find('batiment'), ['b1']);
  assert.deepEqual(find('villa 7'), ['b2']);
  assert.deepEqual(find('0770000000'), ['b2']);
  assert.deepEqual(find('bensalem'), ['b2']);
  assert.deepEqual(find('inexistant'), []);
});
