import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPoliceSheetDataFromBooking,
  filterBookingsForPrintReport,
  getPoliceSheetMissingFields,
} from '../src/utils/bookingPrintReport';
import { ResourceGroup, TimelineBooking } from '../src/types/booking';

const resourceGroups: ResourceGroup[] = [
  {
    id: 'grp_main',
    name: { fr: 'Pavillon Principal', en: 'Main Wing', ar: 'الجناح الرئيسي' },
    sector: 'hotel',
    resources: [
      {
        id: 'rm_101',
        groupId: 'grp_main',
        name: '101',
        type: 'Single',
        sector: 'hotel',
        pricePerDay: 100,
        building: '1',
        floor: '1',
      },
      {
        id: 'rm_102',
        groupId: 'grp_main',
        name: '102',
        type: 'Double',
        sector: 'hotel',
        pricePerDay: 120,
        building: '1',
        floor: '1',
      },
    ],
  },
  {
    id: 'grp_annexe',
    name: { fr: 'Annexe Mer', en: 'Sea Annex', ar: 'ملحق البحر' },
    sector: 'hotel',
    resources: [
      {
        id: 'rm_201',
        groupId: 'grp_annexe',
        name: '201',
        type: 'Suite',
        sector: 'hotel',
        pricePerDay: 200,
        building: '2',
        floor: '2',
      },
    ],
  },
];

const bookings: TimelineBooking[] = [
  {
    id: 'b_today_arrival',
    resourceId: 'rm_101',
    resourceName: '101',
    sector: 'hotel',
    guestName: 'Karim Benali',
    guestEmail: 'karim@example.com',
    guestPhone: '0550000001',
    startDate: '2026-11-20',
    endDate: '2026-11-23',
    status: 'confirmed',
    totalPrice: 300,
    paymentStatus: 'paid',
    adults: 2,
    children: 1,
    guestType: 'algerian',
    idPieceType: 'cni',
    idPieceNumber: '109876543210',
    wilayaOfOrigin: '31 - Oran',
    paymentCurrency: 'DA',
    originalCurrencyAmount: 43650,
    currencyRateToDzd: 1,
    paymentMethodType: 'cib',
  },
  {
    id: 'b_in_house',
    resourceId: 'rm_102',
    resourceName: '102',
    sector: 'hotel',
    guestName: 'Nadia Mansouri',
    guestEmail: 'nadia@example.com',
    guestPhone: '0550000002',
    startDate: '2026-11-18',
    endDate: '2026-11-20',
    status: 'checked_in',
    totalPrice: 240,
    paymentStatus: 'pending',
    adults: 1,
    children: 0,
    guestType: 'foreigner',
    nationality: 'Française',
    passportNumber: 'FR998877',
  },
  {
    id: 'b_future',
    resourceId: 'rm_201',
    resourceName: '201',
    sector: 'hotel',
    guestName: 'Yacine Khelifi',
    guestEmail: 'yacine@example.com',
    guestPhone: '0550000003',
    startDate: '2026-11-25',
    endDate: '2026-11-27',
    status: 'confirmed',
    totalPrice: 400,
    paymentStatus: 'paid',
    adults: 2,
    children: 0,
  },
  {
    id: 'b_cancelled',
    resourceId: 'rm_101',
    resourceName: '101',
    sector: 'hotel',
    guestName: 'Annulé Test',
    guestEmail: '',
    guestPhone: '',
    startDate: '2026-11-20',
    endDate: '2026-11-21',
    status: 'cancelled',
    totalPrice: 100,
    paymentStatus: 'pending',
  },
];

test('filters today reservations and excludes cancelled by default', () => {
  const result = filterBookingsForPrintReport({
    bookings,
    resourceGroups,
    fromDate: '2026-11-20',
    toDate: '2026-11-20',
  });

  assert.equal(result.isValidRange, true);
  assert.deepEqual(
    result.hits.map((h) => h.booking.id),
    ['b_in_house', 'b_today_arrival']
  );
  assert.equal(result.summary.totalBookings, 2);
  assert.equal(result.summary.arrivalsCount, 1);
  assert.equal(result.summary.departuresCount, 1);
  assert.equal(result.summary.totalAmount, 540);
});

test('supports arrivals-only and departures-only scopes within a date interval', () => {
  const arrivals = filterBookingsForPrintReport({
    bookings,
    resourceGroups,
    fromDate: '2026-11-20',
    toDate: '2026-11-26',
    scope: 'arrivals',
  });
  assert.deepEqual(
    arrivals.hits.map((h) => h.booking.id),
    ['b_today_arrival', 'b_future']
  );

  const departures = filterBookingsForPrintReport({
    bookings,
    resourceGroups,
    fromDate: '2026-11-20',
    toDate: '2026-11-20',
    scope: 'departures',
  });
  assert.deepEqual(
    departures.hits.map((h) => h.booking.id),
    ['b_in_house']
  );
});

test('filters by building group and includes cancelled when requested', () => {
  const annexeOnly = filterBookingsForPrintReport({
    bookings,
    resourceGroups,
    fromDate: '2026-11-20',
    toDate: '2026-11-28',
    buildingGroupId: 'grp_annexe',
  });
  assert.deepEqual(
    annexeOnly.hits.map((h) => h.booking.id),
    ['b_future']
  );
  assert.match(annexeOnly.hits[0].buildingLabel, /Annexe Mer/);

  const withCancelled = filterBookingsForPrintReport({
    bookings,
    resourceGroups,
    fromDate: '2026-11-20',
    toDate: '2026-11-20',
    includeCancelled: true,
  });
  assert.equal(withCancelled.hits.length, 3);
});

test('rejects an inverted date interval safely without throwing', () => {
  const invalid = filterBookingsForPrintReport({
    bookings,
    resourceGroups,
    fromDate: '2026-11-25',
    toDate: '2026-11-20',
  });
  assert.equal(invalid.isValidRange, false);
  assert.equal(invalid.hits.length, 0);
});

test('maps bookings to official police sheet fields and flags incomplete ID or visa', () => {
  const karimSheet = buildPoliceSheetDataFromBooking({
    booking: bookings[0],
    resource: resourceGroups[0].resources[0],
    defaultCurrency: 'DA',
  });
  assert.equal(karimSheet.guestType, 'algerian');
  assert.equal(karimSheet.idPieceNumber, '109876543210');
  assert.equal(karimSheet.calculatedDays, 3);
  assert.equal(karimSheet.priceInPaymentCurrency, 43650);
  assert.equal(karimSheet.priceInDzd, 43650);
  assert.equal(karimSheet.paymentMethodType, 'cib');
  assert.deepEqual(getPoliceSheetMissingFields(karimSheet, 'fr'), []);

  const nadiaSheet = buildPoliceSheetDataFromBooking({
    booking: bookings[1],
    resource: resourceGroups[0].resources[1],
    defaultCurrency: 'EUR',
  });
  assert.equal(nadiaSheet.guestType, 'foreigner');
  assert.equal(nadiaSheet.idPieceType, 'passport');
  assert.equal(nadiaSheet.passportNumber, 'FR998877');
  assert.equal(nadiaSheet.calculatedDays, 2);
  assert.deepEqual(getPoliceSheetMissingFields(nadiaSheet, 'fr'), ['N° visa']);
});

