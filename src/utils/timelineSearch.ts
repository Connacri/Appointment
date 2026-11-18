import { DomainType, Language, ResourceGroup, ResourceItem, TimelineBooking } from '../types/booking';
import { normalizeBookingText } from './bookingText';

export type RoomGroupingMode = 'floor' | 'wing' | 'floor_wing';

export interface TimelineBookingMatch {
  booking: TimelineBooking;
  groupId: string;
  floorKey: string;
  resource: ResourceItem;
}

/**
 * Normalizes any text value for search comparison:
 * lowercase, trims whitespace, and strips combining diacritics so
 * e.g. "Amélie" matches "amelie" and "Étage" matches "etage".
 */
export function normalizeSearchToken(value: unknown): string {
  const base = normalizeBookingText(value);
  if (!base) return '';
  return base.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Derives the exact subgroup key/label used by PlanningTimeline for a resource.
 */
export function getResourceSubgroupMeta(
  resource: ResourceItem,
  groupingMode: RoomGroupingMode,
  language: Language
): { key: string; label: string; shortLabel: string; sortKey: string } {
  let floor = resource.floor?.trim() || '';
  if (!floor) {
    const pureDigits = resource.name.replace(/\D/g, '');
    if (pureDigits.length >= 3) {
      floor = pureDigits[0];
    } else {
      floor = '1';
    }
  }

  const rawWing = resource.wing?.trim();
  const wing =
    rawWing ||
    (language === 'fr' ? 'Aile Principale' : language === 'ar' ? 'الجناح الرئيسي' : 'Main Wing');

  if (groupingMode === 'wing') {
    return {
      key: wing,
      label: wing,
      shortLabel: wing.substring(0, 4),
      sortKey: wing,
    };
  }

  if (groupingMode === 'floor_wing') {
    return {
      key: `${floor}_${wing}`,
      label: `${language === 'fr' ? 'Étage' : language === 'ar' ? 'الطابق' : 'Floor'} ${floor} • ${wing}`,
      shortLabel: `${language === 'ar' ? 'ط' : 'É'}${floor} • ${wing.substring(0, 4)}`,
      sortKey: `${floor.padStart(4, '0')}_${wing}`,
    };
  }

  return {
    key: floor,
    label: language === 'fr' ? `Étage ${floor}` : language === 'ar' ? `الطابق ${floor}` : `Floor ${floor}`,
    shortLabel: language === 'ar' ? `ط${floor}` : `É${floor}`,
    sortKey: floor.padStart(4, '0'),
  };
}

/**
 * Checks whether a booking matches a user query by:
 * - Guest name (or companion adult guest names)
 * - Reservation ID (with or without leading `#`)
 * - Room number / resource name / resource ID
 * - Guest email or phone as helpful fallback
 */
export function doesBookingMatchQuery(
  booking: TimelineBooking,
  rawQuery: string,
  extraRoomNames: string[] = []
): boolean {
  const q = normalizeSearchToken(rawQuery);
  if (!q) return true;

  const qWithoutHash = q.startsWith('#') ? q.slice(1).trim() : q;
  if (!qWithoutHash) return true;

  if (normalizeSearchToken(booking.guestName).includes(q)) return true;
  if (normalizeSearchToken(booking.id).includes(qWithoutHash)) return true;
  if (normalizeSearchToken(booking.resourceName).includes(q)) return true;
  if (normalizeSearchToken(booking.resourceId).includes(qWithoutHash)) return true;
  if (normalizeSearchToken(booking.guestEmail).includes(q)) return true;
  if (normalizeSearchToken(booking.guestPhone).includes(q)) return true;

  if (Array.isArray(booking.adultGuests)) {
    for (const guest of booking.adultGuests) {
      if (normalizeSearchToken(guest?.fullName).includes(q)) return true;
    }
  }

  for (const roomName of extraRoomNames) {
    if (normalizeSearchToken(roomName).includes(q)) return true;
  }

  return false;
}

/**
 * Checks whether a resource row matches a user query either directly (room number / type / ID)
 * or via any booking attached to that resource.
 */
export function doesResourceMatchQuery(
  resource: ResourceItem,
  resourceBookings: TimelineBooking[],
  rawQuery: string
): boolean {
  const q = normalizeSearchToken(rawQuery);
  if (!q) return true;

  const qWithoutHash = q.startsWith('#') ? q.slice(1).trim() : q;
  if (
    normalizeSearchToken(resource.name).includes(q) ||
    normalizeSearchToken(resource.type).includes(q) ||
    normalizeSearchToken(resource.id).includes(qWithoutHash)
  ) {
    return true;
  }

  return resourceBookings.some((b) =>
    doesBookingMatchQuery(b, rawQuery, [resource.name, resource.type])
  );
}

/**
 * Finds all matching guest bookings scoped strictly to the active domain & establishment,
 * enriched with their group and floor/wing key so the UI can auto-expand and scroll to them.
 */
export function findMatchingTimelineBookings(params: {
  bookings: TimelineBooking[];
  resourceGroups: ResourceGroup[];
  query: string;
  currentDomain: DomainType;
  selectedEstablishmentId: string;
  groupingMode: RoomGroupingMode;
  language: Language;
}): TimelineBookingMatch[] {
  const {
    bookings,
    resourceGroups,
    query,
    currentDomain,
    selectedEstablishmentId,
    groupingMode,
    language,
  } = params;

  const q = normalizeSearchToken(query);
  if (!q) return [];

  const resourceLookup = new Map<
    string,
    { groupId: string; floorKey: string; resource: ResourceItem }
  >();

  for (const group of resourceGroups) {
    if (group.sector !== currentDomain) continue;
    if (currentDomain === 'hotel' && selectedEstablishmentId !== 'all' && group.id !== selectedEstablishmentId) {
      continue;
    }
    for (const resource of group.resources) {
      const floorKey =
        group.sector === 'hotel'
          ? getResourceSubgroupMeta(resource, groupingMode, language).key
          : 'all';
      resourceLookup.set(resource.id, { groupId: group.id, floorKey, resource });
    }
  }

  const matches: TimelineBookingMatch[] = [];
  for (const booking of bookings) {
    if (booking.sector !== currentDomain) continue;
    const target = resourceLookup.get(booking.resourceId);
    if (!target) continue;

    if (doesBookingMatchQuery(booking, query, [target.resource.name, target.resource.type])) {
      matches.push({
        booking,
        groupId: target.groupId,
        floorKey: target.floorKey,
        resource: target.resource,
      });
    }
  }

  matches.sort((a, b) => {
    const aCancelled = a.booking.status === 'cancelled' ? 1 : 0;
    const bCancelled = b.booking.status === 'cancelled' ? 1 : 0;
    if (aCancelled !== bCancelled) return aCancelled - bCancelled;

    const dateCmp = (a.booking.startDate || '').localeCompare(b.booking.startDate || '');
    if (dateCmp !== 0) return dateCmp;

    return (a.booking.guestName || '').localeCompare(b.booking.guestName || '');
  });

  return matches;
}

/**
 * Determines whether a grid cell (resource, dateStr) is an empty bookable slot
 * suitable for displaying a Quick Create shortcut button.
 */
export function isTimelineCellAvailableForQuickCreate(
  resource: ResourceItem,
  dateStr: string,
  todayStr: string,
  resourceBookings: TimelineBooking[]
): boolean {
  if (resource.housekeepingStatus === 'out_of_order') return false;
  if (dateStr < todayStr) return false;

  const isOccupied = resourceBookings.some(
    (b) =>
      b.status !== 'cancelled' &&
      ((b.startDate <= dateStr && b.endDate > dateStr) || b.startDate === dateStr)
  );
  return !isOccupied;
}

/**
 * Checks whether an active (non-cancelled) booking departs on `dateStr`.
 * Useful to position the Quick Create button in the afternoon half of the cell.
 */
export function hasSameDayCheckout(
  dateStr: string,
  resourceBookings: TimelineBooking[]
): boolean {
  return resourceBookings.some(
    (b) => b.status !== 'cancelled' && b.endDate === dateStr
  );
}

/**
 * Computes the suggested check-in time (HH:mm) for Quick Create on `dateStr`,
 * accounting for the 10-minute room turnover after an actual checkout on the same day.
 */
export function computeQuickCreateCheckInTime(
  dateStr: string,
  resourceBookings: TimelineBooking[]
): string {
  const sameDayCheckoutMinutes = resourceBookings
    .filter(
      (booking) =>
        booking.status === 'checked_out' &&
        booking.endDate === dateStr &&
        Boolean(booking.actualCheckOutAt)
    )
    .map((booking) => {
      const [hours, minutes] = (booking.checkOutTime || '12:00').split(':').map(Number);
      const safeHours = Number.isFinite(hours) ? hours : 12;
      const safeMinutes = Number.isFinite(minutes) ? minutes : 0;
      return safeHours * 60 + safeMinutes + 10;
    });

  const earliestCheckIn =
    sameDayCheckoutMinutes.length > 0 ? Math.max(...sameDayCheckoutMinutes) : 14 * 60;

  return `${String(Math.floor(earliestCheckIn / 60) % 24).padStart(2, '0')}:${String(
    earliestCheckIn % 60
  ).padStart(2, '0')}`;
}
