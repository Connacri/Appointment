/**
 * Geometry for one reservation bar on the Gantt canvas.
 *
 * Kept pure and separate from the React component so the month-view regression
 * (a malformed/out-of-window date stretching a bar across the whole 25-month
 * canvas, or a same-day reservation being dropped) is covered by unit tests.
 */

const MS_PER_DAY = 86_400_000;

export interface TimelineBarGeometryInput {
  /** Inclusive check-in date, YYYY-MM-DD. */
  startDate: string;
  /** Exclusive check-out date, YYYY-MM-DD. */
  endDate: string;
  /** First rendered day of the rolling timeline window, YYYY-MM-DD. */
  windowStartDate: string;
  /** Number of rendered days in the rolling timeline window. */
  windowDays: number;
  /** Pixel width of one day column. */
  colWidth: number;
  checkInTime?: string;
  checkOutTime?: string;
  /** Hotel stays use check-in/check-out times to offset the bar inside its day. */
  isTimedStay: boolean;
}

export interface TimelineBarGeometryResult {
  visible: boolean;
  leftOffset: number;
  barWidth: number;
}

const HIDDEN: TimelineBarGeometryResult = { visible: false, leftOffset: 0, barWidth: 0 };

function parseDayNumber(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value?.trim() ?? '');
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.floor(timestamp / MS_PER_DAY);
}

function parseTimeFraction(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parts = value.split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1] ?? 0);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback;
  return Math.min(1, Math.max(0, (hours * 60 + minutes) / 1440));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeTimelineBarGeometry(
  input: TimelineBarGeometryInput,
): TimelineBarGeometryResult {
  const startDay = parseDayNumber(input.startDate);
  const endDay = parseDayNumber(input.endDate);
  const windowStartDay = parseDayNumber(input.windowStartDate);
  if (startDay === null || windowStartDay === null || input.windowDays <= 0) return HIDDEN;

  // An invalid, missing or earlier end date must never produce a bar that runs
  // to the end of the canvas. Treat it as a single-day reservation instead.
  const effectiveEndDay = endDay === null || endDay <= startDay ? startDay + 1 : endDay;
  const windowEndDay = windowStartDay + input.windowDays;
  if (effectiveEndDay <= windowStartDay || startDay >= windowEndDay) return HIDDEN;

  const visibleStart = clamp(startDay - windowStartDay, 0, input.windowDays);
  const visibleEnd = clamp(effectiveEndDay - windowStartDay, 0, input.windowDays);
  const startFraction =
    input.isTimedStay && startDay >= windowStartDay
      ? parseTimeFraction(input.checkInTime, 14 / 24)
      : 0;
  const endFraction =
    input.isTimedStay && effectiveEndDay < windowEndDay
      ? parseTimeFraction(input.checkOutTime, 12 / 24)
      : 0;

  const colWidth = Number.isFinite(input.colWidth) && input.colWidth > 0 ? input.colWidth : 28;
  let leftOffset = visibleStart * colWidth + startFraction * colWidth;
  let rightOffset = visibleEnd * colWidth + endFraction * colWidth;
  if (!Number.isFinite(leftOffset) || !Number.isFinite(rightOffset)) {
    leftOffset = visibleStart * colWidth;
    rightOffset = visibleEnd * colWidth;
  }

  return {
    visible: true,
    leftOffset,
    barWidth: Math.max(rightOffset - leftOffset - 6, 12),
  };
}
