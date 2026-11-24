import type { OutboxRecord, TombstoneRecord } from '../../db/indexedDb';
import type { ResourceGroup, ResourceItem, TimelineBooking } from '../../types/booking';
import { normalizeBookingForPersistence } from '../../utils/bookingOccupants';

export interface RemoteBookingTombstone {
  entityId: string;
  establishmentId: string;
  version: number;
  deletedAt: string;
}

export interface MergeCloudStateParams {
  localGroups: ResourceGroup[];
  localBookings: TimelineBooking[];
  remoteGroups: ResourceGroup[];
  remoteBookings: TimelineBooking[];
  pendingOutbox: OutboxRecord[];
  tombstones: TombstoneRecord[];
  remoteBookingTombstones?: RemoteBookingTombstone[];
  demoGroupIds?: Set<string>;
  demoResourceIds?: Set<string>;
  demoBookingIds?: Set<string>;
}

export interface MergeCloudStateResult {
  groups: ResourceGroup[];
  bookings: TimelineBooking[];
  recoveredGroupsCount: number;
  recoveredBookingsCount: number;
}

/**
 * Merges remote Supabase data into local state without violating offline-first
 * invariants:
 * - Local tombstones prevent deleted records from resurrecting on pull.
 * - Pending local Outbox upserts take precedence over remote state until ACKed.
 * - Local-only records created offline are preserved.
 * - Demo/bootstrap IDs are never treated as recoverable cloud state.
 */
export function mergeCloudStateWithLocal({
  localGroups,
  localBookings,
  remoteGroups,
  remoteBookings,
  pendingOutbox,
  tombstones,
  remoteBookingTombstones = [],
  demoGroupIds = new Set(),
  demoResourceIds = new Set(),
  demoBookingIds = new Set(),
}: MergeCloudStateParams): MergeCloudStateResult {
  const pendingBookingUpserts = new Set(
    pendingOutbox
      .filter((record) => record.entity === 'booking' && record.operation === 'upsert')
      .map((record) => record.entityId),
  );

  const deletedBookingIds = new Set(
    tombstones
      .filter((t) => t.entity === 'booking')
      .map((t) => t.entityId),
  );
  // A local unsent edit is not silently discarded by a remote delete. Keep it
  // visible and pending so the caller can surface/resolve the concurrency case.
  for (const remoteTombstone of remoteBookingTombstones) {
    if (!pendingBookingUpserts.has(remoteTombstone.entityId)) {
      deletedBookingIds.add(remoteTombstone.entityId);
    }
  }
  const deletedResourceIds = new Set(
    tombstones
      .filter((t) => t.entity === 'resource')
      .map((t) => t.entityId),
  );
  const pendingResourceUpserts = new Set(
    pendingOutbox
      .filter((record) => record.entity === 'resource' && record.operation === 'upsert')
      .map((record) => record.entityId),
  );

  // 1. Merge resource groups and resources
  const localGroupMap = new Map<string, ResourceGroup>();
  for (const group of localGroups) {
    if (demoGroupIds.has(group.id)) continue;
    localGroupMap.set(group.id, {
      ...group,
      resources: group.resources.filter(
        (res) => !demoResourceIds.has(res.id) && !deletedResourceIds.has(res.id),
      ),
    });
  }

  let recoveredGroupsCount = 0;
  const mergedGroupMap = new Map<string, ResourceGroup>();

  for (const [id, group] of localGroupMap.entries()) {
    mergedGroupMap.set(id, { ...group, resources: [...group.resources] });
  }

  for (const remoteGroup of remoteGroups) {
    if (demoGroupIds.has(remoteGroup.id)) continue;
    const existingGroup = mergedGroupMap.get(remoteGroup.id);
    if (!existingGroup) {
      recoveredGroupsCount += 1;
    }

    const resourceById = new Map<string, ResourceItem>();
    for (const localRes of existingGroup?.resources ?? []) {
      resourceById.set(localRes.id, localRes);
    }

    for (const remoteRes of remoteGroup.resources) {
      if (demoResourceIds.has(remoteRes.id) || deletedResourceIds.has(remoteRes.id)) {
        continue;
      }
      if (pendingResourceUpserts.has(remoteRes.id) && resourceById.has(remoteRes.id)) {
        continue;
      }
      resourceById.set(remoteRes.id, { ...remoteRes, groupId: remoteGroup.id });
    }

    mergedGroupMap.set(remoteGroup.id, {
      ...(existingGroup ?? remoteGroup),
      name: remoteGroup.name ?? existingGroup?.name,
      sector: remoteGroup.sector ?? existingGroup?.sector,
      icon: remoteGroup.icon ?? existingGroup?.icon,
      resources: [...resourceById.values()],
    });
  }

  // 2. Merge bookings
  const bookingMap = new Map<string, TimelineBooking>();
  for (const localBooking of localBookings) {
    if (demoBookingIds.has(localBooking.id) || deletedBookingIds.has(localBooking.id)) {
      continue;
    }
    bookingMap.set(localBooking.id, normalizeBookingForPersistence(localBooking));
  }

  let recoveredBookingsCount = 0;
  for (const remoteBooking of remoteBookings) {
    if (demoBookingIds.has(remoteBooking.id) || deletedBookingIds.has(remoteBooking.id)) {
      continue;
    }
    if (pendingBookingUpserts.has(remoteBooking.id) && bookingMap.has(remoteBooking.id)) {
      continue;
    }
    if (!bookingMap.has(remoteBooking.id)) {
      recoveredBookingsCount += 1;
    }
    bookingMap.set(remoteBooking.id, normalizeBookingForPersistence(remoteBooking));
  }

  return {
    groups: [...mergedGroupMap.values()],
    bookings: [...bookingMap.values()],
    recoveredGroupsCount,
    recoveredBookingsCount,
  };
}
