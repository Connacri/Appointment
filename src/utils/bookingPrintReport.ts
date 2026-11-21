import { DomainType, Language, ResourceGroup, ResourceItem, TimelineBooking } from '../types/booking';
import { buildNormalizedOccupantList } from './bookingOccupants';

export type BookingPrintScope = 'all' | 'arrivals' | 'departures';

export interface BookingPrintHit {
  booking: TimelineBooking;
  resource?: ResourceItem;
  buildingLabel: string;
  isArrivalInPeriod: boolean;
  isDepartureInPeriod: boolean;
}

export interface BookingPrintSummary {
  totalBookings: number;
  arrivalsCount: number;
  departuresCount: number;
  totalAdults: number;
  totalChildren: number;
  totalAmount: number;
}

export interface BookingPrintReportResult {
  fromDate: string;
  toDate: string;
  isValidRange: boolean;
  hits: BookingPrintHit[];
  summary: BookingPrintSummary;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_RE.test(value.trim());
}

export function resolveResourceBuildingLabel(
  resource: ResourceItem | undefined,
  resourceGroups: ResourceGroup[],
  language: Language
): string {
  const matchedGroup = resource
    ? resourceGroups.find(
        (group) =>
          (resource.groupId && group.id === resource.groupId) ||
          group.resources.some((item) => item.id === resource.id)
      )
    : undefined;

  const groupName = matchedGroup
    ? (matchedGroup.name[language] || matchedGroup.name.fr || matchedGroup.name.en || '').trim()
    : '';
  const rawBuilding = resource?.building?.trim() || '';

  if (groupName && rawBuilding) {
    if (groupName.toLowerCase().includes(rawBuilding.toLowerCase())) {
      return groupName;
    }
    return `${groupName} (${language === 'ar' ? `مبنى ${rawBuilding}` : language === 'en' ? `Bldg ${rawBuilding}` : `Bât. ${rawBuilding}`})`;
  }
  if (groupName) return groupName;
  if (rawBuilding) {
    return language === 'ar'
      ? `المبنى ${rawBuilding}`
      : language === 'en'
      ? `Building ${rawBuilding}`
      : `Bâtiment ${rawBuilding}`;
  }
  return '';
}

export function filterBookingsForPrintReport({
  bookings,
  resourceGroups,
  fromDate,
  toDate,
  scope = 'all',
  sector = 'all',
  buildingGroupId = 'all',
  includeCancelled = false,
  language = 'fr',
}: {
  bookings: TimelineBooking[];
  resourceGroups: ResourceGroup[];
  fromDate: string;
  toDate: string;
  scope?: BookingPrintScope;
  sector?: DomainType | 'all';
  buildingGroupId?: string | 'all';
  includeCancelled?: boolean;
  language?: Language;
}): BookingPrintReportResult {
  const cleanFrom = fromDate.trim();
  const cleanTo = toDate.trim();
  const isValidRange = isIsoDate(cleanFrom) && isIsoDate(cleanTo) && cleanFrom <= cleanTo;

  if (!isValidRange) {
    return {
      fromDate: cleanFrom,
      toDate: cleanTo,
      isValidRange: false,
      hits: [],
      summary: {
        totalBookings: 0,
        arrivalsCount: 0,
        departuresCount: 0,
        totalAdults: 0,
        totalChildren: 0,
        totalAmount: 0,
      },
    };
  }

  const resourceMap = new Map<string, { resource: ResourceItem; groupId: string }>();
  for (const group of resourceGroups) {
    for (const resource of group.resources) {
      resourceMap.set(resource.id, { resource, groupId: group.id });
    }
  }

  const hits: BookingPrintHit[] = [];

  for (const booking of bookings) {
    if (!includeCancelled && booking.status === 'cancelled') continue;
    if (sector !== 'all' && booking.sector !== sector) continue;

    const mapped = resourceMap.get(booking.resourceId);
    const resolvedGroupId = mapped?.resource.groupId || mapped?.groupId;
    if (buildingGroupId !== 'all' && resolvedGroupId !== buildingGroupId) {
      continue;
    }

    const start = isIsoDate(booking.startDate) ? booking.startDate.trim() : '';
    if (!start) continue;
    const rawEnd = isIsoDate(booking.endDate) ? booking.endDate.trim() : start;
    const end = rawEnd < start ? start : rawEnd;

    const isArrivalInPeriod = start >= cleanFrom && start <= cleanTo;
    const isDepartureInPeriod = end >= cleanFrom && end <= cleanTo;
    const overlapsPeriod = start <= cleanTo && end >= cleanFrom;

    let matchesScope = false;
    if (scope === 'arrivals') {
      matchesScope = isArrivalInPeriod;
    } else if (scope === 'departures') {
      matchesScope = isDepartureInPeriod;
    } else {
      matchesScope = overlapsPeriod;
    }

    if (!matchesScope) continue;

    hits.push({
      booking,
      resource: mapped?.resource,
      buildingLabel: resolveResourceBuildingLabel(mapped?.resource, resourceGroups, language),
      isArrivalInPeriod,
      isDepartureInPeriod,
    });
  }

  hits.sort((a, b) => {
    const dateDiff = (a.booking.startDate || '').localeCompare(b.booking.startDate || '');
    if (dateDiff !== 0) return dateDiff;
    const timeDiff = (a.booking.checkInTime || '14:00').localeCompare(
      b.booking.checkInTime || '14:00'
    );
    if (timeDiff !== 0) return timeDiff;
    return (a.booking.resourceName || '').localeCompare(b.booking.resourceName || '', language, {
      numeric: true,
      sensitivity: 'base',
    });
  });

  const summary = hits.reduce<BookingPrintSummary>(
    (acc, hit) => {
      acc.totalBookings += 1;
      if (hit.isArrivalInPeriod) acc.arrivalsCount += 1;
      if (hit.isDepartureInPeriod) acc.departuresCount += 1;
      acc.totalAdults += Number(hit.booking.adults) || 1;
      acc.totalChildren += Number(hit.booking.children) || 0;
      acc.totalAmount += Number(hit.booking.totalPrice) || 0;
      return acc;
    },
    {
      totalBookings: 0,
      arrivalsCount: 0,
      departuresCount: 0,
      totalAdults: 0,
      totalChildren: 0,
      totalAmount: 0,
    }
  );

  return {
    fromDate: cleanFrom,
    toDate: cleanTo,
    isValidRange: true,
    hits,
    summary,
  };
}

export type PoliceIdPieceType =
  | 'cni'
  | 'passport'
  | 'driving_license'
  | 'special_authorization'
  | 'diplomatic_passport'
  | 'special_passport'
  | 'official_document';

export type PolicePaymentMethodType =
  | 'cash_dzd'
  | 'cib'
  | 'edahabia'
  | 'cash_forex'
  | 'card_international'
  | 'bank_transfer';

export interface PoliceCompanionData {
  fullName: string;
  phone: string;
  email: string;
  documentType: string;
  documentNumber: string;
  documentExpiryDate?: string;
  role?: 'adult' | 'child';
  isPrimary?: boolean;
}

export interface PoliceSheetMappedFields {
  bookingId?: string;
  activeDomain: DomainType;
  currentResource?: ResourceItem;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  guestType: 'algerian' | 'foreigner';
  foreignNationality: string;
  idPieceType: PoliceIdPieceType;
  idPieceNumber: string;
  algerianIdType: 'cni' | 'nin';
  algerianIdNumber: string;
  passportNumber: string;
  idDocumentExpiryDate?: string;
  specialAuthorizationDesc?: string;
  wilayaOfOrigin: string;
  visaNumber?: string;
  visaExpiryDate?: string;
  entryDateInCountry?: string;
  startDate: string;
  endDate: string;
  checkInTime: string;
  checkOutTime: string;
  calculatedDays: number;
  hotelAdults: number;
  hotelChildren: number;
  resortOccupants: number;
  adultGuests: PoliceCompanionData[];
  occupants?: PoliceCompanionData[];
  paymentCurrency: string;
  currencySymbol: string;
  priceInPaymentCurrency: number;
  priceInDzd: number;
  paymentMethodType: PolicePaymentMethodType;
}

const RATES_FROM_EUR: Record<string, number> = {
  EUR: 1,
  DA: 145.5,
  DZD: 145.5,
  USD: 1.08,
  RMB: 7.74,
  GBP: 0.85,
  SAR: 4.05,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  DA: 'DA',
  DZD: 'DA',
  EUR: '€',
  USD: '$',
  RMB: '¥',
  GBP: '£',
  SAR: '﷼',
};

function computeStayDays(startDate: string, endDate: string): number {
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) return 1;
  const startMs = new Date(`${startDate}T00:00:00`).getTime();
  const endMs = new Date(`${endDate}T00:00:00`).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 1;
  return Math.max(1, Math.round((endMs - startMs) / 86400000));
}

export function buildPoliceSheetDataFromBooking({
  booking,
  resource,
  defaultCurrency = 'DA',
}: {
  booking: TimelineBooking;
  resource?: ResourceItem;
  defaultCurrency?: string;
}): PoliceSheetMappedFields {
  const normalizedNationality = (booking.nationality || '').trim();
  const isAlgerianNationality =
    normalizedNationality.toLowerCase() === 'algérienne' ||
    normalizedNationality.toLowerCase() === 'algerienne' ||
    normalizedNationality.toLowerCase() === 'algerian';

  const guestType: 'algerian' | 'foreigner' =
    booking.guestType === 'algerian' || booking.guestType === 'foreigner'
      ? booking.guestType
      : isAlgerianNationality || !normalizedNationality
      ? 'algerian'
      : 'foreigner';

  const idPieceType: PoliceIdPieceType =
    booking.idPieceType ||
    (booking.identityType === 'passport' || booking.passportNumber ? 'passport' : 'cni');

  const idPieceNumber =
    booking.idPieceNumber || booking.identityNumber || booking.passportNumber || '';
  const algerianIdType: 'cni' | 'nin' = booking.identityType === 'nin' ? 'nin' : 'cni';
  const algerianIdNumber = booking.identityNumber || booking.idPieceNumber || '';
  const passportNumber = booking.passportNumber || booking.idPieceNumber || '';

  const startDate = booking.startDate || '';
  const endDate = booking.endDate || startDate;
  const calculatedDays = computeStayDays(startDate, endDate);

  const adultsCount = Math.max(1, Number(booking.adults) || 1);
  const childrenCount = Math.max(0, Number(booking.children) || 0);

  const paymentCurrency = (booking.paymentCurrency || defaultCurrency || 'DA').trim() || 'DA';
  const currencySymbol = CURRENCY_SYMBOLS[paymentCurrency] || paymentCurrency;
  const currencyRate = RATES_FROM_EUR[paymentCurrency] || 1;
  const baseTotal = Number(booking.totalPrice) || 0;

  const priceInPaymentCurrency =
    typeof booking.originalCurrencyAmount === 'number' && Number.isFinite(booking.originalCurrencyAmount)
      ? Math.round(booking.originalCurrencyAmount)
      : Math.round(baseTotal * currencyRate);

  const priceInDzd =
    typeof booking.originalCurrencyAmount === 'number' &&
    typeof booking.currencyRateToDzd === 'number' &&
    Number.isFinite(booking.originalCurrencyAmount * booking.currencyRateToDzd)
      ? Math.round(booking.originalCurrencyAmount * booking.currencyRateToDzd)
      : Math.round(baseTotal * RATES_FROM_EUR.DA);

  const paymentMethodType: PolicePaymentMethodType =
    booking.paymentMethodType ||
    (paymentCurrency === 'DA' || paymentCurrency === 'DZD' ? 'cash_dzd' : 'cash_forex');

  const normalizedOccupants = buildNormalizedOccupantList(booking);

  return {
    bookingId: booking.id,
    activeDomain: booking.sector || 'hotel',
    currentResource:
      resource ||
      (booking.resourceName
        ? {
            id: booking.resourceId,
            name: booking.resourceName,
            type: 'Hébergement',
            sector: booking.sector || 'hotel',
            pricePerDay: 0,
          }
        : undefined),
    guestName: booking.guestName || '',
    guestPhone: booking.guestPhone || '',
    guestEmail: booking.guestEmail || '',
    guestType,
    foreignNationality:
      guestType === 'foreigner' ? normalizedNationality || 'Étrangère' : 'Algérienne',
    idPieceType,
    idPieceNumber,
    algerianIdType,
    algerianIdNumber,
    passportNumber,
    idDocumentExpiryDate: booking.idDocumentExpiryDate,
    specialAuthorizationDesc: booking.specialAuthorizationDesc,
    wilayaOfOrigin: booking.wilayaOfOrigin || booking.wilaya || '',
    visaNumber: booking.visaNumber,
    visaExpiryDate: booking.visaExpiryDate,
    entryDateInCountry: booking.entryDateInCountry,
    startDate,
    endDate,
    checkInTime: booking.checkInTime || '14:00',
    checkOutTime: booking.checkOutTime || '12:00',
    calculatedDays,
    hotelAdults: normalizedOccupants.adultsCount,
    hotelChildren: normalizedOccupants.childrenCount,
    resortOccupants: normalizedOccupants.adultsCount,
    adultGuests: normalizedOccupants.adults.map((guest) => ({
      fullName: guest.fullName,
      phone: guest.phone,
      email: guest.email,
      documentType: guest.documentType,
      documentNumber: guest.documentNumber,
      documentExpiryDate: guest.documentExpiryDate,
      role: guest.role,
      isPrimary: guest.isPrimary,
    })),
    occupants: normalizedOccupants.allOccupants.map((guest) => ({
      fullName: guest.fullName,
      phone: guest.phone,
      email: guest.email,
      documentType: guest.documentType,
      documentNumber: guest.documentNumber,
      documentExpiryDate: guest.documentExpiryDate,
      role: guest.role,
      isPrimary: guest.isPrimary,
    })),
    paymentCurrency,
    currencySymbol,
    priceInPaymentCurrency,
    priceInDzd,
    paymentMethodType,
  };
}

export function getPoliceSheetMissingFields(
  data: Pick<
    PoliceSheetMappedFields,
    'guestName' | 'idPieceNumber' | 'guestType' | 'algerianIdNumber' | 'passportNumber' | 'visaNumber'
  >,
  language: Language
): string[] {
  const effectiveDocNumber =
    data.idPieceNumber.trim() ||
    (data.guestType === 'algerian' ? data.algerianIdNumber.trim() : data.passportNumber.trim());

  const missing: string[] = [];
  if (!data.guestName.trim()) {
    missing.push(language === 'ar' ? 'اسم النزيل' : language === 'en' ? 'Guest name' : 'Nom du client');
  }
  if (!effectiveDocNumber) {
    missing.push(language === 'ar' ? 'رقم الوثيقة' : language === 'en' ? 'ID number' : 'N° de pièce');
  }
  if (data.guestType === 'foreigner' && !data.visaNumber?.trim()) {
    missing.push(language === 'ar' ? 'رقم التأشيرة' : language === 'en' ? 'Visa number' : 'N° visa');
  }
  return missing;
}

export function getPoliceSheetCompanionMissingFields(
  data: Pick<
    PoliceSheetMappedFields,
    'activeDomain' | 'hotelAdults' | 'hotelChildren' | 'resortOccupants' | 'adultGuests' | 'occupants'
  >,
  language: Language
): string[] {
  const expectedTotal =
    data.activeDomain === 'resort'
      ? Math.max(1, data.resortOccupants)
      : Math.max(1, data.hotelAdults) + Math.max(0, data.hotelChildren);
  if (expectedTotal <= 1) return [];

  const list =
    data.occupants && data.occupants.length > 0
      ? data.occupants
      : data.adultGuests;

  let incompleteCompanions = 0;
  for (let i = 1; i < expectedTotal; i += 1) {
    const companion = list[i];
    if (
      !companion ||
      !companion.fullName?.trim() ||
      !companion.phone?.trim() ||
      !companion.email?.trim() ||
      !companion.documentNumber?.trim()
    ) {
      incompleteCompanions += 1;
    }
  }

  if (incompleteCompanions === 0) return [];
  return [
    language === 'ar'
      ? `المرافقون (${incompleteCompanions})`
      : language === 'en'
      ? `Companions (${incompleteCompanions})`
      : `Accompagnants (${incompleteCompanions})`,
  ];
}

