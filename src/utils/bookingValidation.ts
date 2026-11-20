/**
 * Pure reservation/payment guards shared by the app and regression tests.
 */
export const isValidCalendarDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

/**
 * Same-day stays are valid when check-out time is after check-in time; the
 * remote `bookings_check` constraint only requires end_date >= start_date.
 * An end date before the start date is never valid and must be rejected before
 * it reaches the offline Outbox.
 */
export const isValidBookingDateRange = (startDate: string, endDate: string): boolean =>
  isValidCalendarDate(startDate) && isValidCalendarDate(endDate) && endDate >= startDate;

/**
 * A pending payment is settled only when cash receipt was explicitly confirmed.
 * A payment already marked as paid remains paid when check-in is confirmed.
 */
export const shouldMarkPaymentAsPaid = (
  currentStatus: string | undefined,
  cashReceived: boolean
): boolean => currentStatus === 'paid' || cashReceived === true;
