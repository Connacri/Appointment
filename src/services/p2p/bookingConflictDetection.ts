import type { P2pEvent } from './protocol';
import { maximalP2pEvents } from './protocol';

export interface BookingConflictSnapshot {
  id: string;
  workspaceId: string;
  resourceId: string;
  firstBookingId: string;
  secondBookingId: string;
  firstEventId: string;
  secondEventId: string;
  startAt: string;
  endAt: string;
  detectedAt: string;
  status: 'pending';
  reason: 'overlapping_reservations';
}

interface BookingPayload {
  id: string;
  resourceId: string;
  sector: string;
  startDate: string;
  endDate: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: string;
}

function asBooking(event: P2pEvent): BookingPayload | null {
  if (event.entity !== 'booking' || event.operation !== 'upsert' || !event.payload) return null;
  const value = event.payload as Record<string, unknown>;
  if (
    typeof value.id !== 'string' || value.id !== event.entityId
    || typeof value.resourceId !== 'string' || !value.resourceId
    || typeof value.sector !== 'string'
    || typeof value.startDate !== 'string' || typeof value.endDate !== 'string'
    || typeof value.status !== 'string'
  ) return null;
  return value as unknown as BookingPayload;
}

/** Convert a local hotel wall-clock date/time to a timezone-independent minute key. */
function wallClockMinute(date: string, time: string): number | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(?:([01]\d|2[0-3])):([0-5]\d)$/.exec(time);
  if (!dateMatch || !timeMatch) return null;
  const [, y, m, d] = dateMatch;
  const year = Number(y), month = Number(m), day = Number(d);
  const stamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(stamp);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return Math.floor(stamp / 60_000) + Number(timeMatch[1]) * 60 + Number(timeMatch[2]);
}

function interval(booking: BookingPayload): { start: number; end: number } | null {
  if (booking.status === 'cancelled') return null;
  const start = wallClockMinute(booking.startDate, booking.checkInTime || '14:00');
  const end = wallClockMinute(booking.endDate, booking.checkOutTime || '12:00');
  if (start === null || end === null || end <= start) return null;
  return { start, end };
}

function stableConflictId(workspaceId: string, a: string, b: string): string {
  const pair = [a, b].sort();
  return `booking-overlap:${encodeURIComponent(workspaceId)}:${encodeURIComponent(pair[0])}:${encodeURIComponent(pair[1])}`;
}

/**
 * Detects overlapping reservations across different business IDs.
 * It evaluates the causal frontier of each booking, then compares active stays
 * on the same resource. Hotel turnover is symmetric and equals ten minutes,
 * matching the existing local booking guard without depending on device timezone.
 */
export function detectP2pBookingConflicts(
  events: readonly P2pEvent[],
  detectedAt = new Date().toISOString(),
): BookingConflictSnapshot[] {
  const byBooking = new Map<string, P2pEvent[]>();
  for (const event of events) {
    if (event.entity !== 'booking') continue;
    const bucket = byBooking.get(event.entityId) ?? [];
    bucket.push(event);
    byBooking.set(event.entityId, bucket);
  }

  const bookings: Array<{ event: P2pEvent; booking: BookingPayload; range: { start: number; end: number } }> = [];
  for (const versions of byBooking.values()) {
    for (const event of maximalP2pEvents(versions)) {
      const booking = asBooking(event);
      if (!booking) continue;
      const range = interval(booking);
      if (range) bookings.push({ event, booking, range });
    }
  }

  const conflicts: BookingConflictSnapshot[] = [];
  for (let i = 0; i < bookings.length; i += 1) {
    const a = bookings[i];
    for (let j = i + 1; j < bookings.length; j += 1) {
      const b = bookings[j];
      if (a.booking.id === b.booking.id || a.booking.resourceId !== b.booking.resourceId) continue;
      const turnover = a.booking.sector === 'hotel' || b.booking.sector === 'hotel' ? 10 : 0;
      if (a.range.start < b.range.end + turnover && a.range.end + turnover > b.range.start) {
        const first = a.booking.id.localeCompare(b.booking.id) <= 0 ? a : b;
        const second = first === a ? b : a;
        conflicts.push({
          id: stableConflictId(a.event.workspaceId, a.event.eventId, b.event.eventId),
          workspaceId: a.event.workspaceId,
          resourceId: a.booking.resourceId,
          firstBookingId: first.booking.id,
          secondBookingId: second.booking.id,
          firstEventId: first.event.eventId,
          secondEventId: second.event.eventId,
          startAt: new Date(Math.max(a.range.start, b.range.start) * 60_000).toISOString(),
          endAt: new Date(Math.min(a.range.end, b.range.end) * 60_000).toISOString(),
          detectedAt,
          status: 'pending',
          reason: 'overlapping_reservations',
        });
      }
    }
  }
  return conflicts.sort((a, b) => a.id.localeCompare(b.id));
}
