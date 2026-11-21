import type { BookingOccupant, TimelineBooking } from '../types/booking';

export interface NormalizedBookingOccupant extends BookingOccupant {
  id: string;
  role: 'adult' | 'child';
  isAdult: boolean;
  isPrimary: boolean;
  fullName: string;
  phone: string;
  email: string;
  documentType: string;
  documentNumber: string;
  documentExpiryDate?: string;
  name: string;
  idDoc?: string;
}

export interface NormalizedOccupantsSummary {
  adultsCount: number;
  childrenCount: number;
  totalOccupants: number;
  adults: NormalizedBookingOccupant[];
  children: NormalizedBookingOccupant[];
  allOccupants: NormalizedBookingOccupant[];
}

function asStr(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function resolveDocumentType(raw: unknown, fallback = 'cni'): string {
  const s = asStr(raw).trim();
  return s || fallback;
}

function parseLegacyIdDoc(idDoc: unknown): { documentType: string; documentNumber: string } {
  const raw = asStr(idDoc).trim();
  if (!raw) return { documentType: 'cni', documentNumber: '' };
  const sep = raw.indexOf(':');
  if (sep > 0) {
    const prefix = raw.slice(0, sep).trim();
    const rest = raw.slice(sep + 1).trim();
    if (prefix && rest) {
      return { documentType: prefix.toLowerCase(), documentNumber: rest };
    }
  }
  return { documentType: 'cni', documentNumber: raw };
}

export function normalizeOccupantEntry(
  raw: Partial<BookingOccupant> | null | undefined,
  options: {
    index: number;
    role: 'adult' | 'child';
    isPrimary: boolean;
  }
): NormalizedBookingOccupant {
  const { index, role, isPrimary } = options;
  const legacyParsed = parseLegacyIdDoc(raw?.idDoc);

  const fullName = asStr(raw?.fullName).trim() || asStr(raw?.name).trim();
  const phone = asStr(raw?.phone).trim();
  const email = asStr(raw?.email).trim();
  const documentType = resolveDocumentType(raw?.documentType, legacyParsed.documentType);
  const documentNumber = asStr(raw?.documentNumber).trim() || legacyParsed.documentNumber;
  const documentExpiryDate = asStr(raw?.documentExpiryDate).trim() || undefined;
  const isAdult = role === 'adult';
  const id =
    asStr(raw?.id).trim() || `${role}-${index + 1}`;
  const idDoc = documentNumber
    ? `${documentType}:${documentNumber}`
    : asStr(raw?.idDoc).trim() || undefined;

  return {
    id,
    role,
    isAdult,
    isPrimary,
    fullName,
    phone,
    email,
    documentType,
    documentNumber,
    ...(documentExpiryDate ? { documentExpiryDate } : {}),
    name: fullName,
    ...(idDoc ? { idDoc } : {}),
  };
}

export function resolveBookingOccupancyCounts(
  booking: Partial<TimelineBooking>
): { adultsCount: number; childrenCount: number; totalOccupants: number } {
  const meta = (booking.customMetadata ?? {}) as Record<string, unknown>;
  const sector = booking.sector;

  const rawAdults =
    booking.adults ??
    (sector === 'resort' ? meta.resortOccupants : meta.hotelAdults) ??
    meta.hotelAdults ??
    meta.resortOccupants ??
    1;
  const rawChildren =
    booking.children ??
    (sector === 'resort' ? 0 : meta.hotelChildren) ??
    0;

  const parsedAdults = Math.max(1, Math.floor(Number(rawAdults) || 1));
  const parsedChildren = Math.max(0, Math.floor(Number(rawChildren) || 0));

  return {
    adultsCount: parsedAdults,
    childrenCount: parsedChildren,
    totalOccupants: parsedAdults + parsedChildren,
  };
}

/**
 * Produces a unified, synchronized representation of every adult and child
 * occupant on a booking:
 * - Slot 0 is always the primary guest (`guestName`, `guestPhone`, `guestEmail`,
 *   `idPieceType`, `idPieceNumber` / `identityNumber` / `passportNumber`).
 * - Remaining adults come from `adultGuests[1..]` merged with adult entries in `occupantsList`.
 * - Children come from child entries (`role === 'child' || isAdult === false`) in
 *   `occupantsList` or `adultGuests`.
 */
export function buildNormalizedOccupantList(
  booking: Partial<TimelineBooking>
): NormalizedOccupantsSummary {
  const { adultsCount, childrenCount } = resolveBookingOccupancyCounts(booking);

  const rawAdultsList = Array.isArray(booking.adultGuests) ? booking.adultGuests : [];
  const rawOccupantsList = Array.isArray(booking.occupantsList) ? booking.occupantsList : [];

  const occupantAdults: Array<Partial<BookingOccupant>> = [];
  const occupantChildren: Array<Partial<BookingOccupant>> = [];

  for (const entry of rawOccupantsList) {
    if (!entry || typeof entry !== 'object') continue;
    const isChild = entry.role === 'child' || entry.isAdult === false;
    if (isChild) {
      occupantChildren.push(entry);
    } else {
      occupantAdults.push(entry);
    }
  }

  const extraAdultEntries = rawAdultsList.filter(
    (entry) => entry && typeof entry === 'object' && entry.role !== 'child' && entry.isAdult !== false
  );
  const extraChildEntriesFromAdultGuests = rawAdultsList.filter(
    (entry) => entry && typeof entry === 'object' && (entry.role === 'child' || entry.isAdult === false)
  );

  const primaryDocType = resolveDocumentType(
    booking.idPieceType || (booking.identityType === 'passport' ? 'passport' : 'cni'),
    'cni'
  );
  const primaryDocNumber =
    asStr(booking.idPieceNumber).trim() ||
    asStr(booking.identityNumber).trim() ||
    asStr(booking.passportNumber).trim();
  const primaryExpiry = asStr(booking.idDocumentExpiryDate).trim() || undefined;

  const firstFromLists = extraAdultEntries[0] ?? occupantAdults[0] ?? {};
  const primaryAdult = normalizeOccupantEntry(
    {
      ...firstFromLists,
      fullName: asStr(booking.guestName).trim() || asStr(firstFromLists.fullName).trim() || asStr(firstFromLists.name).trim(),
      phone: asStr(booking.guestPhone).trim() || asStr(firstFromLists.phone).trim(),
      email: asStr(booking.guestEmail).trim() || asStr(firstFromLists.email).trim(),
      documentType: primaryDocNumber
        ? primaryDocType
        : resolveDocumentType(firstFromLists.documentType, primaryDocType),
      documentNumber: primaryDocNumber || asStr(firstFromLists.documentNumber).trim(),
      documentExpiryDate: primaryExpiry || asStr(firstFromLists.documentExpiryDate).trim() || undefined,
    },
    { index: 0, role: 'adult', isPrimary: true }
  );

  const adults: NormalizedBookingOccupant[] = [primaryAdult];
  for (let i = 1; i < adultsCount; i += 1) {
    const fromAdultGuests = extraAdultEntries[i];
    const fromOccupants = occupantAdults[i];
    const merged: Partial<BookingOccupant> = {
      ...(fromOccupants ?? {}),
      ...(fromAdultGuests ?? {}),
      fullName:
        asStr(fromAdultGuests?.fullName).trim() ||
        asStr(fromAdultGuests?.name).trim() ||
        asStr(fromOccupants?.fullName).trim() ||
        asStr(fromOccupants?.name).trim(),
      phone: asStr(fromAdultGuests?.phone).trim() || asStr(fromOccupants?.phone).trim(),
      email: asStr(fromAdultGuests?.email).trim() || asStr(fromOccupants?.email).trim(),
      documentType:
        asStr(fromAdultGuests?.documentType).trim() ||
        asStr(fromOccupants?.documentType).trim() ||
        'cni',
      documentNumber:
        asStr(fromAdultGuests?.documentNumber).trim() ||
        asStr(fromOccupants?.documentNumber).trim() ||
        parseLegacyIdDoc(fromAdultGuests?.idDoc ?? fromOccupants?.idDoc).documentNumber,
      documentExpiryDate:
        asStr(fromAdultGuests?.documentExpiryDate).trim() ||
        asStr(fromOccupants?.documentExpiryDate).trim() ||
        undefined,
    };
    adults.push(
      normalizeOccupantEntry(merged, { index: i, role: 'adult', isPrimary: false })
    );
  }

  const combinedChildren =
    occupantChildren.length > 0 ? occupantChildren : extraChildEntriesFromAdultGuests;
  const children: NormalizedBookingOccupant[] = [];
  for (let i = 0; i < childrenCount; i += 1) {
    children.push(
      normalizeOccupantEntry(combinedChildren[i], {
        index: adultsCount + i,
        role: 'child',
        isPrimary: false,
      })
    );
  }

  const allOccupants = [...adults, ...children];
  return {
    adultsCount,
    childrenCount,
    totalOccupants: allOccupants.length,
    adults,
    children,
    allOccupants,
  };
}

/**
 * Normalizes a booking payload in-memory so primary fields, `adults`, `children`,
 * `adultGuests`, `occupantsList` and domain occupancy metadata remain aligned across
 * UI, IndexedDB, Outbox and Supabase. Never invents contact or identity data.
 */
export function normalizeBookingForPersistence<T extends Partial<TimelineBooking>>(
  booking: T
): T {
  const summary = buildNormalizedOccupantList(booking);
  const primary = summary.adults[0];

  const existingMeta =
    booking.customMetadata && typeof booking.customMetadata === 'object'
      ? { ...booking.customMetadata }
      : undefined;

  if (existingMeta) {
    if (booking.sector === 'resort') {
      existingMeta.resortOccupants = summary.adultsCount;
    } else if (booking.sector === 'hotel') {
      existingMeta.hotelAdults = summary.adultsCount;
      existingMeta.hotelChildren = summary.childrenCount;
    }
  }

  return {
    ...booking,
    guestName: asStr(booking.guestName).trim() || primary?.fullName || '',
    guestPhone: asStr(booking.guestPhone).trim() || primary?.phone || '',
    guestEmail: asStr(booking.guestEmail).trim() || primary?.email || '',
    adults: summary.adultsCount,
    children: summary.childrenCount,
    adultGuests: summary.adults,
    occupantsList: summary.allOccupants,
    ...(existingMeta ? { customMetadata: existingMeta } : {}),
  };
}
