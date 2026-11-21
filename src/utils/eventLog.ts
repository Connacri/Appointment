import type { InvoiceRecord, StockMovement, TimelineBooking } from '../types/booking';
import type { LockAuditRecord } from '../locks/cards/types';
import type { IssuedCardRecord } from '../locks/lockManager';
import type { EventLogChange, EventLogEntry, EventLogFilterOptions } from '../types/eventLog';

export const EVENT_LOG_MAX_ENTRIES = 2000;

function formatDiffValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (Array.isArray(value)) return String(value.length);
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  return String(value);
}

const BOOKING_DIFF_FIELDS: Array<{ key: keyof TimelineBooking; label: string }> = [
  { key: 'guestName', label: 'Client' },
  { key: 'resourceName', label: 'Chambre / Ressource' },
  { key: 'startDate', label: 'Arrivée' },
  { key: 'endDate', label: 'Départ' },
  { key: 'checkInTime', label: 'Heure arrivée' },
  { key: 'checkOutTime', label: 'Heure départ' },
  { key: 'status', label: 'Statut séjour' },
  { key: 'paymentStatus', label: 'Statut paiement' },
  { key: 'paymentMethodType', label: 'Mode paiement' },
  { key: 'totalPrice', label: 'Montant total' },
  { key: 'paymentCurrency', label: 'Devise paiement' },
  { key: 'mealPlan', label: 'Formule repas' },
  { key: 'adults', label: 'Adultes' },
  { key: 'children', label: 'Enfants' },
  { key: 'idPieceType', label: 'Type pièce ID' },
  { key: 'idPieceNumber', label: 'N° pièce ID' },
  { key: 'nationality', label: 'Nationalité' },
  { key: 'notes', label: 'Notes' },
];

export function computeBookingDiff(
  previous: TimelineBooking,
  updates: Partial<TimelineBooking>
): EventLogChange[] {
  const changes: EventLogChange[] = [];

  for (const { key, label } of BOOKING_DIFF_FIELDS) {
    if (!(key in updates)) continue;
    const nextVal = updates[key];
    const prevVal = previous[key];
    if (nextVal === prevVal) continue;
    const prevFormatted = formatDiffValue(prevVal);
    const nextFormatted = formatDiffValue(nextVal);
    if (prevFormatted === nextFormatted) continue;
    changes.push({
      field: label,
      before: prevFormatted,
      after: nextFormatted,
    });
  }

  if ('forgottenItems' in updates) {
    const prevCount = previous.forgottenItems?.length ?? 0;
    const nextCount = updates.forgottenItems?.length ?? 0;
    const prevReturned = previous.forgottenItems?.filter((i) => i.status === 'returned').length ?? 0;
    const nextReturned = updates.forgottenItems?.filter((i) => i.status === 'returned').length ?? 0;
    if (prevCount !== nextCount || prevReturned !== nextReturned) {
      changes.push({
        field: 'Objets oubliés',
        before: `${prevCount} (${prevReturned} rendus)`,
        after: `${nextCount} (${nextReturned} rendus)`,
      });
    }
  }

  if ('valuablesAtReception' in updates) {
    const prevCount = previous.valuablesAtReception?.length ?? 0;
    const nextCount = updates.valuablesAtReception?.length ?? 0;
    const prevReturned = previous.valuablesAtReception?.filter((i) => i.status === 'returned').length ?? 0;
    const nextReturned = updates.valuablesAtReception?.filter((i) => i.status === 'returned').length ?? 0;
    if (prevCount !== nextCount || prevReturned !== nextReturned) {
      changes.push({
        field: 'Dépôts coffre réception',
        before: `${prevCount} (${prevReturned} restitués)`,
        after: `${nextCount} (${nextReturned} restitués)`,
      });
    }
  }

  if ('occupantsList' in updates || 'adultGuests' in updates) {
    const summarizeOccupants = (b: Partial<TimelineBooking>): string => {
      const list =
        Array.isArray(b.occupantsList) && b.occupantsList.length > 0
          ? b.occupantsList
          : b.adultGuests ?? [];
      if (list.length === 0) return '0';
      const labels = list
        .map((occ) => (occ?.fullName || occ?.name || '').trim())
        .filter(Boolean);
      return `${list.length} (${labels.join(', ') || 'incomplet'})`;
    };
    const prevSummary = summarizeOccupants(previous);
    const nextSummary = summarizeOccupants({
      adultGuests: updates.adultGuests ?? previous.adultGuests,
      occupantsList: updates.occupantsList ?? previous.occupantsList,
    });
    if (prevSummary !== nextSummary) {
      changes.push({
        field: 'Occupants & accompagnants',
        before: prevSummary,
        after: nextSummary,
      });
    }
  }

  return changes;
}

function normalizeSearchText(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function sortEventLogsDesc(entries: EventLogEntry[]): EventLogEntry[] {
  return [...entries].sort((a, b) => {
    const byTime = b.timestamp.localeCompare(a.timestamp);
    if (byTime !== 0) return byTime;
    return b.id.localeCompare(a.id);
  });
}

export function filterEventLogs(
  entries: EventLogEntry[],
  filters: EventLogFilterOptions
): EventLogEntry[] {
  const queryNorm = normalizeSearchText(filters.query);
  const category = filters.category && filters.category !== 'all' ? filters.category : null;
  const severity = filters.severity && filters.severity !== 'all' ? filters.severity : null;
  const fromDate = filters.fromDate?.trim() || null;
  const toDate = filters.toDate?.trim() || null;

  const filtered = entries.filter((entry) => {
    if (category && entry.category !== category) return false;
    if (severity && entry.severity !== severity) return false;

    const entryDate = entry.timestamp.slice(0, 10);
    if (fromDate && entryDate < fromDate) return false;
    if (toDate && entryDate > toDate) return false;

    if (queryNorm) {
      const searchableParts: string[] = [
        entry.title,
        entry.description,
        entry.action,
        entry.category,
        entry.severity,
        entry.actor?.label || '',
        entry.actor?.role || '',
        entry.target?.label || '',
        entry.target?.secondaryLabel || '',
        entry.target?.id || '',
        entry.bookingId ?? '',
        entry.resourceId ?? '',
      ];
      if (entry.changes) {
        for (const change of entry.changes) {
          searchableParts.push(change.field, change.before ?? '', change.after ?? '');
        }
      }
      if (entry.metadata) {
        for (const [k, v] of Object.entries(entry.metadata)) {
          searchableParts.push(k, v === null ? '' : String(v));
        }
      }
      const haystack = normalizeSearchText(searchableParts.filter(Boolean).join(' '));
      if (!haystack.includes(queryNorm)) return false;
    }

    return true;
  });

  return sortEventLogsDesc(filtered);
}

function toIsoTimestamp(raw: string | undefined, fallbackDate?: string): string | null {
  if (raw) {
    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const parsed = Date.parse(normalized);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  if (fallbackDate && /^\d{4}-\d{2}-\d{2}$/.test(fallbackDate)) {
    return `${fallbackDate}T12:00:00.000Z`;
  }
  return null;
}

export interface HistoricalEventSeedInput {
  bookings: TimelineBooking[];
  stockMovements: StockMovement[];
  issuedCards: IssuedCardRecord[];
  auditRecords: LockAuditRecord[];
  invoices?: InvoiceRecord[];
  workspaceId?: string;
}

/**
 * Derive deterministic audit entries from existing persisted records so users
 * immediately inspect historical bookings, modifications, stock movements,
 * issued cards, lock audits and invoices alongside newly captured live events.
 */
export function buildHistoricalEventSeeds(input: HistoricalEventSeedInput): EventLogEntry[] {
  const seeds: EventLogEntry[] = [];
  const wsId = input.workspaceId || undefined;

  for (const booking of input.bookings) {
    const baseTs =
      toIsoTimestamp(booking.lastModifiedAt, booking.startDate) ??
      toIsoTimestamp(
        booking.startDate ? `${booking.startDate}T${booking.checkInTime || '14:00'}:00` : undefined
      );

    if (baseTs) {
      const currencyLabel = booking.paymentCurrency || 'DA';
      seeds.push({
        id: `hist-bkg-created-${booking.id}`,
        timestamp: baseTs,
        category: 'booking',
        action: 'booking.recorded',
        severity: booking.status === 'cancelled' ? 'warn' : 'info',
        title: `Réservation enregistrée · ${booking.guestName}`,
        description: `${booking.resourceName} du ${booking.startDate} au ${booking.endDate} · ${booking.totalPrice} ${currencyLabel} (${booking.status})`,
        actor: { role: 'system', label: booking.originChannel || 'Historique dossier' },
        target: {
          type: 'booking',
          id: booking.id,
          label: booking.guestName,
          secondaryLabel: booking.resourceName,
        },
        metadata: {
          startDate: booking.startDate,
          endDate: booking.endDate,
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          totalPrice: booking.totalPrice,
          currency: currencyLabel,
          sector: booking.sector,
        },
        bookingId: booking.id,
        resourceId: booking.resourceId,
        workspaceId: wsId,
        source: 'history',
      });
    }

    if (Array.isArray(booking.modificationHistory)) {
      booking.modificationHistory.forEach((mod, idx) => {
        const ts =
          toIsoTimestamp(mod.timestamp, booking.startDate) ??
          baseTs ??
          new Date(0).toISOString();
        seeds.push({
          id: `hist-bkg-mod-${booking.id}-${idx}`,
          timestamp: ts,
          category: 'booking',
          action: 'booking.history_note',
          severity: 'info',
          title: `Historique dossier · ${booking.guestName}`,
          description: mod.changes,
          actor: { role: 'staff', label: mod.modifiedBy || 'Journal réservation' },
          target: {
            type: 'booking',
            id: booking.id,
            label: booking.guestName,
            secondaryLabel: booking.resourceName,
          },
          bookingId: booking.id,
          resourceId: booking.resourceId,
          workspaceId: wsId,
          source: 'history',
        });
      });
    }
  }

  for (const mov of input.stockMovements) {
    const ts = toIsoTimestamp(mov.timestamp);
    if (!ts) continue;
    seeds.push({
      id: `hist-stock-${mov.id}`,
      timestamp: ts,
      category: 'stock',
      action: mov.delta >= 0 ? 'stock.entry' : 'stock.exit',
      severity: mov.delta < 0 ? 'info' : 'success',
      title: `${mov.delta >= 0 ? 'Entrée' : 'Sortie'} stock · ${mov.itemName}`,
      description: `${mov.delta >= 0 ? '+' : ''}${mov.delta} unité(s) · ${mov.reason}${mov.room ? ` (${mov.room})` : ''}`,
      actor: { role: 'staff', label: mov.user || 'Équipe' },
      target: {
        type: 'stock_item',
        id: mov.itemId,
        label: mov.itemName,
        secondaryLabel: mov.room,
      },
      metadata: {
        delta: mov.delta,
        reason: mov.reason,
        room: mov.room || null,
      },
      workspaceId: wsId,
      source: 'history',
    });
  }

  for (const card of input.issuedCards) {
    const ts = toIsoTimestamp(card.issuedAt);
    if (!ts) continue;
    seeds.push({
      id: `hist-card-${card.id}`,
      timestamp: ts,
      category: 'locks',
      action: card.status === 'revoked' ? 'locks.card_revoked' : 'locks.card_issued',
      severity: card.status === 'revoked' ? 'warn' : 'success',
      title: `Carte ${card.type} · ${card.roomNumber || 'Système'}`,
      description: `Titulaire : ${card.holderName || '—'} · Statut : ${card.status}`,
      actor: { role: 'receptionist', label: card.operator || 'Encodeur proUSB' },
      target: {
        type: 'card',
        id: card.id,
        label: card.holderName || card.type,
        secondaryLabel: card.roomNumber || undefined,
      },
      metadata: {
        cardType: card.type,
        roomNumber: card.roomNumber || null,
        status: card.status,
        validUntil: card.validUntil || null,
      },
      workspaceId: wsId,
      source: 'history',
    });
  }

  for (const audit of input.auditRecords) {
    const ts = toIsoTimestamp(audit.openTime);
    if (!ts) continue;
    const auditId = `${audit.orderFlag}-${audit.openTime}-${audit.recDataHex}`;
    seeds.push({
      id: `hist-audit-${auditId}`,
      timestamp: ts,
      category: 'locks',
      action: `locks.${audit.eventType}`,
      severity: audit.eventType === 'emergency_open' || audit.eventType === 'deadbolt_forced' || audit.eventType === 'invalid_card' ? 'warn' : 'info',
      title: `Audit serrure ${audit.roomNo || '—'} · ${audit.eventType}`,
      description: `Carte ${audit.cardIdentifier || '—'} · Trame ${audit.recDataHex}`,
      actor: { role: 'locks', label: 'Serrure proUSB' },
      target: {
        type: 'lock_audit',
        id: auditId,
        label: audit.roomNo || 'Serrure',
        secondaryLabel: audit.cardIdentifier,
      },
      metadata: {
        roomNo: audit.roomNo || null,
        cardIdentifier: audit.cardIdentifier || null,
        orderFlag: audit.orderFlag,
        recDataHex: audit.recDataHex,
        eventType: audit.eventType,
      },
      workspaceId: wsId,
      source: 'history',
    });
  }

  if (Array.isArray(input.invoices)) {
    for (const inv of input.invoices) {
      const ts = toIsoTimestamp(inv.issueDate ? `${inv.issueDate}T10:00:00` : undefined);
      if (!ts) continue;
      const invCurrency = inv.currency || 'DA';
      seeds.push({
        id: `hist-inv-${inv.id}`,
        timestamp: ts,
        category: 'billing',
        action: 'billing.document_recorded',
        severity: inv.status === 'paid' ? 'success' : 'info',
        title: `${inv.docNumber} · ${inv.customerName}`,
        description: `${inv.docType.toUpperCase()} · Total TTC ${inv.totalTTC} ${invCurrency} · Solde dû ${inv.balanceDue} ${invCurrency}`,
        actor: { role: 'billing', label: 'Facturation' },
        target: {
          type: 'invoice',
          id: inv.id,
          label: inv.docNumber,
          secondaryLabel: inv.customerName,
        },
        metadata: {
          docType: inv.docType,
          status: inv.status,
          totalTTC: inv.totalTTC,
          balanceDue: inv.balanceDue,
          currency: invCurrency,
        },
        bookingId: inv.bookingId,
        workspaceId: wsId,
        source: 'history',
      });
    }
  }

  return seeds;
}

export function mergeEventLogs(
  liveEntries: EventLogEntry[],
  historicalEntries: EventLogEntry[],
  maxEntries = EVENT_LOG_MAX_ENTRIES
): EventLogEntry[] {
  const byId = new Map<string, EventLogEntry>();
  for (const hist of historicalEntries) {
    byId.set(hist.id, hist);
  }
  for (const live of liveEntries) {
    byId.set(live.id, live);
  }
  return sortEventLogsDesc([...byId.values()]).slice(0, maxEntries);
}

export function sanitizeCsvCell(value: unknown): string {
  const str = value === undefined || value === null ? '' : String(value);
  const formulaSafe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
}

export function formatEventLogsAsCsv(entries: EventLogEntry[]): string {
  const headers = [
    'Timestamp',
    'Severity',
    'Category',
    'Action',
    'Title',
    'Description',
    'Actor',
    'ActorRole',
    'Target',
    'SecondaryTarget',
    'Changes',
    'Metadata',
    'Source',
  ];
  const rows = entries.map((entry) => {
    const changesStr = (entry.changes || [])
      .map((c) => `${c.field}: ${c.before ?? '—'} -> ${c.after ?? '—'}`)
      .join(' | ');
    const metaStr = entry.metadata
      ? Object.entries(entry.metadata)
          .filter(([, v]) => v !== null && v !== undefined)
          .map(([k, v]) => `${k}=${String(v)}`)
          .join(' | ')
      : '';

    return [
      entry.timestamp,
      entry.severity,
      entry.category,
      entry.action,
      entry.title,
      entry.description,
      entry.actor?.label || '',
      entry.actor?.role || '',
      entry.target?.label || '',
      entry.target?.secondaryLabel || '',
      changesStr,
      metaStr,
      entry.source,
    ]
      .map(sanitizeCsvCell)
      .join(',');
  });

  return '\uFEFF' + [headers.map(sanitizeCsvCell).join(','), ...rows].join('\r\n');
}

export function formatEventLogsAsJson(entries: EventLogEntry[]): string {
  return JSON.stringify(entries, null, 2);
}

export function buildEventLogExportFilename(
  extension: 'pdf' | 'csv' | 'json' | 'txt',
  dateStr?: string
): string {
  const safeDate =
    dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      ? dateStr
      : (() => {
          const d = new Date();
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        })();
  return `journal-evenements-${safeDate}.${extension}`;
}

export interface EventLogTextExportOptions {
  hotelName?: string;
  filterSummary?: string;
  exportedAt?: string;
}

export function formatEventLogsAsText(
  entries: EventLogEntry[],
  options: EventLogTextExportOptions = {}
): string {
  const hotelName = options.hotelName?.trim() || 'Appointment PMS';
  const exportedAt = options.exportedAt?.trim() || new Date().toISOString();
  const filterSummary = options.filterSummary?.trim() || 'Aucun filtre (journal complet)';

  const lines: string[] = [
    `================================================================================`,
    `JOURNAL DETAILLE DES EVENEMENTS — ${hotelName}`,
    `Exporte le : ${exportedAt}`,
    `Filtres    : ${filterSummary}`,
    `Total      : ${entries.length} evenement(s)`,
    `================================================================================`,
    '',
  ];

  if (entries.length === 0) {
    lines.push('Aucun evenement a exporter pour la selection active.');
    return lines.join('\n');
  }

  entries.forEach((entry, index) => {
    const num = String(index + 1).padStart(4, '0');
    lines.push(
      `#${num} | ${entry.timestamp} | [${entry.severity.toUpperCase()}] | ${entry.category} (${entry.action})`
    );
    lines.push(`Titre      : ${entry.title}`);
    lines.push(`Detail     : ${entry.description}`);
    lines.push(`Operateur  : ${entry.actor?.label || '—'} (${entry.actor?.role || '—'})`);
    if (entry.target) {
      const targetParts = [entry.target.label, entry.target.secondaryLabel].filter(Boolean).join(' · ');
      lines.push(
        `Cible      : ${targetParts || entry.target.type}${entry.target.id ? ` [id=${entry.target.id}]` : ''}`
      );
    }
    if (entry.changes && entry.changes.length > 0) {
      lines.push('Modifications :');
      for (const chg of entry.changes) {
        lines.push(`  - ${chg.field} : ${chg.before ?? '—'} -> ${chg.after ?? '—'}`);
      }
    }
    if (entry.metadata) {
      const metaPairs = Object.entries(entry.metadata)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${k}=${String(v)}`);
      if (metaPairs.length > 0) {
        lines.push(`Metadonnees: ${metaPairs.join(' | ')}`);
      }
    }
    lines.push(`Source     : ${entry.source}`);
    lines.push('--------------------------------------------------------------------------------');
  });

  return lines.join('\n');
}

