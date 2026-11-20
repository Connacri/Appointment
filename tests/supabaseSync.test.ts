import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OutboxRecord, OutboxSummary, TombstoneRecord } from '../src/db/indexedDb';
import type { HotelEstablishment, ResourceGroup, ResourceItem, TimelineBooking } from '../src/types/booking';
import type { SyncProgressEvent } from '../src/services/supabase/syncLog';
import {
  computeBackoffIso,
  deriveIdleSyncPhase,
  runSupabaseSync,
  type PulledSupabaseSnapshot,
  type SupabaseSyncAdapter,
} from '../src/services/supabase/supabaseSync';

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

const makeResource = (id: string, establishmentId = 'est-1'): ResourceItem => ({
  id,
  groupId: 'grp-1',
  name: '101',
  type: 'Chambre',
  sector: 'hotel',
  pricePerDay: 8000,
  housekeepingStatus: 'clean',
  establishmentId,
});

const makeGroup = (id: string, resources: ResourceItem[]): ResourceGroup => ({
  id,
  name: { fr: 'Bâtiment A', en: 'Building A', ar: 'المبنى أ' },
  sector: 'hotel',
  resources,
});

const makeBookingOutboxRecord = (booking: TimelineBooking): OutboxRecord => ({
  id: `ob-${booking.id}`,
  idempotencyKey: `ws-1:booking:${booking.id}:1`,
  workspaceId: 'ws-1',
  establishmentId: 'est-1',
  entity: 'booking',
  entityId: booking.id,
  operation: 'upsert',
  version: 1,
  payload: booking as unknown as Record<string, unknown>,
  status: 'pending',
  attempts: 0,
  createdAt: '2026-11-18T11:00:00.000Z',
  nextAttemptAt: '2026-11-18T11:00:00.000Z',
});

function createMemoryAdapter(seed?: {
  hasSession?: boolean;
  outbox?: OutboxRecord[];
  tombstones?: TombstoneRecord[];
  remote?: Partial<PulledSupabaseSnapshot>;
  failBookingUpsertIds?: Set<string>;
  failPull?: boolean;
}) {
  const outbox = [...(seed?.outbox ?? [])];
  const tombstones = [...(seed?.tombstones ?? [])];
  const pushLog: string[] = [];
  const getPendingArgs: Array<{ limit: number; includeFutureRetries: boolean }> = [];
  const fixedNow = new Date('2026-11-18T12:00:00.000Z');

  const remoteSnapshot: PulledSupabaseSnapshot = {
    establishments: seed?.remote?.establishments ?? [
      {
        id: 'est-1',
        code: 'E1',
        name: 'Hotel Atlas',
        city: 'Oran',
        stars: 4,
        taxRate: 9,
        checkInTime: '14:00',
        checkOutTime: '12:00',
        facilities: [],
      },
    ],
    groups: seed?.remote?.groups ?? [makeGroup('grp-1', [makeResource('room-101', 'est-1')])],
    bookings: seed?.remote?.bookings ?? [],
    tasks: seed?.remote?.tasks ?? [],
    stockItems: seed?.remote?.stockItems ?? [],
    dynamicRates: seed?.remote?.dynamicRates ?? {},
  };

  const computeSummary = (): OutboxSummary => {
    const nowIso = fixedNow.toISOString();
    const pending = outbox.filter((r) => r.status === 'pending');
    const errored = outbox.filter((r) => r.status === 'failed' || (r.status === 'pending' && r.attempts > 0));
    return {
      pendingCount: pending.length,
      failedCount: errored.length,
      dueCount: pending.filter((r) => r.nextAttemptAt <= nowIso).length,
      lastError: errored[errored.length - 1]?.lastError,
    };
  };

  const adapter: SupabaseSyncAdapter = {
    hasSession: async () => seed?.hasSession ?? true,
    getPendingOutbox: async (workspaceId, limit, includeFutureRetries) => {
      getPendingArgs.push({ limit, includeFutureRetries });
      const nowIso = fixedNow.toISOString();
      return outbox
        .filter(
          (r) =>
            r.workspaceId === workspaceId &&
            r.status === 'pending' &&
            (includeFutureRetries || r.nextAttemptAt <= nowIso),
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, limit);
    },
    getOutboxSummary: async () => computeSummary(),
    getTombstones: async (workspaceId) => tombstones.filter((t) => t.workspaceId === workspaceId),
    markOutboxSynced: async (id) => {
      pushLog.push(`ack:${id}`);
      const idx = outbox.findIndex((r) => r.id === id);
      if (idx >= 0) outbox[idx] = { ...outbox[idx], status: 'synced', lastError: undefined };
    },
    markOutboxFailed: async (id, error, nextAttemptAt) => {
      pushLog.push(`fail:${id}`);
      const idx = outbox.findIndex((r) => r.id === id);
      if (idx >= 0) {
        outbox[idx] = {
          ...outbox[idx],
          status: 'pending',
          attempts: outbox[idx].attempts + 1,
          lastError: error,
          nextAttemptAt,
        };
      }
    },
    pushEstablishmentUpsert: async (_ws, establishment) => {
      pushLog.push(`push:establishment:upsert:${establishment.id}`);
    },
    pushResourceGroupUpsert: async (_ws, estId, group) => {
      pushLog.push(`push:resource_group:upsert:${estId}:${group.id}`);
    },
    pushBookingUpsert: async (_ws, estId, booking) => {
      pushLog.push(`push:booking:upsert:${estId}:${booking.id}`);
      if (seed?.failBookingUpsertIds?.has(booking.id)) {
        throw new Error('Server rejected booking');
      }
    },
    pushBookingDelete: async (_ws, bookingId) => {
      pushLog.push(`push:booking:delete:${bookingId}`);
    },
    pushResourceUpsert: async (_ws, estId, resource) => {
      pushLog.push(`push:resource:upsert:${estId}:${resource.id}`);
    },
    pushResourceDelete: async (_ws, resourceId) => {
      pushLog.push(`push:resource:delete:${resourceId}`);
    },
    pullRemoteState: async () => {
      pushLog.push('pull');
      if (seed?.failPull) throw new Error('Network timeout on pull');
      return remoteSnapshot;
    },
  };

  return { adapter, outbox, pushLog, getPendingArgs, fixedNow };
}

test('runSupabaseSync pushes resources before bookings, waits for ACK before marking synced, then pulls', async () => {
  const booking = makeBooking('bkg-1', { resourceId: 'room-101' });
  const resource = makeResource('room-101', 'est-1');

  const outbox: OutboxRecord[] = [
    {
      id: 'ob-bkg',
      idempotencyKey: 'ws-1:booking:bkg-1:1',
      workspaceId: 'ws-1',
      establishmentId: 'est-1',
      entity: 'booking',
      entityId: 'bkg-1',
      operation: 'upsert',
      version: 1,
      payload: booking as unknown as Record<string, unknown>,
      status: 'pending',
      attempts: 0,
      createdAt: '2026-11-18T11:00:00.000Z',
      nextAttemptAt: '2026-11-18T11:00:00.000Z',
    },
    {
      id: 'ob-res',
      idempotencyKey: 'ws-1:resource:room-101:1',
      workspaceId: 'ws-1',
      establishmentId: 'est-1',
      entity: 'resource',
      entityId: 'room-101',
      operation: 'upsert',
      version: 1,
      payload: resource as unknown as Record<string, unknown>,
      status: 'pending',
      attempts: 0,
      createdAt: '2026-11-18T11:01:00.000Z',
      nextAttemptAt: '2026-11-18T11:01:00.000Z',
    },
  ];

  const { adapter, pushLog, fixedNow } = createMemoryAdapter({
    outbox,
    remote: { bookings: [makeBooking('bkg-remote', { resourceId: 'room-101' })] },
  });

  const result = await runSupabaseSync({
    force: false,
    isOffline: false,
    isConfigured: true,
    workspaceId: 'ws-1',
    selectedEstablishmentId: 'est-1',
    localGroups: [makeGroup('grp-1', [resource])],
    localBookings: [booking],
    adapter,
    now: () => fixedNow,
  });

  assert.equal(result.status.phase, 'synced');
  assert.equal(result.status.pendingCount, 0);
  assert.equal(result.status.failedCount, 0);
  assert.equal(result.status.lastSyncedAt, fixedNow.toISOString());
  assert.equal(result.pushedCount, 2);
  assert.equal(result.recoveredBookingsCount, 1);
  assert.deepEqual(pushLog, [
    'push:resource:upsert:est-1:room-101',
    'ack:ob-res',
    'push:booking:upsert:est-1:bkg-1',
    'ack:ob-bkg',
    'pull',
  ]);
  assert.equal(result.mergedBookings?.length, 2);
});

test('runSupabaseSync pushes the hierarchy in causal order regardless of Outbox insertion order', async () => {
  const establishment = {
    id: 'est-oasis',
    code: 'EST-OASIS',
    name: 'Hotel Oasis',
    city: 'Oran',
    stars: 4,
    taxRate: 0,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    facilities: [],
    domain: 'hotel' as const,
    currency: 'DA',
    country: 'Algérie',
    address: '14 boulevard',
    establishmentType: 'hotel' as const,
  };
  const group = {
    id: 'grp-1',
    name: { fr: 'Bâtiment A', en: 'Building A', ar: 'المبنى أ' },
    sector: 'hotel' as const,
    establishmentId: 'est-oasis',
  };
  const resource = { ...makeResource('room-101', 'est-oasis') };
  const booking = makeBooking('bkg-1', { resourceId: 'room-101' });

  // Deliberately inserted in the reverse of the required causal order.
  const outbox: OutboxRecord[] = [
    {
      id: 'ob-bkg',
      idempotencyKey: 'ws-1:booking:bkg-1:1',
      workspaceId: 'ws-1',
      establishmentId: 'est-oasis',
      entity: 'booking',
      entityId: 'bkg-1',
      operation: 'upsert',
      version: 1,
      payload: booking as unknown as Record<string, unknown>,
      status: 'pending',
      attempts: 0,
      createdAt: '2026-11-18T11:00:00.000Z',
      nextAttemptAt: '2026-11-18T11:00:00.000Z',
    },
    {
      id: 'ob-res',
      idempotencyKey: 'ws-1:resource:room-101:1',
      workspaceId: 'ws-1',
      establishmentId: 'est-oasis',
      entity: 'resource',
      entityId: 'room-101',
      operation: 'upsert',
      version: 1,
      payload: resource as unknown as Record<string, unknown>,
      status: 'pending',
      attempts: 0,
      createdAt: '2026-11-18T11:01:00.000Z',
      nextAttemptAt: '2026-11-18T11:01:00.000Z',
    },
    {
      id: 'ob-grp',
      idempotencyKey: 'ws-1:resource_group:grp-1:1',
      workspaceId: 'ws-1',
      establishmentId: 'est-oasis',
      entity: 'resource_group',
      entityId: 'grp-1',
      operation: 'upsert',
      version: 1,
      payload: group as unknown as Record<string, unknown>,
      status: 'pending',
      attempts: 0,
      createdAt: '2026-11-18T11:02:00.000Z',
      nextAttemptAt: '2026-11-18T11:02:00.000Z',
    },
    {
      id: 'ob-est',
      idempotencyKey: 'ws-1:establishment:est-oasis:1',
      workspaceId: 'ws-1',
      establishmentId: 'est-oasis',
      entity: 'establishment',
      entityId: 'est-oasis',
      operation: 'upsert',
      version: 1,
      payload: establishment as unknown as Record<string, unknown>,
      status: 'pending',
      attempts: 0,
      createdAt: '2026-11-18T11:03:00.000Z',
      nextAttemptAt: '2026-11-18T11:03:00.000Z',
    },
  ];

  const { adapter, pushLog, fixedNow } = createMemoryAdapter({
    outbox,
    remote: {
      establishments: [establishment],
      groups: [makeGroup('grp-1', [resource])],
    },
  });

  const result = await runSupabaseSync({
    force: true,
    isOffline: false,
    isConfigured: true,
    workspaceId: 'ws-1',
    selectedEstablishmentId: 'est-oasis',
    localGroups: [makeGroup('grp-1', [resource])],
    localBookings: [booking],
    adapter,
    now: () => fixedNow,
  });

  assert.equal(result.status.phase, 'synced');
  assert.equal(result.pushedCount, 4);
  assert.deepEqual(pushLog, [
    'push:establishment:upsert:est-oasis',
    'ack:ob-est',
    'push:resource_group:upsert:est-oasis:grp-1',
    'ack:ob-grp',
    'push:resource:upsert:est-oasis:room-101',
    'ack:ob-res',
    'push:booking:upsert:est-oasis:bkg-1',
    'ack:ob-bkg',
    'pull',
  ]);
});

test('runSupabaseSync never marks failed Outbox mutations as synced and protects local draft during merge', async () => {
  const localEdited = makeBooking('bkg-fail', { guestName: 'Offline Edited Guest' });
  const staleRemote = makeBooking('bkg-fail', { guestName: 'Old Remote Guest' });

  const { adapter, outbox, fixedNow } = createMemoryAdapter({
    outbox: [
      {
        id: 'ob-fail',
        idempotencyKey: 'ws-1:booking:bkg-fail:2',
        workspaceId: 'ws-1',
        establishmentId: 'est-1',
        entity: 'booking',
        entityId: 'bkg-fail',
        operation: 'upsert',
        version: 2,
        payload: localEdited as unknown as Record<string, unknown>,
        status: 'pending',
        attempts: 0,
        createdAt: '2026-11-18T11:50:00.000Z',
        nextAttemptAt: '2026-11-18T11:50:00.000Z',
      },
    ],
    remote: { bookings: [staleRemote] },
    failBookingUpsertIds: new Set(['bkg-fail']),
  });

  const result = await runSupabaseSync({
    force: false,
    isOffline: false,
    isConfigured: true,
    workspaceId: 'ws-1',
    selectedEstablishmentId: 'est-1',
    localGroups: [makeGroup('grp-1', [makeResource('room-101', 'est-1')])],
    localBookings: [localEdited],
    adapter,
    now: () => fixedNow,
  });

  assert.equal(result.status.phase, 'error');
  assert.equal(result.status.pendingCount, 1);
  assert.equal(result.status.failedCount, 1);
  assert.equal(result.status.lastSyncedAt, null);
  assert.equal(outbox[0].status, 'pending');
  assert.equal(outbox[0].attempts, 1);
  assert.ok(outbox[0].nextAttemptAt > fixedNow.toISOString());
  // Future-retry pending record is still protected from remote overwrite
  assert.equal(result.mergedBookings?.[0].guestName, 'Offline Edited Guest');
});

test('force sync retries backed-off pending Outbox mutations immediately', async () => {
  const booking = makeBooking('bkg-retry');
  const { adapter, getPendingArgs, fixedNow } = createMemoryAdapter({
    outbox: [
      {
        id: 'ob-retry',
        idempotencyKey: 'ws-1:booking:bkg-retry:1',
        workspaceId: 'ws-1',
        establishmentId: 'est-1',
        entity: 'booking',
        entityId: 'bkg-retry',
        operation: 'upsert',
        version: 1,
        payload: booking as unknown as Record<string, unknown>,
        status: 'pending',
        attempts: 2,
        createdAt: '2026-11-18T11:55:00.000Z',
        nextAttemptAt: '2026-11-18T12:30:00.000Z',
        lastError: 'Temporary network blip',
      },
    ],
  });

  // Auto-sync before nextAttemptAt skips the backed-off item and stays error/pending
  const autoRes = await runSupabaseSync({
    force: false,
    isOffline: false,
    isConfigured: true,
    workspaceId: 'ws-1',
    selectedEstablishmentId: 'est-1',
    localGroups: [],
    localBookings: [booking],
    adapter,
    now: () => fixedNow,
  });
  assert.equal(autoRes.pushedCount, 0);
  assert.equal(autoRes.status.pendingCount, 1);
  assert.equal(getPendingArgs[0].includeFutureRetries, false);

  // Force sync retries immediately and clears pending queue after ACK
  const forceRes = await runSupabaseSync({
    force: true,
    isOffline: false,
    isConfigured: true,
    workspaceId: 'ws-1',
    selectedEstablishmentId: 'est-1',
    localGroups: [],
    localBookings: [booking],
    adapter,
    now: () => fixedNow,
  });
  assert.equal(getPendingArgs[2].includeFutureRetries, true);
  assert.equal(forceRes.pushedCount, 1);
  assert.equal(forceRes.status.phase, 'synced');
  assert.equal(forceRes.status.pendingCount, 0);
});

test('runSupabaseSync resolves establishmentId from remote resource when selectedEstablishmentId is all and refuses ambiguity across multiple buildings', async () => {
  const booking = makeBooking('bkg-all-filter', { resourceId: 'room-101' });
  const { adapter, pushLog, fixedNow } = createMemoryAdapter({
    outbox: [
      {
        id: 'ob-all',
        idempotencyKey: 'ws-1:booking:bkg-all-filter:1',
        workspaceId: 'ws-1',
        establishmentId: undefined,
        entity: 'booking',
        entityId: 'bkg-all-filter',
        operation: 'upsert',
        version: 1,
        payload: booking as unknown as Record<string, unknown>,
        status: 'pending',
        attempts: 0,
        createdAt: '2026-11-18T11:55:00.000Z',
        nextAttemptAt: '2026-11-18T11:55:00.000Z',
      },
    ],
    remote: {
      establishments: [
        { id: 'est-1', code: 'E1', name: 'H1', city: '', stars: 4, taxRate: 9, checkInTime: '14:00', checkOutTime: '12:00', facilities: [] },
        { id: 'est-2', code: 'E2', name: 'H2', city: '', stars: 4, taxRate: 9, checkInTime: '14:00', checkOutTime: '12:00', facilities: [] },
      ],
      groups: [makeGroup('grp-1', [makeResource('room-101', 'est-2')])],
    },
  });

  const res = await runSupabaseSync({
    force: true,
    isOffline: false,
    isConfigured: true,
    workspaceId: 'ws-1',
    selectedEstablishmentId: 'all',
    localGroups: [],
    localBookings: [booking],
    adapter,
    now: () => fixedNow,
  });

  assert.equal(res.status.phase, 'synced');
  assert.ok(pushLog.includes('push:booking:upsert:est-2:bkg-all-filter'));
});

test('runSupabaseSync skips network calls cleanly when offline and keeps pending count accurate', async () => {
  const { adapter, pushLog } = createMemoryAdapter({
    outbox: [
      {
        id: 'ob-offline',
        idempotencyKey: 'ws-1:booking:bkg-1:1',
        workspaceId: 'ws-1',
        establishmentId: 'est-1',
        entity: 'booking',
        entityId: 'bkg-1',
        operation: 'delete',
        version: 1,
        payload: null,
        status: 'pending',
        attempts: 0,
        createdAt: '2026-11-18T11:55:00.000Z',
        nextAttemptAt: '2026-11-18T11:55:00.000Z',
      },
    ],
  });

  const res = await runSupabaseSync({
    force: false,
    isOffline: true,
    isConfigured: true,
    workspaceId: 'ws-1',
    selectedEstablishmentId: 'est-1',
    localGroups: [],
    localBookings: [],
    adapter,
  });

  assert.equal(res.skippedReason, 'offline');
  assert.equal(res.status.phase, 'offline');
  assert.equal(res.status.pendingCount, 1);
  assert.equal(pushLog.length, 0);
});

test('deriveIdleSyncPhase and computeBackoffIso enforce evidence-based status invariants', () => {
  assert.equal(
    deriveIdleSyncPhase({
      isOffline: false,
      isConfigured: true,
      isAuthenticated: true,
      workspaceId: 'ws-1',
      summary: { pendingCount: 2, failedCount: 0, dueCount: 2 },
      lastSyncedAt: '2026-11-18T10:00:00Z',
      lastError: null,
    }),
    'pending',
  );
  assert.equal(
    deriveIdleSyncPhase({
      isOffline: false,
      isConfigured: true,
      isAuthenticated: true,
      workspaceId: 'ws-1',
      summary: { pendingCount: 0, failedCount: 0, dueCount: 0 },
      lastSyncedAt: '2026-11-18T10:00:00Z',
      lastError: null,
    }),
    'synced',
  );

  const baseMs = Date.parse('2026-11-18T12:00:00.000Z');
  assert.equal(computeBackoffIso(0, baseMs), '2026-11-18T12:00:05.000Z');
  assert.equal(computeBackoffIso(1, baseMs), '2026-11-18T12:00:10.000Z');
  assert.equal(computeBackoffIso(10, baseMs), '2026-11-18T12:05:00.000Z');
});

test('force sync telemetry reports verified success only after push ACK and pull verification', async () => {
  const booking = makeBooking('bkg-telemetry');
  const { adapter, fixedNow } = createMemoryAdapter({
    outbox: [makeBookingOutboxRecord(booking)],
    remote: { bookings: [makeBooking('bkg-remote', { resourceId: 'room-101' })] },
  });
  const events: SyncProgressEvent[] = [];

  const result = await runSupabaseSync({
    force: true,
    isOffline: false,
    isConfigured: true,
    workspaceId: 'ws-1',
    selectedEstablishmentId: 'est-1',
    localGroups: [],
    localBookings: [booking],
    adapter,
    now: () => fixedNow,
    onEvent: (event) => events.push(event),
  });

  const keys = events.map((event) => event.key);
  assert.equal(result.status.phase, 'synced');
  assert.equal(keys.at(-1), 'syncLogSynced');
  for (const key of [
    'syncLogForceStarted',
    'syncLogOutbox',
    'syncLogPushed',
    'syncLogPushDone',
    'syncLogPulling',
    'syncLogPulled',
    'syncLogMerged',
    'syncLogVerifying',
    'syncLogSynced',
  ] as const) {
    assert.ok(keys.includes(key), `missing telemetry event: ${key}`);
  }
  assert.equal(keys.includes('syncLogPending'), false);
  assert.equal(keys.includes('syncLogError'), false);
});

test('sync telemetry names every skipped state without claiming success', async () => {
  const states = [
    {
      label: 'offline',
      isOffline: true,
      isConfigured: true,
      workspaceId: 'ws-1',
      hasSession: true,
      eventKey: 'cloudStatusOffline' as const,
      skippedReason: 'offline' as const,
    },
    {
      label: 'unconfigured',
      isOffline: false,
      isConfigured: false,
      workspaceId: 'ws-1',
      hasSession: true,
      eventKey: 'cloudStatusNotConfigured' as const,
      skippedReason: 'unconfigured' as const,
    },
    {
      label: 'unauthenticated',
      isOffline: false,
      isConfigured: true,
      workspaceId: 'ws-1',
      hasSession: false,
      eventKey: 'supabaseStatusAuthRequired' as const,
      skippedReason: 'unauthenticated' as const,
    },
    {
      label: 'no workspace',
      isOffline: false,
      isConfigured: true,
      workspaceId: '',
      hasSession: true,
      eventKey: 'supabaseStatusNoWorkspace' as const,
      skippedReason: 'no_workspace' as const,
    },
  ];

  for (const state of states) {
    const { adapter } = createMemoryAdapter({ hasSession: state.hasSession });
    const events: SyncProgressEvent[] = [];
    const result = await runSupabaseSync({
      force: false,
      isOffline: state.isOffline,
      isConfigured: state.isConfigured,
      workspaceId: state.workspaceId,
      selectedEstablishmentId: 'est-1',
      localGroups: [],
      localBookings: [],
      adapter,
      onEvent: (event) => events.push(event),
    });

    assert.deepEqual(events.map((event) => event.key), ['syncLogStarted', state.eventKey], state.label);
    assert.equal(result.skippedReason, state.skippedReason, state.label);
    assert.equal(events.some((event) => event.key === 'syncLogSynced'), false, state.label);
  }
});

test('sync telemetry exposes the real push error and never reports synced', async () => {
  const booking = makeBooking('bkg-push-error');
  const { adapter, fixedNow } = createMemoryAdapter({
    outbox: [makeBookingOutboxRecord(booking)],
    failBookingUpsertIds: new Set([booking.id]),
  });
  const events: SyncProgressEvent[] = [];

  const result = await runSupabaseSync({
    force: true,
    isOffline: false,
    isConfigured: true,
    workspaceId: 'ws-1',
    selectedEstablishmentId: 'est-1',
    localGroups: [],
    localBookings: [booking],
    adapter,
    now: () => fixedNow,
    onEvent: (event) => events.push(event),
  });

  const pushFailure = events.find((event) => event.key === 'syncLogPushFailed');
  assert.ok(pushFailure);
  assert.equal(pushFailure.level, 'error');
  assert.equal(pushFailure.params?.entity, 'booking');
  assert.equal(pushFailure.detail, 'Server rejected booking');
  assert.equal(events.at(-1)?.key, 'syncLogError');
  assert.equal(events.at(-1)?.detail, 'Server rejected booking');
  assert.equal(result.status.phase, 'error');
  assert.equal(events.some((event) => event.key === 'syncLogSynced'), false);
});

test('a failing telemetry listener cannot change the sync result', async () => {
  const { adapter } = createMemoryAdapter();
  const result = await runSupabaseSync({
    force: false,
    isOffline: false,
    isConfigured: true,
    workspaceId: 'ws-1',
    selectedEstablishmentId: 'est-1',
    localGroups: [],
    localBookings: [],
    adapter,
    onEvent: () => {
      throw new Error('Observer failure');
    },
  });

  assert.equal(result.status.phase, 'synced');
});
