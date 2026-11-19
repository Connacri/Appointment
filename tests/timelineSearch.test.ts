import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeQuickCreateCheckInTime,
  doesBookingMatchQuery,
  doesResourceMatchQuery,
  findMatchingTimelineBookings,
  getResourceSubgroupMeta,
  hasSameDayCheckout,
  isTimelineCellAvailableForQuickCreate,
} from '../src/utils/timelineSearch.ts';
import type { ResourceGroup, ResourceItem, TimelineBooking } from '../src/types/booking.ts';

const sampleRooms: ResourceItem[] = [
  {
    id: 'rm_101',
    name: '101',
    type: 'Single Standard',
    sector: 'hotel',
    pricePerDay: 120,
    housekeepingStatus: 'clean',
    floor: '1',
    wing: 'Aile Nord',
  },
  {
    id: 'rm_204',
    name: '204',
    type: 'Suite Panorama',
    sector: 'hotel',
    pricePerDay: 220,
    housekeepingStatus: 'out_of_order',
    floor: '2',
    wing: 'Aile Sud',
  },
  {
    id: 'res_v1',
    name: 'Villa Emeraude',
    type: 'Villa Luxe',
    sector: 'resort',
    pricePerDay: 450,
    housekeepingStatus: 'clean',
  },
];

const sampleGroups: ResourceGroup[] = [
  {
    id: 'bld_main',
    name: { fr: 'Bâtiment Principal', en: 'Main Building', ar: 'المبنى الرئيسي' },
    sector: 'hotel',
    resources: [sampleRooms[0], sampleRooms[1]],
  },
  {
    id: 'grp_resort',
    name: { fr: 'Villas Resort', en: 'Resort Villas', ar: 'فيلات المنتجع' },
    sector: 'resort',
    resources: [sampleRooms[2]],
  },
];

const sampleBookings: TimelineBooking[] = [
  {
    id: 'RES-2026-8841',
    resourceId: 'rm_101',
    resourceName: '101',
    sector: 'hotel',
    guestName: 'Amélie Benali',
    guestEmail: 'amelie.benali@example.com',
    guestPhone: '+213 550 11 22 33',
    startDate: '2026-11-20',
    endDate: '2026-11-23',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    status: 'confirmed',
    totalPrice: 360,
    paymentStatus: 'paid',
  },
  {
    id: 'bkg_checked_out',
    resourceId: 'rm_101',
    resourceName: '101',
    sector: 'hotel',
    guestName: 'Yacine Toumi',
    guestEmail: 'yacine@example.com',
    guestPhone: '+213 550 44 55 66',
    startDate: '2026-11-16',
    endDate: '2026-11-18',
    checkInTime: '14:00',
    checkOutTime: '14:15',
    actualCheckOutAt: '2026-11-18T14:15:00.000Z',
    status: 'checked_out',
    totalPrice: 240,
    paymentStatus: 'paid',
  },
  {
    id: 'RES-RESORT-99',
    resourceId: 'res_v1',
    resourceName: 'Villa Emeraude',
    sector: 'resort',
    guestName: 'Karim Mansouri',
    guestEmail: 'karim@example.com',
    guestPhone: '+33 6 00 00 00 00',
    startDate: '2026-11-22',
    endDate: '2026-11-25',
    status: 'confirmed',
    totalPrice: 1350,
    paymentStatus: 'paid',
  },
];

describe('timelineSearch utilities', () => {
  it('matches bookings by guest name (accent-insensitive), reservation ID (with or without #), and room number', () => {
    const bkg = sampleBookings[0];
    assert.equal(doesBookingMatchQuery(bkg, 'amelie'), true);
    assert.equal(doesBookingMatchQuery(bkg, 'BENALI'), true);
    assert.equal(doesBookingMatchQuery(bkg, '8841'), true);
    assert.equal(doesBookingMatchQuery(bkg, '#RES-2026-8841'), true);
    assert.equal(doesBookingMatchQuery(bkg, '101'), true);
    assert.equal(doesBookingMatchQuery(bkg, '999'), false);
  });

  it('matches resources directly by room number or indirectly via an attached booking ID', () => {
    const roomBookings = sampleBookings.filter((b) => b.resourceId === 'rm_101');
    assert.equal(doesResourceMatchQuery(sampleRooms[0], roomBookings, '101'), true);
    assert.equal(doesResourceMatchQuery(sampleRooms[0], roomBookings, 'RES-2026-8841'), true);
    assert.equal(doesResourceMatchQuery(sampleRooms[0], roomBookings, 'Amélie'), true);
    assert.equal(doesResourceMatchQuery(sampleRooms[1], [], '101'), false);
  });

  it('finds domain-scoped booking matches with building and floor keys sorted chronologically', () => {
    const matches = findMatchingTimelineBookings({
      bookings: sampleBookings,
      resourceGroups: sampleGroups,
      query: '101',
      currentDomain: 'hotel',
      selectedBuildingGroupId: 'all',
      groupingMode: 'floor',
      language: 'fr',
    });

    assert.equal(matches.length, 2);
    assert.equal(matches[0].booking.id, 'bkg_checked_out');
    assert.equal(matches[1].booking.id, 'RES-2026-8841');
    assert.equal(matches[0].groupId, 'bld_main');
    assert.equal(matches[0].floorKey, '1');

    // Never leaks resort bookings into hotel search
    const resortCross = findMatchingTimelineBookings({
      bookings: sampleBookings,
      resourceGroups: sampleGroups,
      query: 'Karim',
      currentDomain: 'hotel',
      selectedBuildingGroupId: 'all',
      groupingMode: 'floor',
      language: 'fr',
    });
    assert.equal(resortCross.length, 0);
  });

  it('honours the selected local building for both hotel and resort domains', () => {
    const hotelMatches = findMatchingTimelineBookings({
      bookings: sampleBookings,
      resourceGroups: sampleGroups,
      query: '101',
      currentDomain: 'hotel',
      selectedBuildingGroupId: 'bld_main',
      groupingMode: 'floor',
      language: 'fr',
    });
    assert.deepEqual(hotelMatches.map((m) => m.booking.id), ['bkg_checked_out', 'RES-2026-8841']);

    const otherHotelBuilding = findMatchingTimelineBookings({
      bookings: sampleBookings,
      resourceGroups: sampleGroups,
      query: '101',
      currentDomain: 'hotel',
      selectedBuildingGroupId: 'grp_resort',
      groupingMode: 'floor',
      language: 'fr',
    });
    assert.equal(otherHotelBuilding.length, 0);

    const resortMatches = findMatchingTimelineBookings({
      bookings: sampleBookings,
      resourceGroups: sampleGroups,
      query: 'Karim',
      currentDomain: 'resort',
      selectedBuildingGroupId: 'grp_resort',
      groupingMode: 'floor',
      language: 'fr',
    });
    assert.deepEqual(resortMatches.map((m) => m.booking.id), ['RES-RESORT-99']);
  });

  it('derives consistent floor/wing subgroup metadata', () => {
    const meta = getResourceSubgroupMeta(sampleRooms[0], 'floor_wing', 'fr');
    assert.equal(meta.key, '1_Aile Nord');
    assert.equal(meta.label, 'Étage 1 • Aile Nord');
  });

  it('evaluates empty bookable cells and computes quick-create check-in time after same-day turnover', () => {
    const today = '2026-11-18';
    const room101Bookings = sampleBookings.filter((b) => b.resourceId === 'rm_101');

    // Past date is not bookable
    assert.equal(
      isTimelineCellAvailableForQuickCreate(sampleRooms[0], '2026-11-17', today, room101Bookings),
      false
    );
    // Out-of-order room is not bookable
    assert.equal(
      isTimelineCellAvailableForQuickCreate(sampleRooms[1], '2026-11-19', today, []),
      false
    );
    // Occupied nights (Nov 20, 21, 22) are not empty
    assert.equal(
      isTimelineCellAvailableForQuickCreate(sampleRooms[0], '2026-11-20', today, room101Bookings),
      false
    );
    assert.equal(
      isTimelineCellAvailableForQuickCreate(sampleRooms[0], '2026-11-21', today, room101Bookings),
      false
    );
    // Checkout day (Nov 18) and free gap day (Nov 19) ARE available for Quick Create
    assert.equal(
      isTimelineCellAvailableForQuickCreate(sampleRooms[0], '2026-11-18', today, room101Bookings),
      true
    );
    assert.equal(
      isTimelineCellAvailableForQuickCreate(sampleRooms[0], '2026-11-19', today, room101Bookings),
      true
    );

    // Same-day checkout turnover adds 10 minutes to actual checkout time
    assert.equal(hasSameDayCheckout('2026-11-18', room101Bookings), true);
    assert.equal(hasSameDayCheckout('2026-11-19', room101Bookings), false);
    assert.equal(computeQuickCreateCheckInTime('2026-11-18', room101Bookings), '14:25');
    assert.equal(computeQuickCreateCheckInTime('2026-11-19', room101Bookings), '14:00');
  });
});
