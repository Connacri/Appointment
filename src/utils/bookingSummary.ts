import { BookingStatus, TimelineBooking } from '../types/booking';

export type BookingValuableItem = NonNullable<TimelineBooking['valuablesAtReception']>[number];

export interface BookingModalSummary {
  roomName: string;
  status: BookingStatus;
  guestName: string;
  guestType: 'algerian' | 'foreigner';
  nationalityLabel: string;
  adults: number;
  children: number;
  totalOccupants: number;
  startDate: string;
  endDate: string;
  checkInTime: string;
  checkOutTime: string;
  actualCheckOutAt?: string;
  displayAmount: number;
  currency: string;
  paymentStatus: 'paid' | 'pending' | 'partial';
}

export interface GuestCheckoutPayload {
  endDate: string;
  checkOutTime: string;
  actualCheckOutAt: string;
  status: 'checked_out';
  turnoverReadyAt: string;
}

export function buildBookingModalSummary(
  booking: TimelineBooking,
  fallbackCurrency = 'DA',
  fallbackRoomName?: string
): BookingModalSummary {
  const adults = Math.max(1, Number(booking.adults) || 1);
  const children = Math.max(0, Number(booking.children) || 0);
  const isAlgerian =
    booking.guestType === 'algerian' ||
    (!booking.guestType && booking.nationality === 'Algérienne');
  const guestType: 'algerian' | 'foreigner' = isAlgerian ? 'algerian' : 'foreigner';

  const rawAmount = booking.originalCurrencyAmount ?? booking.totalPrice ?? 0;
  const displayAmount = Number.isFinite(Number(rawAmount)) ? Number(rawAmount) : 0;

  return {
    roomName: booking.resourceName?.trim() || fallbackRoomName?.trim() || '—',
    status: booking.status,
    guestName: booking.guestName?.trim() || '—',
    guestType,
    nationalityLabel: booking.nationality?.trim() || (isAlgerian ? 'Algérienne' : 'International'),
    adults,
    children,
    totalOccupants: adults + children,
    startDate: booking.startDate || '—',
    endDate: booking.endDate || '—',
    checkInTime: booking.checkInTime?.trim() || '14:00',
    checkOutTime: booking.checkOutTime?.trim() || '12:00',
    actualCheckOutAt: booking.actualCheckOutAt,
    displayAmount,
    currency: booking.paymentCurrency?.trim() || fallbackCurrency || 'DA',
    paymentStatus: booking.paymentStatus || 'pending',
  };
}

export function buildGuestCheckoutPayload(now: Date = new Date()): GuestCheckoutPayload {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = now.getHours();
  const minutes = now.getMinutes();

  const endDate = `${year}-${month}-${day}`;
  const checkOutTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  const totalMinutes = hours * 60 + minutes + 10;
  const readyHour = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
  const readyMinute = String(totalMinutes % 60).padStart(2, '0');

  return {
    endDate,
    checkOutTime,
    actualCheckOutAt: now.toISOString(),
    status: 'checked_out',
    turnoverReadyAt: `${readyHour}:${readyMinute}`,
  };
}

export function resolveHeldValuablesOnCheckout(
  valuables: BookingValuableItem[] | undefined,
  returnedById: Record<string, boolean>,
  returnedAtIso: string
): BookingValuableItem[] {
  if (!Array.isArray(valuables) || valuables.length === 0) return [];
  return valuables.map((item) => {
    if (item.status !== 'held') return item;
    const isReturned = Boolean(returnedById[item.id]);
    return isReturned
      ? { ...item, status: 'returned' as const, returnedAt: returnedAtIso }
      : { ...item, status: 'forgotten' as const };
  });
}
