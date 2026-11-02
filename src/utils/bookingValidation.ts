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
 * A pending payment is settled only when cash receipt was explicitly confirmed.
 * A payment already marked as paid remains paid when check-in is confirmed.
 */
export const shouldMarkPaymentAsPaid = (
  currentStatus: string | undefined,
  cashReceived: boolean
): boolean => currentStatus === 'paid' || cashReceived === true;
