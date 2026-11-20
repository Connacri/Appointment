import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planBackfill } from '../src/services/supabase/backfillPlanner';
import { DEFAULT_ESTABLISHMENT_PROFILE } from '../src/types/establishment';
import type { HotelEstablishment, ResourceGroup, TimelineBooking } from '../src/types/booking';

const workspaceId = 'ws-personal-1';

function makeProfile(overrides: Partial<typeof DEFAULT_ESTABLISHMENT_PROFILE> = {}) {
  return {
    ...DEFAULT_ESTABLISHMENT_PROFILE,
    id: 'establishment-draft',
    name: 'hotel oasis',
    type: 'hotel' as const,
    city: 'Oran',
    country: 'Algérie',
    address: '14 boulevard front de mer',
    ...overrides,
  };
}

function makeGroup(id = 'grp-1', overrides: Partial<ResourceGroup> = {}): ResourceGroup {
  return {
    id,
    name: { fr: 'bâtiment a', en: 'building a', ar: 'المبنى أ' },
    sector: 'hotel',
    icon: 'Building',
    resources: [
      {
        id: 'room-101',
        groupId: id,
        name: '101',
        type: 'Chambre double',
        sector: 'hotel',
        pricePerDay: 8000,
        housekeepingStatus: 'clean',
        building: 'Bâtiment A',
        floor: '1',
        establishmentId: 'est-foreign',
      },
    ],
    ...overrides,
  };
}

function makeBooking(id = 'bkg-1', resourceId = 'room-101'): TimelineBooking {
  return {
    id,
    resourceId,
    resourceName: '101',
    sector: 'hotel',
    guestName: 'Guest One',
    guestEmail: 'guest@example.com',
    guestPhone: '+213 555 00 00',
    startDate: '2026-11-18',
    endDate: '2026-11-20',
    status: 'confirmed',
    totalPrice: 16000,
    paymentStatus: 'pending',
  };
}

function makeRemoteEstablishment(id: string, overrides: Partial<HotelEstablishment> = {}): HotelEstablishment {
  return {
    id,
    code: id.toUpperCase(),
    name: `Hotel ${id}`,
    city: 'Oran',
    stars: 4,
    taxRate: 0,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    facilities: [],
    ...overrides,
  };
}

test('backfill rejects a blank profile without inventing an establishment', () => {
  const plan = planBackfill({
    profile: makeProfile({ name: '   ' }),
    workspaceId,
    groups: [makeGroup()],
    bookings: [makeBooking()],
  });

  assert.equal(plan.ok, false);
  assert.equal(plan.reason, 'blank_profile');
  assert.equal(plan.establishment, null);
  assert.equal(plan.operations.length, 0);
  assert.deepEqual(plan.skipped, { groups: 1, resources: 1, bookings: 1 });
});

test('backfill accepts the placeholder id once the user entered a real name', () => {
  const plan = planBackfill({
    profile: makeProfile(),
    workspaceId,
    groups: [makeGroup()],
    bookings: [makeBooking()],
  });

  assert.equal(plan.ok, true);
  assert.ok(plan.establishmentId);
  assert.match(plan.establishmentId ?? '', /^est-hotel-oasis$/);
  assert.equal(plan.establishment?.name, 'Hotel oasis');
});

test('backfill emits establishment, building, resource then booking in causal order', () => {
  const plan = planBackfill({
    profile: makeProfile(),
    workspaceId,
    groups: [makeGroup()],
    bookings: [makeBooking()],
  });

  assert.equal(plan.ok, true);
  assert.deepEqual(
    plan.operations.map((operation) => operation.kind),
    ['establishment', 'resourceGroup', 'resource', 'booking'],
  );

  const [establishment, group, resource, booking] = plan.operations;
  assert.equal(establishment.entityId, plan.establishmentId);
  assert.equal(group.entityId, 'grp-1');
  assert.equal(resource.entityId, 'room-101');
  assert.equal(booking.entityId, 'bkg-1');
});

test('backfill payloads use the domain camelCase shape consumed by the sync adapter', () => {
  const plan = planBackfill({
    profile: makeProfile({ type: 'resort' }),
    workspaceId,
    groups: [makeGroup()],
    bookings: [makeBooking()],
  });

  const establishment = plan.operations.find((operation) => operation.kind === 'establishment');
  assert.equal(establishment?.kind, 'establishment');
  if (establishment?.kind === 'establishment') {
    assert.equal(establishment.payload.domain, 'resort');
    assert.equal(establishment.payload.currency, 'DA');
    assert.equal(establishment.payload.country, 'Algérie');
    assert.equal(establishment.payload.address, '14 boulevard front de mer');
    assert.equal(establishment.payload.establishmentType, 'resort');
    assert.equal(establishment.payload.taxRate, 0);
    assert.deepEqual(establishment.payload.facilities, []);
  }

  const resource = plan.operations.find((operation) => operation.kind === 'resource');
  assert.equal(resource?.kind, 'resource');
  if (resource?.kind === 'resource') {
    assert.equal(resource.payload.groupId, 'grp-1');
    assert.equal(resource.payload.pricePerDay, 8000);
    assert.equal(resource.payload.type, 'Chambre double');
    assert.equal(resource.payload.establishmentId, plan.establishmentId);
    assert.equal(resource.payload.group_id, undefined);
    assert.equal(resource.payload.price_per_day, undefined);
  }

  const booking = plan.operations.find((operation) => operation.kind === 'booking');
  assert.equal(booking?.kind, 'booking');
  if (booking?.kind === 'booking') {
    assert.equal(booking.payload.resourceId, 'room-101');
    assert.equal(booking.payload.guestName, 'Guest One');
    assert.equal(booking.payload.startDate, '2026-11-18');
    assert.equal(booking.payload.establishment_id, undefined);
  }
});

test('backfill idempotency keys are stable across runs and workspace-scoped', () => {
  const first = planBackfill({
    profile: makeProfile(),
    workspaceId,
    groups: [makeGroup()],
    bookings: [makeBooking()],
  });
  const second = planBackfill({
    profile: makeProfile(),
    workspaceId,
    groups: [makeGroup()],
    bookings: [makeBooking()],
  });

  assert.deepEqual(
    first.operations.map((operation) => operation.idempotencyKey),
    second.operations.map((operation) => operation.idempotencyKey),
  );
  assert.ok(
    first.operations.every((operation) =>
      operation.idempotencyKey.startsWith(`backfill:${workspaceId}:`),
    ),
  );
  assert.equal(new Set(first.operations.map((operation) => operation.idempotencyKey)).size, 4);
});

test('backfill capitalizes building names without altering Arabic', () => {
  const plan = planBackfill({
    profile: makeProfile(),
    workspaceId,
    groups: [makeGroup()],
    bookings: [makeBooking()],
  });

  const group = plan.operations.find((operation) => operation.kind === 'resourceGroup');
  assert.equal(group?.kind, 'resourceGroup');
  if (group?.kind === 'resourceGroup') {
    assert.deepEqual(group.payload.name, {
      fr: 'Bâtiment a',
      en: 'Building a',
      ar: 'المبنى أ',
    });
  }
});

test('backfill reattaches a foreign resource to the real establishment and warns', () => {
  const plan = planBackfill({
    profile: makeProfile(),
    workspaceId,
    groups: [makeGroup()],
    bookings: [makeBooking()],
  });

  assert.equal(plan.ok, true);
  const resource = plan.operations.find((operation) => operation.kind === 'resource');
  assert.equal(resource?.establishmentId, plan.establishmentId);
  assert.ok(
    plan.warnings.some((warning) => warning.includes('est-foreign')),
    'the foreign establishment must be reported, never silently merged',
  );
});

test('backfill skips demo records and bookings without a local resource', () => {
  const plan = planBackfill({
    profile: makeProfile(),
    workspaceId,
    groups: [
      makeGroup('demo-group-1', {
        resources: [
          {
            id: 'demo-room-101',
            groupId: 'demo-group-1',
            name: 'Demo',
            type: 'Chambre',
            sector: 'hotel',
            pricePerDay: 0,
          },
        ],
      }),
    ],
    bookings: [makeBooking('demo-booking-1'), makeBooking('bkg-orphan', 'missing-room')],
  });

  assert.equal(plan.ok, true);
  assert.deepEqual(
    plan.operations.map((operation) => operation.kind),
    ['establishment'],
  );
  assert.deepEqual(plan.skipped, { groups: 1, resources: 1, bookings: 2 });
  assert.ok(plan.warnings.some((warning) => warning.includes('missing-room')));
});

test('backfill keeps same-day bookings but skips reversed date ranges', () => {
  const plan = planBackfill({
    profile: makeProfile(),
    workspaceId,
    groups: [makeGroup()],
    bookings: [
      { ...makeBooking('bkg-same-day'), endDate: '2026-11-20' },
      { ...makeBooking('bkg-reversed'), startDate: '2026-11-21', endDate: '2026-11-20' },
    ],
  });

  assert.equal(plan.ok, true);
  const bookingOperations = plan.operations.filter((operation) => operation.kind === 'booking');
  assert.deepEqual(bookingOperations.map((operation) => operation.entityId), ['bkg-same-day']);
  assert.equal(bookingOperations[0]?.kind === 'booking' && bookingOperations[0].payload.endDate, '2026-11-20');
  assert.deepEqual(plan.skipped, { groups: 0, resources: 0, bookings: 1 });
  assert.ok(plan.warnings.some((warning) => warning.includes('bkg-reversed')));
});

test('backfill attaches local inventory to the single existing remote establishment without duplicating it', () => {
  const plan = planBackfill({
    profile: makeProfile(),
    workspaceId,
    groups: [makeGroup()],
    bookings: [makeBooking()],
    remoteEstablishments: [makeRemoteEstablishment('est-remote')],
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.establishmentId, 'est-remote');
  assert.deepEqual(
    plan.operations.map((operation) => operation.kind),
    ['resourceGroup', 'resource', 'booking'],
  );
  assert.ok(plan.operations.every((operation) => operation.establishmentId === 'est-remote'));
  assert.equal(plan.establishment?.code, 'EST-REMOTE');
});

test('backfill uses the concrete local profile id to pick its remote establishment', () => {
  const plan = planBackfill({
    profile: makeProfile({ id: 'est-2' }),
    workspaceId,
    groups: [makeGroup()],
    bookings: [makeBooking()],
    remoteEstablishments: [
      makeRemoteEstablishment('est-1'),
      makeRemoteEstablishment('est-2'),
    ],
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.establishmentId, 'est-2');
  assert.deepEqual(
    plan.operations.map((operation) => operation.kind),
    ['resourceGroup', 'resource', 'booking'],
  );
});

test('backfill honors the selected remote establishment while the profile is still a draft', () => {
  const plan = planBackfill({
    profile: makeProfile(),
    workspaceId,
    groups: [makeGroup()],
    bookings: [makeBooking()],
    remoteEstablishments: [
      makeRemoteEstablishment('est-1'),
      makeRemoteEstablishment('est-2'),
    ],
    selectedEstablishmentId: 'est-1',
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.establishmentId, 'est-1');
  assert.equal(plan.operations[0].kind, 'resourceGroup');
});

test('backfill refuses to guess between several remote establishments', () => {
  const plan = planBackfill({
    profile: makeProfile(),
    workspaceId,
    groups: [makeGroup()],
    bookings: [makeBooking()],
    remoteEstablishments: [
      makeRemoteEstablishment('est-1'),
      makeRemoteEstablishment('est-2'),
    ],
  });

  assert.equal(plan.ok, false);
  assert.equal(plan.reason, 'ambiguous_establishment');
  assert.equal(plan.establishment, null);
  assert.equal(plan.establishmentId, null);
  assert.equal(plan.operations.length, 0);
  assert.deepEqual(plan.skipped, { groups: 1, resources: 1, bookings: 1 });
  assert.ok(plan.warnings.some((warning) => warning.includes('2 établissements')));
});

test('backfill derives a deterministic id for a non-Latin establishment name', () => {
  const plan = planBackfill({
    profile: makeProfile({ name: 'فندق الواحة' }),
    workspaceId,
    groups: [],
    bookings: [],
  });

  assert.equal(plan.ok, true);
  assert.match(plan.establishmentId ?? '', /^est-x[a-z0-9]+$/);
  assert.equal(plan.establishment?.name, 'فندق الواحة');
});

test('backfill maps a spa clinic to the remote establishment types the check constraint accepts', () => {
  const plan = planBackfill({
    profile: makeProfile({ type: 'spa_clinic' }),
    workspaceId,
    groups: [],
    bookings: [],
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.establishment?.establishmentType, 'other');
  assert.equal(plan.establishment?.domain, 'hotel');
});

test('backfill normalizes free-text check-in times to PostgreSQL time values', () => {
  const plan = planBackfill({
    profile: makeProfile({ checkInTime: '14h00', checkOutTime: '11:30' }),
    workspaceId,
    groups: [],
    bookings: [],
  });

  assert.equal(plan.establishment?.checkInTime, '14:00');
  assert.equal(plan.establishment?.checkOutTime, '11:30');
});

test('backfill falls back to the default times when the profile value is not a time', () => {
  const plan = planBackfill({
    profile: makeProfile({ checkInTime: 'arrivée tardive', checkOutTime: '25:00' }),
    workspaceId,
    groups: [],
    bookings: [],
  });

  assert.equal(plan.establishment?.checkInTime, '14:00');
  assert.equal(plan.establishment?.checkOutTime, '12:00');
});

test('backfill handles legacy/partial profiles with missing city, country, or address fields safely', () => {
  const partialProfile = {
    ...makeProfile(),
    city: undefined as unknown as string,
    country: undefined as unknown as string,
    address: undefined as unknown as string,
    defaultCurrency: undefined as unknown as string,
  };

  const plan = planBackfill({
    profile: partialProfile,
    workspaceId,
    groups: [makeGroup()],
    bookings: [makeBooking()],
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.establishment?.city, '');
  assert.equal(plan.establishment?.country, '');
  assert.equal(plan.establishment?.address, '');
  assert.equal(plan.establishment?.currency, 'DA');
});
