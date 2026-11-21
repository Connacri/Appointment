import type { Language, TimelineBooking } from '../types/booking';
import { buildNormalizedOccupantList } from './bookingOccupants';

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isValidEmailAddress = (value: unknown): boolean =>
  typeof value === 'string' && EMAIL_RE.test(value.trim());

export const isValidPhoneNumber = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  return trimmed.length >= 6 && digits.length >= 6;
};

export type OccupantValidationField =
  | 'fullName'
  | 'phone'
  | 'email'
  | 'documentType'
  | 'documentNumber'
  | 'specialAuthorizationDesc';

export interface OccupantValidationError {
  personIndex: number;
  role: 'adult' | 'child';
  isPrimary: boolean;
  field: OccupantValidationField;
  message: string;
}

export interface OccupantValidationResult {
  valid: boolean;
  totalPeople: number;
  requiresAllOccupants: boolean;
  errors: OccupantValidationError[];
  summaryError?: string;
}

function personDisplayLabel(
  personIndex: number,
  role: 'adult' | 'child',
  isPrimary: boolean,
  language: Language
): string {
  if (isPrimary) {
    return language === 'ar'
      ? 'النزيل الرئيسي (الشخص 1)'
      : language === 'en'
      ? 'Primary guest (Person 1)'
      : 'Titulaire principal (Personne 1)';
  }
  if (role === 'child') {
    return language === 'ar'
      ? `الطفل (الشخص ${personIndex + 1})`
      : language === 'en'
      ? `Child (Person ${personIndex + 1})`
      : `Enfant (Personne ${personIndex + 1})`;
  }
  return language === 'ar'
    ? `البالغ (الشخص ${personIndex + 1})`
    : language === 'en'
    ? `Adult (Person ${personIndex + 1})`
    : `Adulte (Personne ${personIndex + 1})`;
}

/**
 * Enforces that when a reservation covers more than 1 person (`adults + children > 1`),
 * EVERY occupant (primary guest, every additional adult, and every child) has valid
 * full name, phone, email, and identity document details before saving locally or queuing
 * to the cloud Outbox.
 *
 * When a single-person reservation is submitted, only primary name presence and
 * optional contact syntax are checked (no fake coordinates are invented).
 */
export function validateBookingOccupants(
  booking: Partial<TimelineBooking>,
  language: Language = 'fr'
): OccupantValidationResult {
  const summary = buildNormalizedOccupantList(booking);
  const requiresAllOccupants = summary.totalOccupants > 1;
  const errors: OccupantValidationError[] = [];

  if (!requiresAllOccupants) {
    const primary = summary.allOccupants[0];
    if (!primary || primary.fullName.trim().length < 2) {
      errors.push({
        personIndex: 0,
        role: 'adult',
        isPrimary: true,
        field: 'fullName',
        message:
          language === 'ar'
            ? 'الاسم الكامل للنزيل مطلوب.'
            : language === 'en'
            ? 'Guest full name is required.'
            : 'Le nom complet du client est obligatoire.',
      });
    } else {
      if (primary.email && !isValidEmailAddress(primary.email)) {
        errors.push({
          personIndex: 0,
          role: 'adult',
          isPrimary: true,
          field: 'email',
          message:
            language === 'ar'
              ? 'صيغة البريد الإلكتروني غير صالحة.'
              : language === 'en'
              ? 'Invalid email address format.'
              : 'Le format de l’adresse e-mail est invalide.',
        });
      }
      if (primary.phone && !isValidPhoneNumber(primary.phone)) {
        errors.push({
          personIndex: 0,
          role: 'adult',
          isPrimary: true,
          field: 'phone',
          message:
            language === 'ar'
              ? 'رقم الهاتف غير صالح.'
              : language === 'en'
              ? 'Invalid phone number.'
              : 'Le numéro de téléphone est invalide.',
        });
      }
    }

    return {
      valid: errors.length === 0,
      totalPeople: summary.totalOccupants,
      requiresAllOccupants: false,
      errors,
      summaryError: errors[0]?.message,
    };
  }

  summary.allOccupants.forEach((person, index) => {
    const label = personDisplayLabel(index, person.role, person.isPrimary, language);

    if (person.fullName.trim().length < 2) {
      errors.push({
        personIndex: index,
        role: person.role,
        isPrimary: person.isPrimary,
        field: 'fullName',
        message:
          language === 'ar'
            ? `${label}: الاسم الكامل مطلوب.`
            : language === 'en'
            ? `${label}: full name is required.`
            : `${label} : le nom complet est obligatoire.`,
      });
    }

    if (!isValidPhoneNumber(person.phone)) {
      errors.push({
        personIndex: index,
        role: person.role,
        isPrimary: person.isPrimary,
        field: 'phone',
        message:
          language === 'ar'
            ? `${label}: رقم هاتف صالح مطلوب.`
            : language === 'en'
            ? `${label}: valid phone number is required.`
            : `${label} : un numéro de téléphone valide est obligatoire.`,
      });
    }

    if (!isValidEmailAddress(person.email)) {
      errors.push({
        personIndex: index,
        role: person.role,
        isPrimary: person.isPrimary,
        field: 'email',
        message:
          language === 'ar'
            ? `${label}: بريد إلكتروني صالح مطلوب.`
            : language === 'en'
            ? `${label}: valid email address is required.`
            : `${label} : une adresse e-mail valide est obligatoire.`,
      });
    }

    if (!person.documentType.trim()) {
      errors.push({
        personIndex: index,
        role: person.role,
        isPrimary: person.isPrimary,
        field: 'documentType',
        message:
          language === 'ar'
            ? `${label}: نوع الوثيقة مطلوب.`
            : language === 'en'
            ? `${label}: document type is required.`
            : `${label} : le type de pièce est obligatoire.`,
      });
    }

    if (person.documentNumber.trim().length < 2) {
      errors.push({
        personIndex: index,
        role: person.role,
        isPrimary: person.isPrimary,
        field: 'documentNumber',
        message:
          language === 'ar'
            ? `${label}: رقم وثيقة الهوية مطلوب.`
            : language === 'en'
            ? `${label}: identity document number is required.`
            : `${label} : le numéro de pièce d’identité est obligatoire.`,
      });
    }
  });

  if (
    booking.idPieceType === 'special_authorization' &&
    !(booking.specialAuthorizationDesc ?? '').trim()
  ) {
    errors.push({
      personIndex: 0,
      role: 'adult',
      isPrimary: true,
      field: 'specialAuthorizationDesc',
      message:
        language === 'ar'
          ? 'وصف الترخيص الخاص مطلوب.'
          : language === 'en'
          ? 'Special authorization description is required.'
          : 'Le descriptif de l’autorisation spéciale est obligatoire.',
    });
  }

  const firstMsg = errors[0]?.message;
  const summaryError =
    errors.length > 0
      ? language === 'ar'
        ? `حجز متعدد الأشخاص (${summary.totalOccupants}): يجب إكمال بيانات ووسائل تواصل جميع الأشخاص. ${firstMsg}`
        : language === 'en'
        ? `Multi-person booking (${summary.totalOccupants} guests): every person's details and contact info must be filled in. ${firstMsg}`
        : `Réservation multi-personnes (${summary.totalOccupants} personnes) : tous les détails et coordonnées de chaque personne doivent être renseignés. ${firstMsg}`
      : undefined;

  return {
    valid: errors.length === 0,
    totalPeople: summary.totalOccupants,
    requiresAllOccupants: true,
    errors,
    summaryError,
  };
}

