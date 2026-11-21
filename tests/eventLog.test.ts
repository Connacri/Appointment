import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildEventLogExportFilename,
  buildHistoricalEventSeeds,
  computeBookingDiff,
  filterEventLogs,
  formatEventLogsAsCsv,
  formatEventLogsAsText,
  mergeEventLogs,
  sanitizeCsvCell,
} from '../src/utils/eventLog';
import type { EventLogEntry } from '../src/types/eventLog';
import type { TimelineBooking } from '../src/types/booking';
import { indexedDb } from '../src/db/indexedDb';

function makeBooking(overrides: Partial<TimelineBooking> = {}): TimelineBooking {
  return {
    id: 'bkg_1',
    resourceId: 'res_101',
    resourceName: 'Chambre 101',
    sector: 'hotel',
    guestName: 'Amine Benali',
    guestEmail: 'amine@example.com',
    guestPhone: '0550123456',
    startDate: '2026-11-20',
    endDate: '2026-11-23',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    status: 'confirmed',
    paymentStatus: 'pending',
    totalPrice: 24000,
    paymentCurrency: 'DA',
    ...overrides,
  };
}

test('computeBookingDiff detects scalar changes, collection counts, and skips identical fields', () => {
  const prev = makeBooking({
    forgottenItems: [{ id: 'f1', description: 'Chargeur', foundAt: '2026-11-21', foundBy: 'Staff', status: 'stored' }],
  });
  const changes = computeBookingDiff(prev, {
    guestName: 'Amine Benali', // unchanged
    totalPrice: 27500,
    paymentStatus: 'paid',
    endDate: '2026-11-24',
    forgottenItems: [{ id: 'f1', description: 'Chargeur', foundAt: '2026-11-21', foundBy: 'Staff', status: 'returned' }],
  });

  assert.equal(changes.length, 4);
  assert.deepEqual(
    changes.map((c) => c.field),
    ['Départ', 'Statut paiement', 'Montant total', 'Objets oubliés']
  );
  assert.deepEqual(changes[2], { field: 'Montant total', before: '24000', after: '27500' });
  assert.deepEqual(changes[3], { field: 'Objets oubliés', before: '1 (0 rendus)', after: '1 (1 rendus)' });
});

test('filterEventLogs searches text across metadata/diffs, applies filters, and orders newest first', () => {
  const entries: EventLogEntry[] = [
    {
      id: 'evt_1',
      timestamp: '2026-11-19T10:00:00.000Z',
      category: 'booking',
      action: 'booking.created',
      severity: 'success',
      title: 'Nouvelle réservation · Amélie Laurent',
      description: 'Suite 204 · 2026-11-19 → 2026-11-21',
      actor: { role: 'receptionist', label: 'Réception' },
      target: { type: 'booking', id: 'bkg_2', label: 'Amélie Laurent', secondaryLabel: 'Suite 204' },
      source: 'live',
    },
    {
      id: 'evt_2',
      timestamp: '2026-11-21T08:30:00.000Z',
      category: 'housekeeping',
      action: 'housekeeping.status_changed',
      severity: 'warn',
      title: 'Statut ménage · Chambre 105 → out_of_order',
      description: 'Chambre 105 (Bâtiment A) : clean → out_of_order',
      actor: { role: 'staff', label: 'Étage & Maintenance' },
      changes: [{ field: 'Statut ménage', before: 'clean', after: 'out_of_order' }],
      metadata: { reason: 'Fuite climatisation' },
      source: 'live',
    },
    {
      id: 'evt_3',
      timestamp: '2026-11-21T09:15:00.000Z',
      category: 'sync',
      action: 'sync.syncLogError',
      severity: 'error',
      title: 'Erreur synchronisation Supabase',
      description: 'Network timeout',
      actor: { role: 'system', label: 'Sync Supabase' },
      source: 'live',
    },
  ];

  // Accent-insensitive text search hitting title
  const byQuery = filterEventLogs(entries, { query: 'amelie' });
  assert.equal(byQuery.length, 1);
  assert.equal(byQuery[0].id, 'evt_1');

  // Metadata search
  const byMeta = filterEventLogs(entries, { query: 'climatisation' });
  assert.equal(byMeta.length, 1);
  assert.equal(byMeta[0].id, 'evt_2');

  // Date & severity filtering + newest-first order
  const byRange = filterEventLogs(entries, { fromDate: '2026-11-21', toDate: '2026-11-21' });
  assert.deepEqual(
    byRange.map((e) => e.id),
    ['evt_3', 'evt_2']
  );

  const onlyErrors = filterEventLogs(entries, { severity: 'error' });
  assert.deepEqual(
    onlyErrors.map((e) => e.id),
    ['evt_3']
  );
});

test('buildHistoricalEventSeeds and mergeEventLogs preserve provenance without duplicating live records', () => {
  const seeds = buildHistoricalEventSeeds({
    bookings: [
      makeBooking({
        lastModifiedAt: '2026-11-20T09:00:00.000Z',
        modificationHistory: [
          {
            timestamp: '2026-11-20 11:30',
            modifiedBy: 'Gérant',
            changes: 'Tarif: 24000 → 26000',
          },
        ],
      }),
    ],
    stockMovements: [
      {
        id: 'sm_10',
        timestamp: '2026-11-20 15:00',
        itemId: 'draps',
        itemName: 'Jeu de draps',
        delta: -2,
        reason: 'Sortie chambre 101',
        room: '101',
        user: 'Amina',
      },
    ],
    issuedCards: [
      {
        id: 'card_10',
        type: 'guest',
        cardIndex: 1,
        roomNumber: '101',
        holderName: 'Amine Benali',
        operator: 'Reception',
        issuedAt: '2026-11-20T14:05:00.000Z',
        validUntil: '2026-11-23T12:00:00.000Z',
        status: 'active',
        rawHex: 'AA00',
      },
    ],
    auditRecords: [],
    invoices: [
      {
        id: 'inv_10',
        docNumber: 'FAC-2026-1001',
        docType: 'invoice',
        domain: 'hotel',
        bookingId: 'bkg_1',
        customerName: 'Amine Benali',
        customerEmail: 'amine@example.com',
        issueDate: '2026-11-20',
        validUntilOrDueDate: '2026-12-04',
        items: [],
        subtotalHT: 20000,
        discountType: 'none',
        discountValue: 0,
        discountAmount: 0,
        vatAmount: 2000,
        cityTouristTax: 0,
        currency: 'DA',
        totalTTC: 22000,
        depositPaid: 22000,
        balanceDue: 0,
        status: 'paid',
        termsAndNotes: '',
      },
    ],
  });

  assert.equal(seeds.length, 5);
  assert.ok(seeds.every((s) => s.source === 'history'));

  const liveOverride: EventLogEntry = {
    ...seeds[0],
    source: 'live',
    title: 'Live override',
  };
  const merged = mergeEventLogs([liveOverride], seeds, 10);
  assert.equal(merged.filter((e) => e.id === liveOverride.id).length, 1);
  assert.equal(merged.find((e) => e.id === liveOverride.id)?.source, 'live');
});

test('sanitizeCsvCell and formatEventLogsAsCsv guard against spreadsheet formula injection', () => {
  assert.equal(sanitizeCsvCell('=SUM(A1:A2)'), '"\'=SUM(A1:A2)"');
  assert.equal(sanitizeCsvCell('+cmd|calc'), '"\'+cmd|calc"');
  assert.equal(sanitizeCsvCell('Normal "quoted" text'), '"Normal ""quoted"" text"');

  const csv = formatEventLogsAsCsv([
    {
      id: 'evt_csv',
      timestamp: '2026-11-21T10:00:00.000Z',
      category: 'booking',
      action: 'booking.created',
      severity: 'success',
      title: '=IMPORTXML("http://bad")',
      description: 'Test description',
      actor: { role: 'manager', label: 'Gérant' },
      changes: [{ field: 'Prix', before: '100', after: '200' }],
      source: 'live',
    },
  ]);

  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes(`"'=IMPORTXML(""http://bad"")"`));
  assert.ok(csv.includes('Prix: 100 -> 200'));
});

test('indexedDb eventLogs fallback persists newest-first, caps retention, and clears on purge', async () => {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
  const previousStorage = (globalThis as { localStorage?: unknown }).localStorage;
  (globalThis as { localStorage?: unknown }).localStorage = mockLocalStorage;

  try {
    await indexedDb.clearEventLogs();
    for (let i = 1; i <= 5; i += 1) {
      await indexedDb.appendEventLog(
        {
          id: `evt_fb_${i}`,
          timestamp: `2026-11-21T0${i}:00:00.000Z`,
          category: 'system',
          action: 'system.test',
          severity: 'info',
          title: `Event ${i}`,
          description: `Detail ${i}`,
          actor: { role: 'manager', label: 'Gérant' },
          source: 'live',
        },
        3
      );
    }

    const stored = await indexedDb.getEventLogs();
    assert.deepEqual(
      stored.map((e) => e.id),
      ['evt_fb_5', 'evt_fb_4', 'evt_fb_3']
    );

    await indexedDb.clearAll();
    const afterPurge = await indexedDb.getEventLogs();
    assert.equal(afterPurge.length, 0);
  } finally {
    if (previousStorage === undefined) {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    } else {
      (globalThis as { localStorage?: unknown }).localStorage = previousStorage;
    }
  }
});

test('buildEventLogExportFilename and formatEventLogsAsText produce complete structured audit logs', () => {
  assert.equal(buildEventLogExportFilename('pdf', '2026-11-21'), 'journal-evenements-2026-11-21.pdf');
  assert.equal(buildEventLogExportFilename('txt', '2026-11-21'), 'journal-evenements-2026-11-21.txt');
  assert.match(buildEventLogExportFilename('csv'), /^journal-evenements-\d{4}-\d{2}-\d{2}\.csv$/);

  const emptyTxt = formatEventLogsAsText([], {
    hotelName: 'Hôtel El Aurassi',
    filterSummary: 'Erreurs',
    exportedAt: '2026-11-21T12:00:00.000Z',
  });
  assert.ok(emptyTxt.includes('Hôtel El Aurassi'));
  assert.ok(emptyTxt.includes('Total      : 0 evenement(s)'));
  assert.ok(emptyTxt.includes('Aucun evenement a exporter'));

  const txt = formatEventLogsAsText(
    [
      {
        id: 'evt_txt_1',
        timestamp: '2026-11-21T10:15:00.000Z',
        category: 'booking',
        action: 'booking.updated',
        severity: 'info',
        title: 'Réservation modifiée · Karim Ziani',
        description: 'Mise à jour tarif et départ',
        actor: { role: 'manager', label: 'Gérant' },
        target: { type: 'booking', id: 'bkg_9', label: 'Karim Ziani', secondaryLabel: 'Suite 302' },
        changes: [{ field: 'Montant total', before: '18000', after: '22000' }],
        metadata: { currency: 'DA' },
        source: 'live',
      },
    ],
    {
      hotelName: 'Hôtel El Aurassi',
      filterSummary: 'Réservations',
      exportedAt: '2026-11-21T12:00:00.000Z',
    }
  );

  assert.ok(txt.includes('#0001 | 2026-11-21T10:15:00.000Z | [INFO] | booking (booking.updated)'));
  assert.ok(txt.includes('Operateur  : Gérant (manager)'));
  assert.ok(txt.includes('Cible      : Karim Ziani · Suite 302 [id=bkg_9]'));
  assert.ok(txt.includes('- Montant total : 18000 -> 22000'));
  assert.ok(txt.includes('Metadonnees: currency=DA'));
});

