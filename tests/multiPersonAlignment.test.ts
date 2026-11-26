import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TimelineBooking } from '../src/types/booking';
import {
  buildNormalizedOccupantList,
  normalizeBookingForPersistence,
} from '../src/utils/bookingOccupants';
import { validateBookingOccupants } from '../src/utils/bookingValidation';
import { migrateBookingRecordV7, type StoredBookingRecord } from '../src/db/bookingMigration';
import {
  BOOKING_SELECT_COLUMNS,
  fromSupabaseBookingRow,
  toSupabaseBookingRow,
} from '../src/services/supabase/bookingMapper';
import { computeBookingDiff } from '../src/utils/eventLog';
import { buildBookingSearchText, matchesElasticQuery } from '../src/utils/bookingFinder';
import { doesBookingMatchQuery } from '../src/utils/timelineSearch';
import {
  buildPoliceSheetDataFromBooking,
  getPoliceSheetCompanionMissingFields,
  getPoliceSheetMissingFields,
} from '../src/utils/bookingPrintReport';

const baseBooking: TimelineBooking = {
  id: 'bkg-multi-1',
  resourceId: 'room-101',
  resourceName: 'Suite 101',
  sector: 'hotel',
  guestName: 'Karim Benali',
  guestEmail: 'karim.benali@hotel-oran.dz',
  guestPhone: '+213 550 11 22 33',
  startDate: '2026-11-21',
  endDate: '2026-11-24',
  checkInTime: '14:00',
  checkOutTime: '12:00',
  status: 'confirmed',
  totalPrice: 450,
  paymentStatus: 'partial',
  adults: 2,
  children: 1,
  idPieceType: 'cni',
  idPieceNumber: '1002003004',
  idDocumentExpiryDate: '2031-05-01',
  guestType: 'algerian',
  nationality: 'Algérienne',
  wilayaOfOrigin: 'Oran',
  customMetadata: {
    hotelAdults: 2,
    hotelChildren: 1,
    vipNote: 'Vue mer souhaitée',
  },
};

test('buildNormalizedOccupantList synchronizes Person #1, additional adults, children and legacy entries without fabricating contacts', () => {
  const normalized = normalizeBookingForPersistence({
    ...baseBooking,
    guestEmail: '',
    guestPhone: '',
    adults: 1,
    children: 0,
    customMetadata: { hotelAdults: 1, hotelChildren: 0 },
  });

  assert.equal(normalized.adults, 1);
  assert.equal(normalized.children, 0);
  assert.equal(normalized.guestEmail, '');
  assert.equal(normalized.guestPhone, '');
  assert.equal(normalized.occupantsList?.length, 1);
  assert.equal(normalized.occupantsList?.[0]?.fullName, 'Karim Benali');
  assert.equal(normalized.occupantsList?.[0]?.isPrimary, true);
  assert.equal(normalized.occupantsList?.[0]?.documentNumber, '1002003004');

  const legacySummary = buildNormalizedOccupantList({
    sector: 'hotel',
    guestName: 'Nadia Mansour',
    guestPhone: '+213 661 44 55 66',
    guestEmail: 'nadia@oran.dz',
    idPieceType: 'passport',
    idPieceNumber: 'P998877',
    adults: 2,
    children: 1,
    adultGuests: [
      { name: 'Nadia Mansour', isAdult: true, idDoc: 'passport:P998877' },
      {
        name: 'Yacine Mansour',
        isAdult: true,
        phone: '+213 661 77 88 99',
        email: 'yacine@oran.dz',
        idDoc: 'cni:88776655',
      },
      {
        name: 'Lina Mansour',
        isAdult: false,
        phone: '+213 661 44 55 66',
        email: 'nadia@oran.dz',
        documentType: 'family_book',
        documentNumber: 'LF-2020-12',
      },
    ],
  });

  assert.equal(legacySummary.adultsCount, 2);
  assert.equal(legacySummary.childrenCount, 1);
  assert.equal(legacySummary.totalOccupants, 3);
  assert.equal(legacySummary.adults[1].fullName, 'Yacine Mansour');
  assert.equal(legacySummary.adults[1].documentType, 'cni');
  assert.equal(legacySummary.adults[1].documentNumber, '88776655');
  assert.equal(legacySummary.children[0].role, 'child');
  assert.equal(legacySummary.children[0].isAdult, false);
  assert.equal(legacySummary.children[0].fullName, 'Lina Mansour');
  assert.equal(legacySummary.children[0].documentType, 'family_book');
});

test('validateBookingOccupants requires identity for every occupant while all phone numbers and emails remain optional', () => {
  // Incomplete second adult & missing child: missing companion phone is allowed, malformed email & missing identity fail
  const missingResult = validateBookingOccupants(
    {
      ...baseBooking,
      adults: 2,
      children: 1,
      occupantsList: [
        {
          id: 'adult-1',
          role: 'adult',
          isAdult: true,
          isPrimary: true,
          fullName: 'Karim Benali',
          phone: '+213 550 11 22 33',
          email: '',
          documentType: 'cni',
          documentNumber: '1002003004',
        },
        {
          id: 'adult-2',
          role: 'adult',
          isAdult: true,
          isPrimary: false,
          fullName: 'Salima Benali',
          phone: '',
          email: 'not-an-email',
          documentType: 'cni',
          documentNumber: '',
        },
      ],
    },
    'fr'
  );

  assert.equal(missingResult.valid, false);
  assert.equal(missingResult.requiresAllOccupants, true);
  assert.equal(missingResult.totalPeople, 3);
  assert.equal(missingResult.errors.some((e) => e.personIndex === 0 && e.field === 'email'), false);
  assert.equal(missingResult.errors.some((e) => e.personIndex === 1 && e.field === 'phone'), false);
  assert.ok(missingResult.errors.some((e) => e.personIndex === 1 && e.field === 'email'));
  assert.ok(missingResult.errors.some((e) => e.personIndex === 1 && e.field === 'documentNumber'));
  assert.ok(missingResult.errors.some((e) => e.personIndex === 2 && e.role === 'child' && e.field === 'fullName'));
  assert.equal(missingResult.errors.some((e) => e.personIndex === 2 && e.role === 'child' && e.field === 'phone'), false);
  assert.equal(missingResult.errors.some((e) => e.personIndex === 2 && e.role === 'child' && e.field === 'email'), false);
  assert.ok(missingResult.errors.some((e) => e.personIndex === 2 && e.role === 'child' && e.field === 'documentNumber'));

  // Resort multi-person check (ar & en messages)
  const resortInvalid = validateBookingOccupants(
    {
      ...baseBooking,
      sector: 'resort',
      adults: 3,
      children: 0,
      customMetadata: { resortOccupants: 3 },
      occupantsList: [],
    },
    'ar'
  );
  assert.equal(resortInvalid.valid, false);
  assert.equal(resortInvalid.totalPeople, 3);
  assert.match(resortInvalid.summaryError ?? '', /3/);

  // Primary guest without phone in multi-person booking is valid
  const missingPrimaryPhone = validateBookingOccupants(
    {
      ...baseBooking,
      guestPhone: '',
      adults: 2,
      children: 0,
      occupantsList: [
        {
          id: 'adult-1',
          role: 'adult',
          isAdult: true,
          isPrimary: true,
          fullName: 'Karim Benali',
          phone: '',
          email: '',
          documentType: 'cni',
          documentNumber: '1002003004',
        },
        {
          id: 'adult-2',
          role: 'adult',
          isAdult: true,
          isPrimary: false,
          fullName: 'Salima Benali',
          phone: '',
          email: '',
          documentType: 'cni',
          documentNumber: '2003004005',
        },
      ],
    },
    'fr'
  );
  assert.equal(missingPrimaryPhone.valid, true, missingPrimaryPhone.summaryError);
  assert.equal(missingPrimaryPhone.errors.some((e) => e.field === 'phone'), false);

  const malformedOptionalPhone = validateBookingOccupants({
    ...baseBooking,
    guestPhone: 'not-a-phone',
    adults: 2,
    children: 0,
    occupantsList: [
      {
        id: 'adult-1', role: 'adult', isAdult: true, isPrimary: true,
        fullName: 'Karim Benali', phone: 'not-a-phone', email: '',
        documentType: 'cni', documentNumber: '1002003004',
      },
      {
        id: 'adult-2', role: 'adult', isAdult: true, isPrimary: false,
        fullName: 'Salima Benali', phone: '', email: '',
        documentType: 'cni', documentNumber: '2003004005',
      },
    ],
  });
  assert.equal(malformedOptionalPhone.valid, false);
  assert.ok(malformedOptionalPhone.errors.some((e) => e.personIndex === 0 && e.field === 'phone'));

  // Complete 1-adult + 1-child booking succeeds WITHOUT any email or child phone
  const validHotelFamily = validateBookingOccupants(
    {
      ...baseBooking,
      guestEmail: '',
      adults: 1,
      children: 1,
      occupantsList: [
        {
          id: 'adult-1',
          role: 'adult',
          isAdult: true,
          isPrimary: true,
          fullName: 'Karim Benali',
          phone: '+213 550 11 22 33',
          email: '',
          documentType: 'cni',
          documentNumber: '1002003004',
        },
        {
          id: 'child-2',
          role: 'child',
          isAdult: false,
          isPrimary: false,
          fullName: 'Adam Benali',
          phone: '',
          email: '',
          documentType: 'passport',
          documentNumber: 'P1122334',
        },
      ],
    },
    'en'
  );
  assert.equal(validHotelFamily.valid, true, validHotelFamily.summaryError);
  assert.equal(validHotelFamily.errors.length, 0);

  // Special authorization missing description must fail
  const missingSpecialAuth = validateBookingOccupants(
    {
      ...baseBooking,
      adults: 2,
      children: 0,
      idPieceType: 'special_authorization',
      specialAuthorizationDesc: '   ',
      occupantsList: [
        {
          id: 'adult-1',
          role: 'adult',
          isAdult: true,
          isPrimary: true,
          fullName: 'Karim Benali',
          phone: '+213 550 11 22 33',
          email: 'karim.benali@hotel-oran.dz',
          documentType: 'special_authorization',
          documentNumber: 'AUTH-01',
        },
        {
          id: 'adult-2',
          role: 'adult',
          isAdult: true,
          isPrimary: false,
          fullName: 'Salima Benali',
          phone: '+213 550 99 88 77',
          email: 'salima@hotel-oran.dz',
          documentType: 'cni',
          documentNumber: '2003004005',
        },
      ],
    },
    'fr'
  );
  assert.equal(missingSpecialAuth.valid, false);
  assert.ok(missingSpecialAuth.errors.some((e) => e.field === 'specialAuthorizationDesc'));

  // Single-person booking stays valid without fabricating email/phone, yet rejects malformed ones
  const singleEmptyContacts = validateBookingOccupants({
    ...baseBooking,
    adults: 1,
    children: 0,
    guestEmail: '',
    guestPhone: '',
    customMetadata: { hotelAdults: 1, hotelChildren: 0 },
  });
  assert.equal(singleEmptyContacts.valid, true);
  assert.equal(singleEmptyContacts.requiresAllOccupants, false);

  const singleMalformedEmail = validateBookingOccupants({
    ...baseBooking,
    adults: 1,
    children: 0,
    guestEmail: 'invalid-email',
    customMetadata: { hotelAdults: 1, hotelChildren: 0 },
  });
  assert.equal(singleMalformedEmail.valid, false);
  assert.equal(singleMalformedEmail.errors[0]?.field, 'email');
});

test('toSupabaseBookingRow and fromSupabaseBookingRow perform lossless multi-person and PMS metadata round-trip', () => {
  const fullBooking: TimelineBooking = {
    ...baseBooking,
    paymentCurrency: 'EUR',
    originalCurrencyAmount: 450,
    currencyRateToDzd: 145.5,
    paymentMethodType: 'cash_forex',
    payments: [
      { id: 'pay-1', amount: 200, date: '2026-11-21', method: 'cash', status: 'paid' },
    ],
    guestType: 'foreigner',
    nationality: 'Française',
    idPieceType: 'passport',
    idPieceNumber: 'FR998877',
    passportNumber: 'FR998877',
    visaNumber: 'VISA-2026-44',
    idDocumentExpiryDate: '2030-09-15',
    visaExpiryDate: '2027-02-01',
    entryDateInCountry: '2026-11-20',
    mealPlan: 'HB',
    mealPlanDietPreferences: ['Halal', 'Sans gluten'],
    valuablesAtReception: [
      { id: 'val-1', description: 'Passeports', depositedAt: '2026-11-21T14:30:00Z', status: 'held' },
    ],
    forgottenItems: [
      { id: 'fgt-1', description: 'Chargeur USB-C', recordedAt: '2026-11-24T10:00:00Z', status: 'pending' },
    ],
    guestAlerts: [
      { id: 'alt-1', text: 'Lit bébé installé', category: 'housekeeping', severity: 'info', createdAt: '2026-11-21T12:00:00Z' },
    ],
    modificationHistory: [
      { id: 'mod-1', timestamp: '2026-11-21T12:15:00Z', user: 'Réception', summary: 'Ajout enfant' },
    ],
    occupantsList: [
      {
        id: 'adult-1',
        role: 'adult',
        isAdult: true,
        isPrimary: true,
        fullName: 'Karim Benali',
        phone: '+213 550 11 22 33',
        email: 'karim.benali@hotel-oran.dz',
        documentType: 'passport',
        documentNumber: 'FR998877',
        documentExpiryDate: '2030-09-15',
      },
      {
        id: 'adult-2',
        role: 'adult',
        isAdult: true,
        isPrimary: false,
        fullName: 'Salima Benali',
        phone: '+213 550 99 88 77',
        email: 'salima.benali@hotel-oran.dz',
        documentType: 'cni',
        documentNumber: '2003004005',
      },
      {
        id: 'child-3',
        role: 'child',
        isAdult: false,
        isPrimary: false,
        fullName: 'Adam Benali',
        phone: '+213 550 11 22 33',
        email: 'karim.benali@hotel-oran.dz',
        documentType: 'passport',
        documentNumber: 'FR112233',
      },
    ],
  };

  const row = toSupabaseBookingRow('ws-1', 'est-1', fullBooking, 'user-1');
  assert.ok(BOOKING_SELECT_COLUMNS.includes('occupants'));
  assert.ok(BOOKING_SELECT_COLUMNS.includes('guest_metadata'));
  assert.ok(BOOKING_SELECT_COLUMNS.includes('payments_summary'));

  assert.equal(row.adults, 2);
  assert.equal(row.children, 1);
  assert.equal(row.currency, 'EUR');
  assert.equal(Array.isArray(row.occupants), true);
  assert.equal((row.occupants as unknown[]).length, 3);

  const restored = fromSupabaseBookingRow(row as unknown as Record<string, unknown>);
  assert.equal(restored.adults, 2);
  assert.equal(restored.children, 1);
  assert.equal(restored.occupantsList?.length, 3);
  assert.equal(restored.adultGuests?.length, 2);
  assert.equal(restored.occupantsList?.[1]?.email, 'salima.benali@hotel-oran.dz');
  assert.equal(restored.occupantsList?.[2]?.role, 'child');
  assert.equal(restored.occupantsList?.[2]?.fullName, 'Adam Benali');
  assert.equal(restored.paymentCurrency, 'EUR');
  assert.equal(restored.originalCurrencyAmount, 450);
  assert.equal(restored.currencyRateToDzd, 145.5);
  assert.equal(restored.paymentMethodType, 'cash_forex');
  assert.equal(restored.payments?.length, 1);
  assert.equal(restored.visaNumber, 'VISA-2026-44');
  assert.equal(restored.entryDateInCountry, '2026-11-20');
  assert.deepEqual(restored.mealPlanDietPreferences, ['Halal', 'Sans gluten']);
  assert.equal(restored.valuablesAtReception?.[0]?.description, 'Passeports');
  assert.equal(restored.forgottenItems?.[0]?.description, 'Chargeur USB-C');
  assert.equal(restored.guestAlerts?.[0]?.text, 'Lit bébé installé');
  assert.equal(restored.modificationHistory?.[0]?.summary, 'Ajout enfant');
  assert.equal(restored.customMetadata?.vipNote, 'Vue mer souhaitée');
  assert.equal('_pms' in (restored.customMetadata ?? {}), false);
});

test('migrateBookingRecordV7 backfills missing occupant lists while preserving sync metadata', () => {
  const legacyRecord: Partial<StoredBookingRecord> = {
    id: 'bkg-legacy-1',
    resourceId: 'room-202',
    resourceName: '202',
    sector: 'hotel',
    guestName: 'Amine Khelifi',
    guestEmail: '',
    guestPhone: '+213 770 10 20 30',
    startDate: '2026-11-22',
    endDate: '2026-11-24',
    status: 'confirmed',
    totalPrice: 200,
    paymentStatus: 'pending',
    customMetadata: {
      hotelAdults: 2,
      hotelChildren: 1,
    },
    workspaceId: 'ws-local',
    establishmentId: 'est-local',
    syncVersion: 4,
    deletedAt: null,
  };

  const migrated = migrateBookingRecordV7(legacyRecord);
  assert.equal(migrated.workspaceId, 'ws-local');
  assert.equal(migrated.establishmentId, 'est-local');
  assert.equal(migrated.syncVersion, 4);
  assert.equal(migrated.deletedAt, null);
  assert.equal(migrated.adults, 2);
  assert.equal(migrated.children, 1);
  assert.equal(migrated.adultGuests?.length, 2);
  assert.equal(migrated.occupantsList?.length, 3);
  assert.equal(migrated.guestEmail, '');
});

test('search, eventLog diff and police sheet report handle multi-person co-occupants & children accurately', () => {
  const multiBooking: TimelineBooking = normalizeBookingForPersistence({
    ...baseBooking,
    occupantsList: [
      {
        id: 'adult-1',
        role: 'adult',
        isAdult: true,
        isPrimary: true,
        fullName: 'Karim Benali',
        phone: '+213 550 11 22 33',
        email: 'karim.benali@hotel-oran.dz',
        documentType: 'cni',
        documentNumber: '1002003004',
      },
      {
        id: 'adult-2',
        role: 'adult',
        isAdult: true,
        isPrimary: false,
        fullName: 'Salima Benali',
        phone: '+213 550 99 88 77',
        email: 'salima.benali@hotel-oran.dz',
        documentType: 'cni',
        documentNumber: '2003004005',
      },
      {
        id: 'child-3',
        role: 'child',
        isAdult: false,
        isPrimary: false,
        fullName: 'Adam Benali',
        phone: '+213 550 11 22 33',
        email: 'karim.benali@hotel-oran.dz',
        documentType: 'passport',
        documentNumber: 'CH998811',
      },
    ],
  });

  // Search matches second adult and child by name, email, and document number
  assert.equal(doesBookingMatchQuery(multiBooking, 'Salima'), true);
  assert.equal(doesBookingMatchQuery(multiBooking, 'CH998811'), true);
  assert.equal(doesBookingMatchQuery(multiBooking, 'salima.benali@hotel-oran.dz'), true);

  const haystack = buildBookingSearchText({ booking: multiBooking });
  assert.equal(matchesElasticQuery(haystack, 'Adam CH998811'), true);
  assert.equal(matchesElasticQuery(haystack, '2003004005'), true);

  // EventLog tracks occupant changes
  const diffs = computeBookingDiff(baseBooking, {
    occupantsList: multiBooking.occupantsList,
  });
  assert.ok(diffs.some((d) => d.field === 'Occupants & accompagnants'));

  // Police sheet preserves primary check and exposes companion completeness check
  const completeSheet = buildPoliceSheetDataFromBooking({ booking: multiBooking });
  assert.equal(getPoliceSheetMissingFields(completeSheet, 'fr').length, 0);
  assert.equal(getPoliceSheetCompanionMissingFields(completeSheet, 'fr').length, 0);

  const sheetWithoutCompanionContacts = buildPoliceSheetDataFromBooking({
    booking: {
      ...multiBooking,
      occupantsList: multiBooking.occupantsList?.map((occ) =>
        occ.isPrimary ? { ...occ, email: '' } : { ...occ, phone: '', email: '' }
      ),
    },
  });
  assert.equal(getPoliceSheetCompanionMissingFields(sheetWithoutCompanionContacts, 'fr').length, 0);

  const incompleteSheet = buildPoliceSheetDataFromBooking({ booking: baseBooking });
  assert.equal(getPoliceSheetMissingFields(incompleteSheet, 'fr').length, 0);
  assert.deepEqual(getPoliceSheetCompanionMissingFields(incompleteSheet, 'fr'), [
    'Accompagnants (2)',
  ]);
});
