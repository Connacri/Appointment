import type { OutboxEntity, OutboxRecord, OutboxSummary, TombstoneRecord } from '../../db/indexedDb';
import type {
  HotelEstablishment,
  PmsTask,
  ResourceGroup,
  ResourceItem,
  StockItem,
  TimelineBooking,
} from '../../types/booking';
import type { EstablishmentProfile } from '../../types/establishment';
import { mergeCloudStateWithLocal } from './cloudRecovery';

export type CloudSyncPhase =
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'pending'
  | 'offline'
  | 'unauthenticated'
  | 'no_workspace'
  | 'unconfigured'
  | 'error';

export interface CloudSyncStatus {
  phase: CloudSyncPhase;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncedAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  lastPushCount: number;
  lastPullCount: number;
  workspaceId: string;
}

export interface PulledSupabaseSnapshot {
  establishments: HotelEstablishment[];
  groups: ResourceGroup[];
  bookings: TimelineBooking[];
  tasks: PmsTask[];
  stockItems: StockItem[];
  dynamicRates: Record<string, Record<string, number>>;
}

export interface SupabaseSyncAdapter {
  hasSession: () => Promise<boolean>;
  getPendingOutbox: (
    workspaceId: string,
    limit: number,
    includeFutureRetries: boolean,
  ) => Promise<OutboxRecord[]>;
  getOutboxSummary: (workspaceId: string) => Promise<OutboxSummary>;
  getTombstones: (workspaceId: string) => Promise<TombstoneRecord[]>;
  markOutboxSynced: (id: string) => Promise<void>;
  markOutboxFailed: (id: string, error: string, nextAttemptAt: string) => Promise<void>;
  pushBookingUpsert: (
    workspaceId: string,
    establishmentId: string,
    booking: TimelineBooking,
  ) => Promise<void>;
  pushBookingDelete: (workspaceId: string, bookingId: string) => Promise<void>;
  pushResourceUpsert?: (
    workspaceId: string,
    establishmentId: string,
    resource: ResourceItem,
  ) => Promise<void>;
  pushResourceDelete?: (workspaceId: string, resourceId: string) => Promise<void>;
  pushTaskUpsert?: (workspaceId: string, establishmentId: string, task: PmsTask) => Promise<void>;
  pushStockItemUpsert?: (
    workspaceId: string,
    establishmentId: string,
    item: StockItem,
  ) => Promise<void>;
  pullRemoteState: (workspaceId: string) => Promise<PulledSupabaseSnapshot>;
}

export interface RunSupabaseSyncParams {
  force?: boolean;
  isOffline: boolean;
  isConfigured: boolean;
  workspaceId: string;
  selectedEstablishmentId: string | 'all';
  localGroups: ResourceGroup[];
  localBookings: TimelineBooking[];
  previousStatus?: CloudSyncStatus;
  demoGroupIds?: Set<string>;
  demoResourceIds?: Set<string>;
  demoBookingIds?: Set<string>;
  adapter: SupabaseSyncAdapter;
  now?: () => Date;
}

export interface RunSupabaseSyncResult {
  status: CloudSyncStatus;
  pushedCount: number;
  pushFailedCount: number;
  recoveredGroupsCount: number;
  recoveredBookingsCount: number;
  recoveredTasksCount: number;
  recoveredStockCount: number;
  mergedGroups: ResourceGroup[] | null;
  mergedBookings: TimelineBooking[] | null;
  remoteEstablishments: HotelEstablishment[] | null;
  remoteTasks: PmsTask[];
  remoteStockItems: StockItem[];
  remoteDynamicRates: Record<string, Record<string, number>>;
  recoveredProfile: Partial<EstablishmentProfile> | null;
  warnings: string[];
  skippedReason?: 'offline' | 'unconfigured' | 'unauthenticated' | 'no_workspace';
}

export const INITIAL_CLOUD_SYNC_STATUS: CloudSyncStatus = {
  phase: 'idle',
  isSyncing: false,
  pendingCount: 0,
  failedCount: 0,
  lastSyncedAt: null,
  lastAttemptAt: null,
  lastError: null,
  lastPushCount: 0,
  lastPullCount: 0,
  workspaceId: '',
};

const ENTITY_PUSH_PRIORITY: Record<OutboxEntity, number> = {
  establishment: 0,
  resource: 1,
  booking: 2,
  task: 3,
  stock_item: 4,
  invoice: 5,
};

export function computeBackoffIso(attempts: number, nowMs = Date.now()): string {
  const boundedAttempts = Math.max(0, Math.min(attempts, 6));
  const delayMs = Math.min(300_000, 5_000 * 2 ** boundedAttempts);
  return new Date(nowMs + delayMs).toISOString();
}

export function deriveIdleSyncPhase(params: {
  isOffline: boolean;
  isConfigured: boolean;
  isAuthenticated: boolean;
  workspaceId: string;
  summary: OutboxSummary;
  lastSyncedAt: string | null;
  lastError: string | null;
}): CloudSyncPhase {
  if (params.isOffline) return 'offline';
  if (!params.isConfigured) return 'unconfigured';
  if (!params.isAuthenticated) return 'unauthenticated';
  if (!params.workspaceId.trim()) return 'no_workspace';
  if (params.summary.failedCount > 0 || params.lastError) return 'error';
  if (params.summary.pendingCount > 0) return 'pending';
  if (params.lastSyncedAt) return 'synced';
  return 'idle';
}

function sortOutboxForPush(records: OutboxRecord[]): OutboxRecord[] {
  return [...records].sort((a, b) => {
    const pA = ENTITY_PUSH_PRIORITY[a.entity] ?? 99;
    const pB = ENTITY_PUSH_PRIORITY[b.entity] ?? 99;
    if (pA !== pB) return pA - pB;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function resolveEstablishmentId(params: {
  record: OutboxRecord;
  selectedEstablishmentId: string | 'all';
  localGroups: ResourceGroup[];
  remoteGroups: ResourceGroup[];
  remoteEstablishments: HotelEstablishment[];
}): string | undefined {
  const explicit = params.record.establishmentId?.trim();
  if (explicit && explicit !== 'all') return explicit;

  const payloadEstId =
    typeof params.record.payload?.establishmentId === 'string'
      ? params.record.payload.establishmentId.trim()
      : '';
  if (payloadEstId && payloadEstId !== 'all') return payloadEstId;

  const targetResourceId =
    params.record.entity === 'resource'
      ? params.record.entityId
      : typeof params.record.payload?.resourceId === 'string'
        ? params.record.payload.resourceId
        : '';

  if (targetResourceId) {
    for (const group of [...params.remoteGroups, ...params.localGroups]) {
      const found = group.resources.find((r) => r.id === targetResourceId);
      if (found?.establishmentId && found.establishmentId !== 'all') {
        return found.establishmentId;
      }
    }
  }

  if (params.selectedEstablishmentId && params.selectedEstablishmentId !== 'all') {
    return params.selectedEstablishmentId;
  }

  // Only unambiguous single-establishment fallback when remote workspace owns exactly 1 establishment
  // and local data does not hold multiple distinct physical buildings without establishment IDs.
  if (params.remoteEstablishments.length === 1 && params.localGroups.length <= 1) {
    return params.remoteEstablishments[0].id;
  }

  return undefined;
}

/**
 * Bidirectional offline-first Supabase sync runner:
 * 1. Validates connectivity, Supabase configuration, session, and workspace isolation.
 * 2. Pushes pending Outbox mutations in causal order (`resource` before `booking`).
 *    Only a verified server ACK removes a record from Outbox (`markOutboxSynced`).
 *    Transient/permanent push errors keep the record pending via `markOutboxFailed`.
 * 3. Pulls latest Supabase workspace data and merges safely without overwriting
 *    any remaining pending Outbox upserts or resurrecting local tombstones.
 * 4. Computes an evidence-based sync status that never claims `synced` while
 *    any Outbox item remains pending or failed.
 */
export async function runSupabaseSync({
  force = false,
  isOffline,
  isConfigured,
  workspaceId,
  selectedEstablishmentId,
  localGroups,
  localBookings,
  previousStatus = INITIAL_CLOUD_SYNC_STATUS,
  demoGroupIds = new Set(),
  demoResourceIds = new Set(),
  demoBookingIds = new Set(),
  adapter,
  now = () => new Date(),
}: RunSupabaseSyncParams): Promise<RunSupabaseSyncResult> {
  const attemptAt = now().toISOString();
  const baseEmpty: Omit<RunSupabaseSyncResult, 'status' | 'warnings' | 'skippedReason'> = {
    pushedCount: 0,
    pushFailedCount: 0,
    recoveredGroupsCount: 0,
    recoveredBookingsCount: 0,
    recoveredTasksCount: 0,
    recoveredStockCount: 0,
    mergedGroups: null,
    mergedBookings: null,
    remoteEstablishments: null,
    remoteTasks: [],
    remoteStockItems: [],
    remoteDynamicRates: {},
    recoveredProfile: null,
  };

  const readSafeSummary = async (): Promise<OutboxSummary> => {
    if (!workspaceId.trim()) return { pendingCount: 0, failedCount: 0, dueCount: 0 };
    try {
      return await adapter.getOutboxSummary(workspaceId);
    } catch {
      return { pendingCount: 0, failedCount: 0, dueCount: 0 };
    }
  };

  if (isOffline) {
    const summary = await readSafeSummary();
    return {
      ...baseEmpty,
      warnings: [],
      skippedReason: 'offline',
      status: {
        ...previousStatus,
        phase: 'offline',
        isSyncing: false,
        pendingCount: summary.pendingCount,
        failedCount: summary.failedCount,
        lastAttemptAt: attemptAt,
        workspaceId,
      },
    };
  }

  if (!isConfigured) {
    return {
      ...baseEmpty,
      warnings: [],
      skippedReason: 'unconfigured',
      status: {
        ...previousStatus,
        phase: 'unconfigured',
        isSyncing: false,
        pendingCount: 0,
        failedCount: 0,
        lastAttemptAt: attemptAt,
        workspaceId,
      },
    };
  }

  let hasSession = false;
  try {
    hasSession = await adapter.hasSession();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur session Supabase';
    const summary = await readSafeSummary();
    return {
      ...baseEmpty,
      warnings: [msg],
      status: {
        ...previousStatus,
        phase: 'error',
        isSyncing: false,
        pendingCount: summary.pendingCount,
        failedCount: summary.failedCount,
        lastAttemptAt: attemptAt,
        lastError: msg,
        workspaceId,
      },
    };
  }

  if (!hasSession) {
    const summary = await readSafeSummary();
    return {
      ...baseEmpty,
      warnings: [],
      skippedReason: 'unauthenticated',
      status: {
        ...previousStatus,
        phase: 'unauthenticated',
        isSyncing: false,
        pendingCount: summary.pendingCount,
        failedCount: summary.failedCount,
        lastAttemptAt: attemptAt,
        workspaceId,
      },
    };
  }

  if (!workspaceId.trim()) {
    return {
      ...baseEmpty,
      warnings: [],
      skippedReason: 'no_workspace',
      status: {
        ...previousStatus,
        phase: 'no_workspace',
        isSyncing: false,
        pendingCount: 0,
        failedCount: 0,
        lastAttemptAt: attemptAt,
        workspaceId: '',
      },
    };
  }

  const warnings: string[] = [];
  let pushedCount = 0;
  let pushFailedCount = 0;
  let firstPushError: string | null = null;
  let prefetchedRemote: PulledSupabaseSnapshot | null = null;

  // Step 1: Push pending Outbox events
  let dueRecords: OutboxRecord[] = [];
  try {
    dueRecords = sortOutboxForPush(await adapter.getPendingOutbox(workspaceId, 200, force));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lecture Outbox impossible';
    warnings.push(msg);
    firstPushError = msg;
  }

  if (dueRecords.length > 0) {
    // If any upsert lacks an explicit establishmentId locally, fetch remote establishments/resources
    // once (read-only) to look up its authoritative remote owner without guessing.
    const needsEstablishmentLookup = dueRecords.some(
      (record) =>
        record.operation === 'upsert' &&
        !resolveEstablishmentId({
          record,
          selectedEstablishmentId,
          localGroups,
          remoteGroups: [],
          remoteEstablishments: [],
        }),
    );

    if (needsEstablishmentLookup) {
      try {
        prefetchedRemote = await adapter.pullRemoteState(workspaceId);
      } catch (err) {
        warnings.push(
          `Résolution établissement impossible avant push : ${err instanceof Error ? err.message : 'erreur réseau'}`,
        );
      }
    }

    for (const record of dueRecords) {
      const isDemoBooking = record.entity === 'booking' && demoBookingIds.has(record.entityId);
      const isDemoResource = record.entity === 'resource' && demoResourceIds.has(record.entityId);
      if (isDemoBooking || isDemoResource) {
        await adapter.markOutboxSynced(record.id);
        continue;
      }

      try {
        if (record.entity === 'booking') {
          if (record.operation === 'delete') {
            await adapter.pushBookingDelete(workspaceId, record.entityId);
            await adapter.markOutboxSynced(record.id);
            pushedCount += 1;
            continue;
          }
          const payload = record.payload as unknown as TimelineBooking | null;
          if (!payload || typeof payload.id !== 'string' || typeof payload.resourceId !== 'string') {
            throw new Error(`Payload réservation invalide dans Outbox (${record.entityId}).`);
          }
          const establishmentId = resolveEstablishmentId({
            record,
            selectedEstablishmentId,
            localGroups,
            remoteGroups: prefetchedRemote?.groups ?? [],
            remoteEstablishments: prefetchedRemote?.establishments ?? [],
          });
          if (!establishmentId) {
            throw new Error(
              'Établissement réel introuvable pour synchroniser cette réservation. Sélectionnez un établissement dans Supabase.',
            );
          }
          await adapter.pushBookingUpsert(workspaceId, establishmentId, payload);
          await adapter.markOutboxSynced(record.id);
          pushedCount += 1;
        } else if (record.entity === 'resource') {
          if (record.operation === 'delete') {
            if (!adapter.pushResourceDelete) {
              throw new Error('Suppression de ressource cloud non configurée.');
            }
            await adapter.pushResourceDelete(workspaceId, record.entityId);
            await adapter.markOutboxSynced(record.id);
            pushedCount += 1;
            continue;
          }
          if (!adapter.pushResourceUpsert) {
            throw new Error('Synchronisation de ressource cloud non configurée.');
          }
          const payload = record.payload as unknown as ResourceItem | null;
          if (!payload || typeof payload.id !== 'string') {
            throw new Error(`Payload ressource invalide dans Outbox (${record.entityId}).`);
          }
          const establishmentId = resolveEstablishmentId({
            record,
            selectedEstablishmentId,
            localGroups,
            remoteGroups: prefetchedRemote?.groups ?? [],
            remoteEstablishments: prefetchedRemote?.establishments ?? [],
          });
          if (!establishmentId) {
            throw new Error(
              'Établissement réel introuvable pour synchroniser cette ressource.',
            );
          }
          await adapter.pushResourceUpsert(workspaceId, establishmentId, payload);
          await adapter.markOutboxSynced(record.id);
          pushedCount += 1;
        } else if (record.entity === 'task' && record.operation === 'upsert' && adapter.pushTaskUpsert) {
          const payload = record.payload as unknown as PmsTask | null;
          const establishmentId = resolveEstablishmentId({
            record,
            selectedEstablishmentId,
            localGroups,
            remoteGroups: prefetchedRemote?.groups ?? [],
            remoteEstablishments: prefetchedRemote?.establishments ?? [],
          });
          if (!payload || !establishmentId) {
            throw new Error('Tâche ou établissement cible manquant pour la synchronisation.');
          }
          await adapter.pushTaskUpsert(workspaceId, establishmentId, payload);
          await adapter.markOutboxSynced(record.id);
          pushedCount += 1;
        } else if (
          record.entity === 'stock_item' &&
          record.operation === 'upsert' &&
          adapter.pushStockItemUpsert
        ) {
          const payload = record.payload as unknown as StockItem | null;
          const establishmentId = resolveEstablishmentId({
            record,
            selectedEstablishmentId,
            localGroups,
            remoteGroups: prefetchedRemote?.groups ?? [],
            remoteEstablishments: prefetchedRemote?.establishments ?? [],
          });
          if (!payload || !establishmentId) {
            throw new Error('Article de stock ou établissement cible manquant pour la synchronisation.');
          }
          await adapter.pushStockItemUpsert(workspaceId, establishmentId, payload);
          await adapter.markOutboxSynced(record.id);
          pushedCount += 1;
        } else {
          throw new Error(`Type d’opération Outbox non pris en charge : ${record.entity}/${record.operation}`);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Échec d’envoi vers Supabase';
        pushFailedCount += 1;
        if (!firstPushError) firstPushError = errMsg;
        warnings.push(`Push ${record.entity}/${record.entityId} : ${errMsg}`);
        const nextAttempt = computeBackoffIso(record.attempts, now().getTime());
        await adapter.markOutboxFailed(record.id, errMsg, nextAttempt).catch(() => undefined);
      }
    }
  }

  // Step 2: Pull latest remote Supabase snapshot & merge safely
  let pullError: string | null = null;
  let pulledSnapshot: PulledSupabaseSnapshot | null = null;
  try {
    pulledSnapshot = await adapter.pullRemoteState(workspaceId);
  } catch (err) {
    pullError = err instanceof Error ? err.message : 'Échec de récupération Supabase';
    warnings.push(`Pull Supabase : ${pullError}`);
  }

  let recoveredGroupsCount = 0;
  let recoveredBookingsCount = 0;
  let mergedGroups: ResourceGroup[] | null = null;
  let mergedBookings: TimelineBooking[] | null = null;
  let recoveredProfile: Partial<EstablishmentProfile> | null = null;

  if (pulledSnapshot) {
    const [remainingPending, tombstones] = await Promise.all([
      adapter.getPendingOutbox(workspaceId, 500, true).catch(() => []),
      adapter.getTombstones(workspaceId).catch(() => []),
    ]);

    const merged = mergeCloudStateWithLocal({
      localGroups,
      localBookings,
      remoteGroups: pulledSnapshot.groups,
      remoteBookings: pulledSnapshot.bookings,
      pendingOutbox: remainingPending,
      tombstones,
      demoGroupIds,
      demoResourceIds,
      demoBookingIds,
    });

    recoveredGroupsCount = merged.recoveredGroupsCount;
    recoveredBookingsCount = merged.recoveredBookingsCount;
    mergedGroups = merged.groups;
    mergedBookings = merged.bookings;

    if (pulledSnapshot.establishments.length > 0) {
      const firstEst = pulledSnapshot.establishments[0];
      if (firstEst.name) {
        recoveredProfile = {
          name: firstEst.name,
          city: firstEst.city || undefined,
          stars: firstEst.stars,
          checkInTime: firstEst.checkInTime,
          checkOutTime: firstEst.checkOutTime,
        };
      }
    }
  }

  // Step 3: Compute evidence-based sync status after push + pull
  const finalSummary = await readSafeSummary();
  const pullCount = pulledSnapshot
    ? recoveredGroupsCount +
      recoveredBookingsCount +
      pulledSnapshot.tasks.length +
      pulledSnapshot.stockItems.length
    : 0;

  const combinedError = firstPushError || pullError || finalSummary.lastError || null;
  const fullyVerifiedSynced =
    !combinedError &&
    Boolean(pulledSnapshot) &&
    finalSummary.pendingCount === 0 &&
    finalSummary.failedCount === 0;

  const phase: CloudSyncPhase = fullyVerifiedSynced
    ? 'synced'
    : combinedError
      ? 'error'
      : finalSummary.pendingCount > 0
        ? 'pending'
        : previousStatus.lastSyncedAt
          ? 'synced'
          : 'idle';

  const status: CloudSyncStatus = {
    phase,
    isSyncing: false,
    pendingCount: finalSummary.pendingCount,
    failedCount: finalSummary.failedCount,
    lastSyncedAt: fullyVerifiedSynced ? now().toISOString() : previousStatus.lastSyncedAt,
    lastAttemptAt: attemptAt,
    lastError: fullyVerifiedSynced ? null : combinedError,
    lastPushCount: pushedCount,
    lastPullCount: pullCount,
    workspaceId,
  };

  return {
    status,
    pushedCount,
    pushFailedCount,
    recoveredGroupsCount,
    recoveredBookingsCount,
    recoveredTasksCount: pulledSnapshot?.tasks.length ?? 0,
    recoveredStockCount: pulledSnapshot?.stockItems.length ?? 0,
    mergedGroups,
    mergedBookings,
    remoteEstablishments: pulledSnapshot?.establishments ?? null,
    remoteTasks: pulledSnapshot?.tasks ?? [],
    remoteStockItems: pulledSnapshot?.stockItems ?? [],
    remoteDynamicRates: pulledSnapshot?.dynamicRates ?? {},
    recoveredProfile,
    warnings,
  };
}
