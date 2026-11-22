import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeBookingAnalyticsSnapshot,
  type RoomWithGroup,
} from '../src/utils/bookingAnalyticsEngine';
import type { PmsTask, ResourceGroup, StockItem, StockMovement, TimelineBooking } from '../src/types/booking';
import type { EventLogEntry } from '../src/types/eventLog';

const rooms: RoomWithGroup[] = [
  {
    id: 'rm_101',
    name: '101',
    type: 'Single Standard',
    sector: 'hotel',
    pricePerDay: 100,
    housekeepingStatus: 'clean',
    building: 'Bâtiment A',
    floor: '1',
    groupId: 'grp_a',
    groupName: 'Bâtiment A',
  },
  {
    id: 'rm_201',
    name: '201',
    type: 'Suite Panorama',
    sector: 'hotel',
    pricePerDay: 200,
    housekeepingStatus: 'clean',
    building: 'Bâtiment A',
    floor: '2',
    groupId: 'grp_a',
    groupName: 'Bâtiment A',
  },
  {
    id: 'rm_202',
    name: '202',
    type: 'Double Deluxe',
    sector: 'hotel',
    pricePerDay: 140,
    housekeepingStatus: 'out_of_order',
    building: 'Bâtiment A',
    floor: '2',
    groupId: 'grp_a',
    groupName: 'Bâtiment A',
  },
];

const groups: ResourceGroup[] = [
  {
    id: 'grp_a',
    name: { fr: 'Bâtiment A', en: 'Building A', ar: 'المبنى أ' },
    sector: 'hotel',
    resources: rooms,
  },
];

const fixedNow = new Date('2026-11-20T10:00:00');

const sampleBookings: TimelineBooking[] = [
  // Current 7d window (2026-11-14 .. 2026-11-20)
  {
    id: 'b_cur_1',
    resourceId: 'rm_201',
    resourceName: '201',
    sector: 'hotel',
    guestName: 'Famille Benali',
    guestEmail: '',
    guestPhone: '+213550001122',
    startDate: '2026-11-15',
    endDate: '2026-11-19', // 4 nights
    status: 'checked_out',
    totalPrice: 800,
    paymentStatus: 'paid',
    paymentCurrency: 'EUR',
    adults: 2,
    children: 2,
    mealPlan: 'hb',
    mealPlanDietPreferences: ['halal', 'kids_menu'],
    originChannel: 'Booking.com',
    nationality: 'Algérienne',
    guestType: 'algerian',
    notes: 'Arrivée tardive 21h, demande lit bébé et climatisation calme.',
    guestAlerts: [
      {
        id: 'ga_1',
        text: 'Problème de bruit climatisation signalé par le client',
        source: 'reception',
        createdAt: '2026-11-16T18:00:00Z',
        createdBy: 'Réception',
      },
    ],
    forgottenItems: [
      {
        id: 'fi_1',
        description: 'Chargeur USB-C',
        status: 'stored',
        foundAt: '2026-11-19T12:00:00Z',
        foundBy: 'Gouvernante',
      },
    ],
    customMetadata: {
      guestAgeBracket: '36-50',
      clientSegment: 'family',
      selectedExtras: ['romantic', 'picnic'],
      hotelOptionBabyBed: true,
      hotelOptionHighFloor: true,
    },
  },
  {
    id: 'b_cur_2',
    resourceId: 'rm_101',
    resourceName: '101',
    sector: 'hotel',
    guestName: 'Karim Mansour',
    guestEmail: '',
    guestPhone: '+213661002233',
    startDate: '2026-11-18',
    endDate: '2026-11-20', // 2 nights
    status: 'checked_in',
    totalPrice: 200,
    paymentStatus: 'paid',
    paymentCurrency: 'EUR',
    adults: 1,
    children: 0,
    mealPlan: 'bf',
    mealPlanDietPreferences: ['halal'],
    originChannel: 'Direct',
    nationality: 'Algérienne',
    guestType: 'algerian',
    customMetadata: {
      selectedExtras: ['grab_go'],
    },
  },
  // Previous 7d window (2026-11-07 .. 2026-11-13)
  {
    id: 'b_prev_1',
    resourceId: 'rm_101',
    resourceName: '101',
    sector: 'hotel',
    guestName: 'Sonia Khelifi',
    guestEmail: '',
    guestPhone: '+213555998877',
    startDate: '2026-11-08',
    endDate: '2026-11-10', // 2 nights
    status: 'checked_out',
    totalPrice: 200,
    paymentStatus: 'paid',
    paymentCurrency: 'EUR',
    adults: 2,
    children: 0,
    mealPlan: 'bf',
  },
  // Future confirmed booking (J+7 window: 2026-11-21 .. 2026-11-25)
  {
    id: 'b_fut_1',
    resourceId: 'rm_201',
    resourceName: '201',
    sector: 'hotel',
    guestName: 'Nadia Toumi',
    guestEmail: '',
    guestPhone: '+33611223344',
    startDate: '2026-11-21',
    endDate: '2026-11-25', // 4 nights
    status: 'confirmed',
    totalPrice: 800,
    paymentStatus: 'pending',
    paymentCurrency: 'EUR',
    adults: 2,
    children: 0,
  },
];

const tasks: PmsTask[] = [
  {
    id: 't_1',
    room: '201',
    typeId: 'mac',
    typeName: 'Maintenance – Climatisation réversible',
    category: 'Maintenance',
    assignee: 'Technicien CVC',
    date: '2026-11-16',
    status: 'doing',
    priority: 'urgent',
    note: 'Bruit ventilateur clim',
  },
  {
    id: 't_2',
    room: '201',
    typeId: 'plm',
    typeName: 'Fuite siphon salle de bain',
    category: 'Maintenance',
    assignee: 'Plombier',
    date: '2026-11-19',
    status: 'pending',
    priority: 'normal',
  },
];

const stockItems: StockItem[] = [
  { id: 'eau', category: 'Minibar', name: 'Eau 50cl', unit: 'btl', quantity: 20, minThreshold: 15, unitCost: 80 },
  { id: 'savon', category: 'Bain', name: 'Savon', unit: 'pce', quantity: 10, minThreshold: 20, unitCost: 90 },
];

const stockMovements: StockMovement[] = [
  { id: 'm1', timestamp: '2026-11-17T09:00:00Z', itemId: 'eau', itemName: 'Eau 50cl', delta: -14, reason: 'Minibar', user: 'Yacine' },
  { id: 'm2', timestamp: '2026-11-18T09:00:00Z', itemId: 'savon', itemName: 'Savon', delta: -7, reason: 'Ménage', user: 'Amina' },
];

const eventLogs: EventLogEntry[] = [
  {
    id: 'ev_1',
    timestamp: '2026-11-17T14:00:00Z',
    category: 'locks',
    action: 'locks.invalid_card',
    severity: 'warn',
    title: 'Carte refusée serrure 201',
    description: 'Tentative lecture invalide',
    actor: { role: 'locks', label: 'proUSB' },
    resourceId: 'rm_201',
    source: 'live',
  },
];

test('computeBookingAnalyticsSnapshot computes period-over-period comparison, floor frequency, guest age/needs, extras, prevention and forecasts', () => {
  const snap = computeBookingAnalyticsSnapshot({
    bookings: sampleBookings,
    rooms,
    groups,
    tasks,
    stockItems,
    stockMovements,
    eventLogs,
    invoiceDocs: [],
    range: '7d',
    currency: 'EUR',
    domain: 'hotel',
    language: 'fr',
    now: fixedNow,
  });

  // Current 7d: 4 + 2 = 6 nights sold, 1000 EUR revenue; Prev 7d: 2 nights sold, 200 EUR
  assert.equal(snap.current.occupiedRoomNights, 6);
  assert.equal(snap.current.revenuePrimary, 1000);
  assert.equal(snap.previous.occupiedRoomNights, 2);
  assert.equal(snap.previous.revenuePrimary, 200);
  assert.equal(snap.deltas.revenue.pctChange, 400);

  // Trend points include current and previous values for 7 daily buckets
  assert.equal(snap.trendPoints.length, 7);
  assert.ok(snap.trendPoints.some((pt) => pt.prevOccupancy > 0));

  // Room & floor frequency: room 201 (floor 2) has 4 nights vs room 101 (floor 1) with 2 nights
  assert.equal(snap.roomFrequencies[0]?.roomId, 'rm_201');
  assert.equal(snap.roomFrequencies[0]?.nightsSold, 4);
  assert.equal(snap.mostFrequentFloor?.floor, '2');
  assert.equal(snap.mostFrequentFloor?.nightsSold, 4);

  // Client segments & age brackets (transparent unspecified for adults without declared bracket)
  const familySeg = snap.clientSegments.find((s) => s.id === 'family');
  assert.ok(familySeg && familySeg.count === 1);
  assert.ok(familySeg.topNeeds.length > 0);
  assert.equal(snap.totalChildrenCount, 2);
  assert.ok(snap.ageBrackets.some((a) => a.id === '0-17' && a.peopleCount === 2));
  assert.ok(snap.ageBrackets.some((a) => a.id === '36-50' && a.peopleCount === 2));
  assert.ok(snap.ageBrackets.some((a) => a.id === 'unspecified' && a.peopleCount === 1));

  // Extras & dietary additives
  assert.equal(snap.extrasAttachRatePct, 100);
  assert.ok(snap.paidExtrasStats.some((e) => e.label.includes('Romantique')));
  assert.ok(snap.paidExtrasStats.some((e) => e.label.includes('Grab & Go')));
  assert.ok(snap.dietaryAdditivesStats.some((d) => d.id === 'halal' && d.count === 2));

  // Failures by trade, recurring risk rooms, complaints & stock runway
  assert.ok(snap.failuresByTrade.some((tr) => tr.id === 'hvac' && tr.count === 1));
  assert.ok(snap.failuresByTrade.some((tr) => tr.id === 'plumbing' && tr.count === 1));
  assert.ok(snap.recurringRiskRooms.some((r) => r.roomKey === 'rm_201' && r.riskLevel === 'high'));
  assert.ok(snap.recurringRiskRooms.some((r) => r.roomKey === 'rm_202' && r.housekeepingStatus === 'out_of_order'));
  assert.equal(snap.forgottenStoredCount, 1);
  assert.ok(snap.complaintsAndAlerts.length >= 3);
  assert.ok(snap.stockRunway.some((s) => s.itemId === 'savon' && s.riskLevel === 'critical'));

  // Forward forecast J+7 includes confirmed booking b_fut_1 (4 nights, 800 EUR)
  const f7 = snap.forecasts.find((f) => f.horizonDays === 7);
  assert.ok(f7);
  assert.equal(f7.confirmedNights, 4);
  assert.equal(f7.confirmedRevenue, 800);
  assert.ok(f7.projectedOccupancyPct >= f7.confirmedOccupancyPct);
  assert.ok(snap.recommendations.length > 0);
});
