import type { TimelineBooking } from '../types/booking';
import { normalizeBookingForPersistence } from '../utils/bookingOccupants';

export type StoredBookingRecord = TimelineBooking & {
  workspaceId?: string;
  establishmentId?: string;
  syncVersion?: number;
  deletedAt?: string | null;
};

/**
 * Non-destructive IndexedDB v6 -> v7 booking migration:
 * aligns `adults`, `children`, `adultGuests`, `occupantsList` and domain
 * occupancy counts while preserving all existing booking fields and
 * local Outbox/workspace sync metadata (`workspaceId`, `establishmentId`,
 * `syncVersion`, `deletedAt`).
 */
export function migrateBookingRecordV7<T extends Partial<StoredBookingRecord>>(record: T): T {
  if (!record || typeof record !== 'object') return record;
  return normalizeBookingForPersistence(record);
}
