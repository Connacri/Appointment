import type { ResourceItem, TimelineBooking } from '../types/booking';
import { hasBookingScheduleConflict } from './bookingValidation';

export type RoomReassignmentPlan =
  | { ok: true; mode: 'move'; booking: TimelineBooking }
  | { ok: true; mode: 'swap'; bookings: [TimelineBooking, TimelineBooking] }
  | { ok: false; reason: 'booking_not_found' | 'resource_not_found' | 'sector_mismatch' | 'room_out_of_order' | 'multiple_occupants' | 'target_conflict' };

const isOutOfOrder = (resource: ResourceItem): boolean => resource.housekeepingStatus === 'out_of_order';

/**
 * Computes a complete room reassignment before any write is made.
 * A swap is permitted only when exactly one booking occupies the target room
 * during the requested interval and both final assignments are conflict-free.
 */
export function planRoomReassignment(
  bookings: readonly TimelineBooking[],
  resources: readonly ResourceItem[],
  bookingId: string,
  targetResourceId: string,
  originalResourceId?: string,
): RoomReassignmentPlan {
  const current = bookings.find((booking) => booking.id === bookingId);
  if (!current) return { ok: false, reason: 'booking_not_found' };

  const target = resources.find((resource) => resource.id === targetResourceId);
  if (!target) return { ok: false, reason: 'resource_not_found' };
  if (target.sector !== current.sector) return { ok: false, reason: 'sector_mismatch' };
  if (isOutOfOrder(target)) return { ok: false, reason: 'room_out_of_order' };
  if (target.id === current.resourceId) return { ok: true, mode: 'move', booking: current };

  const candidate = { ...current, resourceId: target.id, resourceName: target.name };
  const conflicts = bookings.filter((other) =>
    other.id !== current.id
    && hasBookingScheduleConflict([other], candidate, current.id),
  );

  if (conflicts.length === 0) {
    return { ok: true, mode: 'move', booking: candidate };
  }
  if (conflicts.length !== 1) return { ok: false, reason: 'multiple_occupants' };

  const other = conflicts[0];
  if (other.sector !== current.sector || other.status === 'cancelled') {
    return { ok: false, reason: 'target_conflict' };
  }

  const source = resources.find((resource) => resource.id === (originalResourceId || current.resourceId));
  if (!source || isOutOfOrder(source)) return { ok: false, reason: 'room_out_of_order' };

  const swappedCurrent = candidate;
  const swappedOther = { ...other, resourceId: source.id, resourceName: source.name };
  const remaining = bookings.filter((booking) => booking.id !== current.id && booking.id !== other.id);

  if (
    hasBookingScheduleConflict(remaining, swappedCurrent, swappedCurrent.id)
    || hasBookingScheduleConflict(remaining, swappedOther, swappedOther.id)
    || hasBookingScheduleConflict([swappedOther], swappedCurrent, swappedCurrent.id)
    || hasBookingScheduleConflict([swappedCurrent], swappedOther, swappedOther.id)
  ) {
    return { ok: false, reason: 'target_conflict' };
  }

  return { ok: true, mode: 'swap', bookings: [swappedCurrent, swappedOther] };
}
