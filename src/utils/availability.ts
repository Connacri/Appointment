import type { ResourceItem, TimelineBooking } from '../types/booking';

/**
 * Availability per day for a set of resources.
 *
 * Uses a difference array over the rendered day window instead of scanning
 * every resource × day × booking: O(bookings + days) rather than
 * O(resources × days × bookings). Overlapping bookings on the same resource
 * count once, because availability is about distinct occupied rooms.
 */
export function computeAvailabilityByDay(
  resources: ResourceItem[],
  bookingsByResource: Map<string, TimelineBooking[]>,
  timelineDays: Array<{ dateStr: string }>,
): Record<string, number> {
  const dayCount = timelineDays.length;
  if (dayCount === 0 || resources.length === 0) return {};

  const firstDay = timelineDays[0].dateStr;
  const lastDay = timelineDays[dayCount - 1].dateStr;
  const dayIndex = new Map(timelineDays.map((day, index) => [day.dateStr, index]));
  const diff = new Int32Array(dayCount + 1);

  for (const resource of resources) {
    const intervals: Array<{ start: number; end: number }> = [];

    for (const booking of bookingsByResource.get(resource.id) ?? []) {
      if (booking.status === 'cancelled') continue;
      if (booking.endDate <= firstDay || booking.startDate > lastDay) continue;

      let start = dayIndex.get(booking.startDate);
      if (start === undefined) start = booking.startDate < firstDay ? 0 : -1;
      let end = dayIndex.get(booking.endDate);
      if (end === undefined) end = booking.endDate > lastDay ? dayCount : -1;
      if (start < 0 || end < 0 || end <= start) continue;

      intervals.push({ start, end });
    }

    // Merge overlaps for the same resource so a double booking is not counted
    // twice against availability.
    intervals.sort((a, b) => a.start - b.start);
    let currentStart = -1;
    let currentEnd = -1;
    for (const interval of intervals) {
      if (currentStart < 0) {
        currentStart = interval.start;
        currentEnd = interval.end;
        continue;
      }
      if (interval.start <= currentEnd) {
        if (interval.end > currentEnd) currentEnd = interval.end;
        continue;
      }
      diff[currentStart] += 1;
      diff[Math.min(currentEnd, dayCount)] -= 1;
      currentStart = interval.start;
      currentEnd = interval.end;
    }
    if (currentStart >= 0) {
      diff[currentStart] += 1;
      diff[Math.min(currentEnd, dayCount)] -= 1;
    }
  }

  const availability: Record<string, number> = {};
  let occupied = 0;
  for (let index = 0; index < dayCount; index += 1) {
    occupied += diff[index];
    availability[timelineDays[index].dateStr] = Math.max(0, resources.length - occupied);
  }
  return availability;
}
