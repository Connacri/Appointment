import type { TimelineBooking } from '../types/booking';

export const BOOKING_ARCHIVE_SCHEMA_VERSION = 1;
export const BOOKING_OPERATIONAL_RETENTION_MONTHS = 6;

function isValidIsoDate(value: string): boolean {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && toIsoDate(date) === value;
}

function toIsoDate(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

/** Rolling six-calendar-month cutoff, calculated in UTC to avoid DST drift. */
export function getBookingOperationalCutoffDate(now = new Date()): string {
  const sourceYear = now.getUTCFullYear();
  const sourceMonth = now.getUTCMonth();
  const sourceDay = now.getUTCDate();
  const targetMonthIndex = sourceMonth - BOOKING_OPERATIONAL_RETENTION_MONTHS;
  const targetYear = sourceYear + Math.floor(targetMonthIndex / 12);
  const targetMonth = (targetMonthIndex % 12 + 12) % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return toIsoDate(new Date(Date.UTC(targetYear, targetMonth, Math.min(sourceDay, lastDayOfTargetMonth))));
}

/** Closed stays only. Never archive future, in-house, pending or unresolved bookings. */
export function isBookingEligibleForArchive(
  booking: Pick<TimelineBooking, 'status' | 'endDate'>,
  cutoffDate: string,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoffDate) || !/^\d{4}-\d{2}-\d{2}$/.test(booking.endDate)) {
    return false;
  }
  return (booking.status === 'checked_out' || booking.status === 'cancelled')
    && booking.endDate < cutoffDate;
}

/** Calendar half-year partition; historical queries still use the exact date index. */
export function getBookingArchivePeriodKey(endDate: string): string {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(endDate);
  if (!match || !isValidIsoDate(endDate)) throw new Error('Booking archive requires a valid YYYY-MM-DD end date.');
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error('Booking archive end date has an invalid month.');
  return `${match[1]}-${month <= 6 ? 'H1' : 'H2'}`;
}

export function getBookingArchivePeriodBounds(periodKey: string): { startDate: string; endDate: string } {
  const match = /^(\d{4})-H([12])$/.exec(periodKey);
  if (!match) throw new Error('Invalid booking archive period key.');
  return match[2] === '1'
    ? { startDate: `${match[1]}-01-01`, endDate: `${match[1]}-06-30` }
    : { startDate: `${match[1]}-07-01`, endDate: `${match[1]}-12-31` };
}
