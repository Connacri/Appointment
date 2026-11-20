import {
  BookingStatus,
  DomainType,
  ResourceGroup,
  ResourceItem,
  TimelineBooking,
} from '../types/booking';
import { normalizeSearchToken } from './timelineSearch';

export type BookingFinderStatus = 'all' | BookingStatus;
export type BookingFinderPayment = 'all' | 'paid' | 'pending' | 'partial';
export type BookingFinderPeriod = 'all' | 'current' | 'upcoming' | 'past';

export interface BookingFinderFilters {
  status: BookingFinderStatus;
  payment: BookingFinderPayment;
  period: BookingFinderPeriod;
  sector: DomainType | 'all';
}

export const DEFAULT_BOOKING_FINDER_FILTERS: BookingFinderFilters = {
  status: 'all',
  payment: 'all',
  period: 'all',
  sector: 'all',
};

export interface BookingFinderHit {
  booking: TimelineBooking;
  resource?: ResourceItem;
  groupLabel?: string;
}

/** Returns true when every character of `token` appears in order inside `word`. */
function isSubsequence(token: string, word: string): boolean {
  let index = 0;
  for (const char of word) {
    if (char === token[index]) index += 1;
    if (index === token.length) return true;
  }
  return false;
}

/** Adds the common local date notation so `18/11/2026` also finds `2026-11-18`. */
function dateVariants(isoDate?: string): string[] {
  if (!isoDate) return [];
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return [isoDate];
  const [, year, month, day] = match;
  return [isoDate, `${day}/${month}/${year}`, `${day}/${month}/${year.slice(2)}`];
}

/**
 * Builds the normalized haystack used by the elastic search. It deliberately
 * includes every guest identifier and every room attribute so a user can search
 * by any detail they remember (name, phone, ID, room, floor, building, view…).
 */
export function buildBookingSearchText(hit: BookingFinderHit): string {
  const booking = hit.booking;
  const resource = hit.resource;
  const parts: unknown[] = [
    booking.id,
    booking.resourceId,
    booking.resourceName,
    booking.guestName,
    booking.guestEmail,
    booking.guestPhone,
    // Digits-only variants bridge formatted phone numbers and identity numbers.
    booking.guestPhone?.replace(/\D/g, ''),
    booking.identityNumber,
    booking.identityNumber?.replace(/\D/g, ''),
    booking.nationality,
    booking.guestType,
    booking.idType,
    booking.identityType,
    booking.status,
    booking.paymentStatus,
    booking.originChannel,
    booking.mealPlan,
    booking.notes,
    booking.adults,
    booking.children,
    ...dateVariants(booking.startDate),
    ...dateVariants(booking.endDate),
    booking.checkInTime,
    booking.checkOutTime,
    hit.groupLabel,
    resource?.name,
    resource?.type,
    resource?.id,
    resource?.building,
    'étage',
    'floor',
    resource?.floor,
    'aile',
    'wing',
    resource?.wing,
    resource?.view,
    resource?.beds,
    resource?.sizeM2,
    resource?.housekeepingStatus,
    ...(resource?.amenities ?? []),
    ...(booking.adultGuests ?? []).flatMap((guest) => [
      guest.fullName,
      guest.phone,
      guest.phone?.replace(/\D/g, ''),
      guest.email,
      guest.documentType,
      guest.documentNumber,
      guest.documentNumber?.replace(/\D/g, ''),
    ]),
    ...(booking.extras ?? []).map((extra) => extra.label),
    ...(booking.guestAlerts ?? []).map((alert) => alert.text),
    ...(booking.valuablesAtReception ?? []).map((item) => item.description),
    ...(booking.forgottenItems ?? []).map((item) => item.description),
  ];

  return parts.map(normalizeSearchToken).filter(Boolean).join(' ');
}

/**
 * Token-based, diacritic-insensitive matching with a tolerant subsequence
 * fallback: every typed token must match some word of the haystack, so
 * "ali 101 2eme etage" narrows results instead of requiring an exact phrase.
 */
export function matchesElasticQuery(haystack: string, rawQuery: string): boolean {
  const tokens = normalizeSearchToken(rawQuery).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const words = haystack.split(/\s+/).filter(Boolean);

  return tokens.every((rawToken) => {
    const token = rawToken.startsWith('#') ? rawToken.slice(1) : rawToken;
    if (!token) return true;
    // A one- or two-digit token (floor "2", room "4") must match a whole word:
    // otherwise every date or phone number would match it and the query would
    // stop narrowing results.
    if (/^\d{1,2}$/.test(token)) return words.includes(token);
    return words.some(
      (word) => word.includes(token) || (token.length >= 3 && isSubsequence(token, word)),
    );
  });
}

function matchesPeriod(booking: TimelineBooking, period: BookingFinderPeriod, todayIso: string): boolean {
  if (period === 'all') return true;
  if (booking.status === 'cancelled') return false;
  if (period === 'current') return booking.startDate <= todayIso && booking.endDate >= todayIso;
  if (period === 'upcoming') return booking.startDate > todayIso;
  return booking.endDate < todayIso;
}

export function findBookings(params: {
  bookings: TimelineBooking[];
  resourceGroups: ResourceGroup[];
  query: string;
  filters?: BookingFinderFilters;
  todayIso?: string;
}): BookingFinderHit[] {
  const { bookings, resourceGroups, query } = params;
  const filters = params.filters ?? DEFAULT_BOOKING_FINDER_FILTERS;
  const todayIso = params.todayIso ?? new Date().toISOString().slice(0, 10);

  const resourceLookup = new Map<string, { resource: ResourceItem; groupLabel: string }>();
  for (const group of resourceGroups) {
    const groupLabel = Object.values(group.name ?? {}).filter(Boolean).join(' ');
    for (const resource of group.resources) {
      resourceLookup.set(resource.id, { resource, groupLabel });
    }
  }

  const hits: BookingFinderHit[] = [];
  for (const booking of bookings) {
    if (filters.sector !== 'all' && booking.sector !== filters.sector) continue;
    if (filters.status !== 'all' && booking.status !== filters.status) continue;
    if (filters.payment !== 'all' && booking.paymentStatus !== filters.payment) continue;
    if (!matchesPeriod(booking, filters.period, todayIso)) continue;

    const found = resourceLookup.get(booking.resourceId);
    const hit: BookingFinderHit = {
      booking,
      resource: found?.resource,
      groupLabel: found?.groupLabel,
    };
    if (matchesElasticQuery(buildBookingSearchText(hit), query)) hits.push(hit);
  }

  return hits.sort((a, b) => {
    const byDate = b.booking.startDate.localeCompare(a.booking.startDate);
    return byDate || a.booking.guestName.localeCompare(b.booking.guestName);
  });
}
