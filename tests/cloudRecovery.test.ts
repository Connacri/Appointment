import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeCloudStateWithLocal } from '../src/services/supabase/cloudRecovery';
import {
  decodeFirestoreDocument,
  decodeFirestoreValue,
  normalizeFirebaseSnapshot,
  parseFirebaseConfigInput,
} from '../src/services/cloud/firebaseRecovery';
import type { OutboxRecord, TombstoneRecord } from '../src/db/indexedDb';
import type { ResourceGroup, TimelineBooking } from '../src/types/booking';

const makeBooking = (id: string, overrides: Partial<TimelineBooking> = {}): TimelineBooking => ({
  id,
  resourceId: 'room-101',
  resourceName: '101',
  sector: 'hotel',
  guestName: `Guest ${id}`,
  guestEmail: '',
  guestPhone: '',
  startDate: '2026-11-18',
  endDate: '2026-11-20',
  status: 'confirmed',
  totalPrice: 12000,
  paymentStatus: 'pending',
  ...overrides,
});

const makeGroup = (id: string, roomIds: string[]): ResourceGroup => ({
  id,
  name: { fr: `Bâtiment ${id}`, en: `Building ${id}`, ar: `مبنى ${id}` },
  sector: 'hotel',
  resources: roomIds.map((roomId) => ({
    id: roomId,
    groupId: id,
    name: roomId,
    type: 'Chambre',
    sector: 'hotel',
    pricePerDay: 8000,
    housekeepingStatus: 'clean',
  })),
});

test('mergeCloudStateWithLocal recovers remote groups and bookings while keeping offline local records', () => {
  const localGroups = [makeGroup('g-local', ['r-local-1'])];
  const localBookings = [makeBooking('b-local', { resourceId: 'r-local-1' })];
  const remoteGroups = [makeGroup('g-cloud', ['r-cloud-1', 'r-cloud-2'])];
  const remoteBookings = [makeBooking('b-cloud', { resourceId: 'r-cloud-1' })];

  const merged = mergeCloudStateWithLocal({
    localGroups,
    localBookings,
    remoteGroups,
    remoteBookings,
    pendingOutbox: [],
    tombstones: [],
  });

  assert.equal(merged.recoveredGroupsCount, 1);
  assert.equal(merged.recoveredBookingsCount, 1);
  assert.equal(merged.groups.length, 2);
  assert.equal(merged.bookings.length, 2);
  assert.ok(merged.bookings.some((b) => b.id === 'b-local'));
  assert.ok(merged.bookings.some((b) => b.id === 'b-cloud'));
});

test('mergeCloudStateWithLocal never resurrects tombstoned records and protects pending Outbox upserts', () => {
  const localBookings = [makeBooking('b-pending', { guestName: 'Local Updated Name' })];
  const remoteBookings = [
    makeBooking('b-pending', { guestName: 'Stale Cloud Name' }),
    makeBooking('b-deleted', { guestName: 'Should Stay Deleted' }),
    makeBooking('b-demo', { guestName: 'Demo Booking' }),
  ];

  const pendingOutbox: OutboxRecord[] = [
    {
      id: 'ob-1',
      idempotencyKey: 'ws:booking:b-pending:2',
      workspaceId: 'ws-1',
      entity: 'booking',
      entityId: 'b-pending',
      operation: 'upsert',
      version: 2,
      payload: null,
      status: 'pending',
      attempts: 0,
      createdAt: '2026-11-18T00:00:00Z',
      nextAttemptAt: '2026-11-18T00:00:00Z',
    },
  ];

  const tombstones: TombstoneRecord[] = [
    {
      id: 'ws-1:booking:b-deleted',
      workspaceId: 'ws-1',
      entity: 'booking',
      entityId: 'b-deleted',
      version: 1,
      deletedAt: '2026-11-18T00:00:00Z',
    },
    {
      id: 'ws-1:resource:r-deleted',
      workspaceId: 'ws-1',
      entity: 'resource',
      entityId: 'r-deleted',
      version: 1,
      deletedAt: '2026-11-18T00:00:00Z',
    },
  ];

  const merged = mergeCloudStateWithLocal({
    localGroups: [],
    localBookings,
    remoteGroups: [makeGroup('g-1', ['r-live', 'r-deleted', 'r-demo']), makeGroup('g-demo', ['r-x'])],
    remoteBookings,
    pendingOutbox,
    tombstones,
    demoGroupIds: new Set(['g-demo']),
    demoResourceIds: new Set(['r-demo']),
    demoBookingIds: new Set(['b-demo']),
  });

  assert.equal(merged.bookings.length, 1);
  assert.equal(merged.bookings[0].guestName, 'Local Updated Name');
  assert.equal(merged.groups.length, 1);
  assert.deepEqual(merged.groups[0].resources.map((r) => r.id), ['r-live']);
});

test('parseFirebaseConfigInput parses JS/JSON Web configs and rejects service-account private keys', () => {
  const jsSnippet = `const firebaseConfig = {
    apiKey: "AIzaPublicClientKeyExample",
    projectId: "hotel-oran-pms",
    databaseURL: "https://hotel-oran-pms-default-rtdb.firebaseio.com/",
  };`;

  const parsed = parseFirebaseConfigInput(jsSnippet);
  assert.equal(parsed.projectId, 'hotel-oran-pms');
  assert.equal(parsed.databaseURL, 'https://hotel-oran-pms-default-rtdb.firebaseio.com');
  assert.equal(parsed.apiKey, 'AIzaPublicClientKeyExample');

  assert.throws(
    () =>
      parseFirebaseConfigInput(
        JSON.stringify({
          type: 'service_account',
          project_id: 'secret-proj',
          private_key: '-----BEGIN PRIVATE KEY-----',
        }),
      ),
    /service_account|private_key/i,
  );
});

test('decodeFirestoreDocument and normalizeFirebaseSnapshot recover Firestore and RTDB records safely', () => {
  assert.equal(decodeFirestoreValue({ integerValue: '42' }), 42);
  assert.equal(decodeFirestoreValue({ doubleValue: 19.5 }), 19.5);
  assert.equal(decodeFirestoreValue({ booleanValue: true }), true);
  assert.equal(decodeFirestoreValue({ arrayValue: { values: [{ stringValue: 'wifi' }] } })?.toString(), 'wifi');

  const doc = decodeFirestoreDocument({
    name: 'projects/p/databases/(default)/documents/bookings/fs-bkg-1',
    fields: {
      resourceId: { stringValue: 'room-202' },
      resourceName: { stringValue: '202' },
      guestName: { stringValue: 'Nadia B.' },
      startDate: { stringValue: '2026-11-20' },
      endDate: { stringValue: '2026-11-23' },
      totalPrice: { integerValue: '27000' },
      status: { stringValue: 'confirmed' },
    },
  });

  const snapshot = normalizeFirebaseSnapshot({
    resources: {
      'room-202': {
        name: '202',
        building: 'Annexe Mer',
        floor: '2',
        pricePerDay: 9000,
      },
      'room-deleted': {
        name: '203',
        deletedAt: '2026-11-17T00:00:00Z',
      },
    },
    bookings: doc ? [doc] : [],
    establishmentProfile: {
      name: 'Hôtel Horizon',
      city: 'Oran',
      stars: 4,
    },
  });

  assert.equal(snapshot.groups.length, 1);
  assert.equal(snapshot.groups[0].resources.length, 1);
  assert.equal(snapshot.groups[0].resources[0].id, 'room-202');
  assert.equal(snapshot.bookings.length, 1);
  assert.equal(snapshot.bookings[0].id, 'fs-bkg-1');
  assert.equal(snapshot.bookings[0].totalPrice, 27000);
  assert.equal(snapshot.establishmentProfile?.name, 'Hôtel Horizon');
});
