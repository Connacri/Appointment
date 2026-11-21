import type { TimelineBooking } from '../../types/booking';
import type { Database, Json } from './database.types';
import { normalizeBookingForPersistence } from '../../utils/bookingOccupants';

export type BookingRowInsert = Database['public']['Tables']['bookings']['Insert'];

/**
 * Narrow yet complete column projection for `public.bookings` reads.
 * Every column listed here is verified in `src/services/supabase/database.types.ts`.
 */
export const BOOKING_SELECT_COLUMNS =
  'id,resource_id,resource_name,domain,guest_name,guest_email,guest_phone,start_date,end_date,status,total_price,payment_status,currency,payments_summary,notes,adults,children,meal_plan,origin_channel,extras,occupants,guest_metadata,establishment_id,workspace_id,deleted_at,updated_at,version';

const PMS_METADATA_KEY = '_pms';

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, Json> {
  const clean: Record<string, Json> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = value as Json;
    }
  }
  return clean;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Lossless forward mapping from canonical `TimelineBooking` to Supabase `public.bookings` row.
 * Uses only existing verified PostgreSQL columns (`occupants`, `guest_metadata`, `currency`,
 * `payments_summary`, `extras`, scalar guest & stay columns) so local and remote schemas
 * remain 100% aligned.
 */
export function toSupabaseBookingRow(
  workspaceId: string,
  establishmentId: string,
  rawBooking: TimelineBooking,
  createdBy: string | null = null,
): BookingRowInsert {
  const b = normalizeBookingForPersistence(rawBooking);
  const baseCustomMeta = { ...(b.customMetadata ?? {}) };
  delete (baseCustomMeta as Record<string, unknown>)[PMS_METADATA_KEY];

  const pmsEnvelope = stripUndefined({
    color: b.color,
    checkInTime: b.checkInTime,
    checkOutTime: b.checkOutTime,
    actualCheckOutAt: b.actualCheckOutAt,
    guestType: b.guestType,
    nationality: b.nationality,
    idType: b.idType,
    identityType: b.identityType,
    identityNumber: b.identityNumber,
    idPieceType: b.idPieceType,
    idPieceNumber: b.idPieceNumber,
    specialAuthorizationDesc: b.specialAuthorizationDesc,
    wilaya: b.wilaya,
    wilayaOfOrigin: b.wilayaOfOrigin,
    passportNumber: b.passportNumber,
    visaNumber: b.visaNumber,
    idDocumentExpiryDate: b.idDocumentExpiryDate,
    visaExpiryDate: b.visaExpiryDate,
    entryDateInCountry: b.entryDateInCountry,
    mealPlanDietPreferences: b.mealPlanDietPreferences,
    valuablesAtReception: b.valuablesAtReception,
    forgottenItems: b.forgottenItems,
    guestAlerts: b.guestAlerts,
    lastModifiedAt: b.lastModifiedAt,
    lastModifiedBy: b.lastModifiedBy,
    modificationHistory: b.modificationHistory,
  });

  const guestMetadata: Record<string, Json> = {
    ...(baseCustomMeta as Record<string, Json>),
    ...(Object.keys(pmsEnvelope).length > 0 ? { [PMS_METADATA_KEY]: pmsEnvelope } : {}),
  };

  const currencyCode = (b.paymentCurrency || 'DA').trim() || 'DA';
  const paymentsSummary = stripUndefined({
    paymentCurrency: currencyCode,
    originalCurrencyAmount:
      typeof b.originalCurrencyAmount === 'number' && Number.isFinite(b.originalCurrencyAmount)
        ? b.originalCurrencyAmount
        : undefined,
    currencyRateToDzd:
      typeof b.currencyRateToDzd === 'number' && Number.isFinite(b.currencyRateToDzd)
        ? b.currencyRateToDzd
        : undefined,
    paymentMethodType: b.paymentMethodType,
    payments: b.payments ?? [],
  });

  return {
    id: b.id,
    workspace_id: workspaceId,
    establishment_id: establishmentId,
    resource_id: b.resourceId,
    domain: b.sector,
    resource_name: b.resourceName,
    guest_name: b.guestName,
    guest_email: b.guestEmail?.trim() ? b.guestEmail.trim() : null,
    guest_phone: b.guestPhone?.trim() ? b.guestPhone.trim() : null,
    start_date: b.startDate,
    end_date: b.endDate,
    status: b.status,
    total_price: b.totalPrice,
    payment_status: b.paymentStatus,
    currency: currencyCode,
    payments_summary: paymentsSummary,
    adults: b.adults ?? 1,
    children: b.children ?? 0,
    notes: b.notes ?? null,
    meal_plan: b.mealPlan ?? null,
    origin_channel: b.originChannel ?? null,
    extras: (b.extras ?? []) as unknown as Json,
    occupants: (b.occupantsList ?? []) as unknown as Json,
    guest_metadata: guestMetadata,
    created_by: createdBy,
  };
}

/**
 * Lossless reverse mapping from Supabase `public.bookings` row to canonical `TimelineBooking`.
 * Preserves domain `customMetadata` separately from internal `_pms` fields and normalizes
 * both `adultGuests` and `occupantsList` from `r.occupants`.
 */
export function fromSupabaseBookingRow(r: Record<string, any>): TimelineBooking {
  const rawMeta = asRecord(r.guest_metadata);
  const pms = asRecord(rawMeta[PMS_METADATA_KEY]);
  const customMetadata: Record<string, any> = {};
  for (const [key, value] of Object.entries(rawMeta)) {
    if (key !== PMS_METADATA_KEY) {
      customMetadata[key] = value;
    }
  }

  const paymentsSummary = asRecord(r.payments_summary);
  const rawOccupants = Array.isArray(r.occupants) ? r.occupants : [];
  const hydratedBooking: TimelineBooking = {
    id: r.id,
    resourceId: r.resource_id,
    resourceName: r.resource_name,
    sector: r.domain,
    guestName: r.guest_name ?? '',
    guestEmail: r.guest_email ?? '',
    guestPhone: r.guest_phone ?? '',
    startDate: r.start_date,
    endDate: r.end_date,
    checkInTime: asString(pms.checkInTime),
    checkOutTime: asString(pms.checkOutTime),
    actualCheckOutAt: asString(pms.actualCheckOutAt),
    status: r.status,
    totalPrice: Number(r.total_price ?? 0),
    paymentStatus: r.payment_status,
    notes: r.notes ?? undefined,
    color: asString(pms.color),
    mealPlan: (r.meal_plan ?? undefined) as TimelineBooking['mealPlan'],
    originChannel: (r.origin_channel ?? undefined) as TimelineBooking['originChannel'],
    adults: typeof r.adults === 'number' ? r.adults : Number(r.adults ?? 1),
    children: typeof r.children === 'number' ? r.children : Number(r.children ?? 0),
    extras: Array.isArray(r.extras) ? r.extras : [],
    payments: Array.isArray(paymentsSummary.payments)
      ? (paymentsSummary.payments as TimelineBooking['payments'])
      : undefined,
    paymentCurrency:
      asString(paymentsSummary.paymentCurrency) || asString(r.currency) || undefined,
    originalCurrencyAmount:
      typeof paymentsSummary.originalCurrencyAmount === 'number'
        ? paymentsSummary.originalCurrencyAmount
        : undefined,
    currencyRateToDzd:
      typeof paymentsSummary.currencyRateToDzd === 'number'
        ? paymentsSummary.currencyRateToDzd
        : undefined,
    paymentMethodType: asString(
      paymentsSummary.paymentMethodType
    ) as TimelineBooking['paymentMethodType'],
    guestType: asString(pms.guestType) as TimelineBooking['guestType'],
    nationality: asString(pms.nationality),
    idType: asString(pms.idType) as TimelineBooking['idType'],
    identityType: asString(pms.identityType) as TimelineBooking['identityType'],
    identityNumber: asString(pms.identityNumber),
    idPieceType: asString(pms.idPieceType) as TimelineBooking['idPieceType'],
    idPieceNumber: asString(pms.idPieceNumber),
    specialAuthorizationDesc: asString(pms.specialAuthorizationDesc),
    wilaya: asString(pms.wilaya),
    wilayaOfOrigin: asString(pms.wilayaOfOrigin),
    passportNumber: asString(pms.passportNumber),
    visaNumber: asString(pms.visaNumber),
    idDocumentExpiryDate: asString(pms.idDocumentExpiryDate),
    visaExpiryDate: asString(pms.visaExpiryDate),
    entryDateInCountry: asString(pms.entryDateInCountry),
    mealPlanDietPreferences: Array.isArray(pms.mealPlanDietPreferences)
      ? (pms.mealPlanDietPreferences as string[])
      : undefined,
    valuablesAtReception: Array.isArray(pms.valuablesAtReception)
      ? (pms.valuablesAtReception as TimelineBooking['valuablesAtReception'])
      : undefined,
    forgottenItems: Array.isArray(pms.forgottenItems)
      ? (pms.forgottenItems as TimelineBooking['forgottenItems'])
      : undefined,
    guestAlerts: Array.isArray(pms.guestAlerts)
      ? (pms.guestAlerts as TimelineBooking['guestAlerts'])
      : undefined,
    lastModifiedAt: asString(pms.lastModifiedAt) ?? asString(r.updated_at),
    lastModifiedBy: asString(pms.lastModifiedBy),
    modificationHistory: Array.isArray(pms.modificationHistory)
      ? (pms.modificationHistory as TimelineBooking['modificationHistory'])
      : undefined,
    occupantsList: rawOccupants,
    customMetadata,
  };

  return normalizeBookingForPersistence(hydratedBooking);
}
