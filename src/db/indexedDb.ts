/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * IndexedDB local database adapter
 * Uses the browser's native IndexedDB API:
 * - Paginated lazy queries with offset and limit
 * - Never load whole collections into memory
 * - Indexed queried properties (domain, startDate, status, customerEmail)
 * - Asynchronous off-UI thread transaction batching
 */

import { TimelineBooking, InvoiceRecord, ResourceItem, DomainType } from '../types/booking';
import type { EventLogEntry } from '../types/eventLog';
import { EVENT_LOG_MAX_ENTRIES, sortEventLogsDesc } from '../utils/eventLog';
import { waitForTransactionCompletion } from './indexedDbTransaction';
import { runSerialQueue } from './serialQueue';
import { migrateBookingRecordV7 } from './bookingMigration';
import { hasBookingScheduleConflict } from '../utils/bookingValidation';
import {
  BOOKING_ARCHIVE_SCHEMA_VERSION,
  getBookingArchivePeriodBounds,
  getBookingArchivePeriodKey,
  isBookingEligibleForArchive,
} from '../utils/bookingArchive';
import { detectP2pBookingConflicts, type BookingConflictSnapshot } from '../services/p2p/bookingConflictDetection';
import { validateDeviceRegistry, type DeviceRegistry } from '../services/p2p/deviceTopology';
import {
  createP2pEvent,
  getP2pRecordState,
  mergeP2pEvents,
  validateP2pEvent,
  validateP2pCursorAdvance,
  validateP2pAckAdvance,
  validateP2pBatchSize,
  isP2pEventAuthoredByPeer,
  MAX_P2P_BATCH_BYTES,
  P2P_SUPPORTED_ENTITIES,
  type OutboxEntity,
  type P2pEntity,
  type P2pEvent,
  type P2pOperation,
} from '../services/p2p/protocol';
import {
  getNativeLanNodeIdentity,
  resetNativeLanNodeIdentity,
  supportsNativeLanDiscovery,
} from '../services/p2p/LanDiscoveryBridge';

function expectedOutboxEntityForStore(
  storeName: 'bookings' | 'resources' | 'resourceGroups',
): OutboxEntity {
  switch (storeName) {
    case 'bookings': return 'booking';
    case 'resources': return 'resource';
    case 'resourceGroups': return 'resource_group';
    default: throw new Error(`Unsupported Outbox store: ${String(storeName)}`);
  }
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function businessPayloadForComparison(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const copy = { ...(value as Record<string, unknown>) };
  delete copy.workspaceId;
  delete copy.syncVersion;
  delete copy.deletedAt;
  return copy;
}

export interface IndexedDbQueryOptions<T> {
  where?: (item: T) => boolean;
  offset?: number;
  limit?: number;
  orderBy?: keyof T;
  orderDesc?: boolean;
}

export interface IndexedDbStoreStats {
  storeName: string;
  version: number;
  isOpen: boolean;
  storeCounts: {
    bookings: number;
    invoices: number;
    resources: number;
  };
  indexedFields: string[];
  storageType: 'IndexedDB' | 'LocalStorage_Fallback';
}

export type IndexedDbSyncState = 'synced' | 'syncing' | 'offline';

/** Outbox entities are the subset with an implemented Supabase push dispatcher. */
export type { OutboxEntity } from '../services/p2p/protocol';
export type OutboxOperation = 'upsert' | 'delete';
export type OutboxStatus = 'pending' | 'synced' | 'failed';
export interface OutboxRecord {
  id: string; idempotencyKey: string; workspaceId: string; establishmentId?: string;
  entity: OutboxEntity; entityId: string; operation: OutboxOperation; version: number;
  payload: Record<string, unknown> | null; status: OutboxStatus; attempts: number;
  createdAt: string; nextAttemptAt: string; lastError?: string;
}
export interface TombstoneRecord {
  id: string; workspaceId: string; establishmentId?: string; entity: P2pEntity;
  entityId: string; version: number; deletedAt: string;
  /** Origin is used to preserve a local/peer delete against stale cloud snapshots. */
  origin?: 'local' | 'supabase' | 'p2p';
  remoteVersion?: number;
}
export interface BookingArchiveRecord {
  workspaceId: string;
  periodKey: string;
  bookingId: string;
  startDate: string;
  endDate: string;
  resourceId: string;
  sector: DomainType;
  archivedAt: string;
  schemaVersion: number;
  booking: TimelineBooking;
}
export interface BookingArchiveManifest {
  workspaceId: string;
  periodKey: string;
  periodStartDate: string;
  periodEndDate: string;
  bookingCount: number;
  archivedAt: string;
  schemaVersion: number;
  storage: 'indexeddb';
}
export interface OutboxMutationContext { workspaceId: string; establishmentId?: string; }
export interface RemoteWorkspaceTombstone {
  entity: P2pEntity;
  entityId: string;
  establishmentId?: string;
  deletedAt: string;
  remoteVersion: number;
}
export interface AppliedRemoteTombstones {
  applied: Array<{ entity: P2pEntity; entityId: string }>;
  conflicts: Array<{ entity: P2pEntity; entityId: string }>;
}

export interface P2pInboundBatch {
  workspaceId: string;
  peerId: string;
  expectedCursor: number;
  nextCursor: number;
  events: P2pEvent[];
}
export interface P2pApplyReport {
  appendedEvents: number;
  appliedRecords: number;
  conflicts: number;
  blockedByPendingLocal: number;
}
export interface P2pOutboundPage {
  workspaceId: string;
  peerId: string;
  expectedCursor: number;
  nextCursor: number;
  events: P2pEvent[];
  hasMore: boolean;
}
export interface OutboxSummary {
  pendingCount: number;
  failedCount: number;
  dueCount: number;
  lastError?: string;
}

class IndexedDbStore {
  // Preserve the legacy database identifier so existing browser data remains accessible.
  private dbName = 'OmniBook_ObjectBox_Store';
  private dbVersion = 17;
  private idb: IDBDatabase | null = null;
  private isInitialized = false;
  private syncState: IndexedDbSyncState = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'synced';
  private syncListeners = new Set<(status: IndexedDbSyncState) => void>();
  private outboxListeners = new Set<() => void>();
  private activeSyncOps = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.setSyncState(this.activeSyncOps > 0 ? 'syncing' : 'synced');
      });
      window.addEventListener('offline', () => {
        this.setSyncState('offline');
      });
    }
  }

  public getSyncStatus(): IndexedDbSyncState {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
    return this.syncState;
  }

  public subscribeSyncStatus(listener: (status: IndexedDbSyncState) => void): () => void {
    this.syncListeners.add(listener);
    listener(this.getSyncStatus());
    return () => this.syncListeners.delete(listener);
  }

  public subscribeOutboxChanges(listener: () => void): () => void {
    this.outboxListeners.add(listener);
    return () => this.outboxListeners.delete(listener);
  }

  private emitOutboxChange(): void {
    this.outboxListeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    });
  }

  private setSyncState(newState: IndexedDbSyncState) {
    if (this.syncState !== newState) {
      this.syncState = newState;
      this.syncListeners.forEach((fn) => {
        try {
          fn(newState);
        } catch (e) {
          console.error(e);
        }
      });
    }
  }

  private beginSyncOp() {
    this.activeSyncOps++;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setSyncState('offline');
    } else {
      this.setSyncState('syncing');
    }
  }

  private endSyncOp() {
    this.activeSyncOps = Math.max(0, this.activeSyncOps - 1);
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setSyncState('offline');
    } else if (this.activeSyncOps === 0) {
      // Small debounce to let UI show syncing smoothly
      setTimeout(() => {
        if (this.activeSyncOps === 0 && (typeof navigator === 'undefined' || navigator.onLine)) {
          this.setSyncState('synced');
        }
      }, 350);
    }
  }

  public async openStore(): Promise<boolean> {
    if (this.isInitialized && this.idb) return true;

    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        this.isInitialized = true;
        resolve(true);
        return;
      }

      const req = window.indexedDB.open(this.dbName, this.dbVersion);

      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        const upgradeTransaction = (e.target as IDBOpenDBRequest).transaction;
        upgradeTransaction?.addEventListener('abort', () => {
          console.error('[IndexedDB] Schema upgrade transaction aborted', {
            oldVersion: e.oldVersion,
            newVersion: e.newVersion,
            error: upgradeTransaction.error?.message ?? null,
            stores: Array.from(db.objectStoreNames),
          });
        });
        // Box 1: Bookings
        if (!db.objectStoreNames.contains('bookings')) {
          const bStore = db.createObjectStore('bookings', { keyPath: 'id' });
          bStore.createIndex('domain', 'sector', { unique: false });
          bStore.createIndex('startDate', 'startDate', { unique: false });
          bStore.createIndex('status', 'status', { unique: false });
          bStore.createIndex('customerEmail', 'guestEmail', { unique: false });
        }
        // Box 2: Invoices & Quotes
        if (!db.objectStoreNames.contains('invoices')) {
          const iStore = db.createObjectStore('invoices', { keyPath: 'id' });
          iStore.createIndex('docNumber', 'docNumber', { unique: true });
          iStore.createIndex('domain', 'domain', { unique: false });
          iStore.createIndex('status', 'status', { unique: false });
        }
        // Box 3: Resources
        if (!db.objectStoreNames.contains('resources')) {
          const rStore = db.createObjectStore('resources', { keyPath: 'id' });
          rStore.createIndex('sector', 'sector', { unique: false });
        }
        // Durable outbox stores are created empty; existing demo rows are never enqueued.
        if (!db.objectStoreNames.contains('outbox')) {
          const outbox = db.createObjectStore('outbox', { keyPath: 'id' });
          outbox.createIndex('workspaceCreatedAt', ['workspaceId', 'createdAt'], { unique: false });
          outbox.createIndex('statusNextAttemptAt', ['status', 'nextAttemptAt'], { unique: false });
          outbox.createIndex('idempotencyKey', 'idempotencyKey', { unique: true });
          outbox.createIndex('workspaceEntity', ['workspaceId', 'entity', 'entityId'], { unique: false });
        }
        if (!db.objectStoreNames.contains('tombstones')) {
          const tombstones = db.createObjectStore('tombstones', { keyPath: 'id' });
          tombstones.createIndex('workspaceDeletedAt', ['workspaceId', 'deletedAt'], { unique: false });
          tombstones.createIndex('workspaceEntity', ['workspaceId', 'entity', 'entityId'], { unique: true });
        }
        if (!db.objectStoreNames.contains('workspaceEntities')) {
          const entities = db.createObjectStore('workspaceEntities', { keyPath: ['workspaceId', 'entity', 'entityId'] });
          entities.createIndex('workspaceEntityId', ['workspaceId', 'entityId'], { unique: false });
          entities.createIndex('workspaceUpdatedAt', ['workspaceId', 'updatedAt'], { unique: false });
          entities.createIndex('workspaceResource', ['workspaceId', 'payload.resourceId'], { unique: false });
        }
        const upgradeTxForIndexes = (e.target as IDBOpenDBRequest).transaction;
        // A versionchange transaction can only open stores that already exist.
        // New stores are created below, so guard these lookups to keep upgrades
        // from aborting on older or partially migrated databases.
        if (upgradeTxForIndexes && db.objectStoreNames.contains('bookingArchiveRecords')) {
          const archiveRecordsStore = upgradeTxForIndexes.objectStore('bookingArchiveRecords');
          if (!archiveRecordsStore.indexNames.contains('workspaceStartDate')) {
            archiveRecordsStore.createIndex('workspaceStartDate', ['workspaceId', 'startDate'], { unique: false });
          }
        }
        if (upgradeTxForIndexes && db.objectStoreNames.contains('p2pTransportQueue')) {
          const p2pQueueStore = upgradeTxForIndexes.objectStore('p2pTransportQueue');
          if (!p2pQueueStore.indexNames.contains('workspaceEntity')) {
            p2pQueueStore.createIndex('workspaceEntity', ['workspaceId', 'event.entity', 'event.entityId'], { unique: false });
          }
        }
        const bookingsStore = upgradeTxForIndexes?.objectStore('bookings');
        if (bookingsStore && !bookingsStore.indexNames.contains('endDate')) {
          bookingsStore.createIndex('endDate', 'endDate', { unique: false });
        }
        if (bookingsStore && !bookingsStore.indexNames.contains('statusEndDate')) {
          bookingsStore.createIndex('statusEndDate', ['status', 'endDate'], { unique: false });
        }
        if (!db.objectStoreNames.contains('bookingArchiveRecords')) {
          const archiveRecords = db.createObjectStore('bookingArchiveRecords', {
            keyPath: ['workspaceId', 'periodKey', 'bookingId'],
          });
          archiveRecords.createIndex('workspaceEndDate', ['workspaceId', 'endDate'], { unique: false });
          archiveRecords.createIndex('workspaceStartDate', ['workspaceId', 'startDate'], { unique: false });
          archiveRecords.createIndex('workspaceBooking', ['workspaceId', 'bookingId'], { unique: false });
          archiveRecords.createIndex('workspacePeriod', ['workspaceId', 'periodKey'], { unique: false });
        }
        if (!db.objectStoreNames.contains('bookingArchiveManifests')) {
          const archiveManifests = db.createObjectStore('bookingArchiveManifests', {
            keyPath: ['workspaceId', 'periodKey'],
          });
          archiveManifests.createIndex('workspaceArchivedAt', ['workspaceId', 'archivedAt'], { unique: false });
        }
        const workspaceEntitiesStore = upgradeTxForIndexes?.objectStore('workspaceEntities');
        if (workspaceEntitiesStore && !workspaceEntitiesStore.indexNames.contains('workspaceResource')) {
          workspaceEntitiesStore.createIndex('workspaceResource', ['workspaceId', 'payload.resourceId'], { unique: false });
        }
        // Local-only business records are durable but deliberately excluded from
        // workspace Outbox/P2P until a verified workspace identity is available.
        if (!db.objectStoreNames.contains('localBusinessEntities')) {
          const localEntities = db.createObjectStore('localBusinessEntities', { keyPath: ['entity', 'entityId'] });
          localEntities.createIndex('entity', 'entity', { unique: false });
        }
        if (!db.objectStoreNames.contains('issuedCards')) {
          const issuedCards = db.createObjectStore('issuedCards', { keyPath: 'id' });
          issuedCards.createIndex('status', 'status', { unique: false });
          issuedCards.createIndex('issuedAt', 'issuedAt', { unique: false });
          issuedCards.createIndex('roomNumber', 'roomNumber', { unique: false });
        }
        if (!db.objectStoreNames.contains('resourceGroups')) {
          const groups = db.createObjectStore('resourceGroups', { keyPath: 'id' });
          groups.createIndex('sector', 'sector', { unique: false });
        }
        if (!db.objectStoreNames.contains('eventLogs')) {
          const eventLogs = db.createObjectStore('eventLogs', { keyPath: 'id' });
          eventLogs.createIndex('timestamp', 'timestamp', { unique: false });
          eventLogs.createIndex('category', 'category', { unique: false });
          eventLogs.createIndex('workspaceId', 'workspaceId', { unique: false });
        }
        // P2P v8 stores are additive. Existing operational rows are never rewritten.
        if (!db.objectStoreNames.contains('p2pEvents')) {
          const events = db.createObjectStore('p2pEvents', { keyPath: ['workspaceId', 'eventId'] });
          events.createIndex('workspaceEntity', ['workspaceId', 'entity', 'entityId'], { unique: false });
          events.createIndex('workspaceNodeSequence', ['workspaceId', 'nodeId', 'sequence'], { unique: true });
        }
        if (!db.objectStoreNames.contains('p2pClock')) {
          const clock = db.createObjectStore('p2pClock', { keyPath: ['workspaceId', 'nodeId'] });
          clock.createIndex('workspaceId', 'workspaceId', { unique: false });
        }
        if (!db.objectStoreNames.contains('p2pMeta')) {
          db.createObjectStore('p2pMeta', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('p2pPeerCursors')) {
          db.createObjectStore('p2pPeerCursors', { keyPath: ['workspaceId', 'peerId'] });
        }
        if (!db.objectStoreNames.contains('p2pRecordFrontiers')) {
          db.createObjectStore('p2pRecordFrontiers', { keyPath: ['workspaceId', 'entity', 'entityId'] });
        }
        // v11: durable per-workspace relay queue and per-peer outbound ACK cursors.
        if (!db.objectStoreNames.contains('p2pTransportQueue')) {
          const queue = db.createObjectStore('p2pTransportQueue', { keyPath: 'localOrder', autoIncrement: true });
          queue.createIndex('workspaceOrder', ['workspaceId', 'localOrder'], { unique: true });
          queue.createIndex('workspaceEntity', ['workspaceId', 'event.entity', 'event.entityId'], { unique: false });
        }
        if (!db.objectStoreNames.contains('p2pPeerAcks')) {
          db.createObjectStore('p2pPeerAcks', { keyPath: ['workspaceId', 'peerId'] });
        }
        // v13: durable business-level conflicts across distinct booking IDs.
        if (!db.objectStoreNames.contains('p2pBookingConflicts')) {
          const conflicts = db.createObjectStore('p2pBookingConflicts', { keyPath: 'id' });
          conflicts.createIndex('workspaceStatus', ['workspaceId', 'status'], { unique: false });
          conflicts.createIndex('workspaceDetectedAt', ['workspaceId', 'detectedAt'], { unique: false });
        }
        if (e.oldVersion > 0 && e.oldVersion < 11 && db.objectStoreNames.contains('p2pEvents')) {
          const upgradeTx = (e.target as IDBOpenDBRequest).transaction;
          const legacyEvents = upgradeTx?.objectStore('p2pEvents');
          const relayQueue = upgradeTx?.objectStore('p2pTransportQueue');
          const meta = upgradeTx?.objectStore('p2pMeta');
          if (legacyEvents && relayQueue && meta) {
            const identityRequest = meta.get('nodeId');
            identityRequest.onsuccess = () => {
              const localNodeId = (identityRequest.result as { value?: string } | undefined)?.value;
              if (!localNodeId) return;
              const cursorRequest = legacyEvents.openCursor();
              cursorRequest.onsuccess = () => {
                const cursor = cursorRequest.result;
                if (!cursor) return;
                const event = cursor.value as P2pEvent;
                if (event.nodeId === localNodeId) relayQueue.add({ workspaceId: event.workspaceId, event });
                cursor.continue();
              };
            };
          }
        }
        // v12 removes third-party events queued by the earlier relay-only prototype.
        if (e.oldVersion >= 11 && e.oldVersion < 12) {
          const upgradeTx = (e.target as IDBOpenDBRequest).transaction;
          const relayQueue = upgradeTx?.objectStore('p2pTransportQueue');
          const meta = upgradeTx?.objectStore('p2pMeta');
          if (relayQueue && meta) {
            const identityRequest = meta.get('nodeId');
            identityRequest.onsuccess = () => {
              const localNodeId = (identityRequest.result as { value?: string } | undefined)?.value;
              const cursorRequest = relayQueue.openCursor();
              cursorRequest.onsuccess = () => {
                const cursor = cursorRequest.result;
                if (!cursor) return;
                const row = cursor.value as { event?: P2pEvent };
                if (!localNodeId || row.event?.nodeId !== localNodeId) cursor.delete();
                cursor.continue();
              };
            };
          }
        }

        // v7 upgrade: index sector+startDate and normalize existing local booking records without data loss.
        const upgradeTx = (e.target as IDBOpenDBRequest).transaction;
        if (upgradeTx && db.objectStoreNames.contains('workspaceEntities')) {
          const entities = upgradeTx.objectStore('workspaceEntities');
          if (!entities.indexNames.contains('workspaceEntityType')) {
            entities.createIndex('workspaceEntityType', ['workspaceId', 'entity'], { unique: false });
          }
        }
        if (e.oldVersion > 0 && e.oldVersion < 7 && upgradeTx) {
          if (db.objectStoreNames.contains('bookings')) {
            const bStore = upgradeTx.objectStore('bookings');
            if (!bStore.indexNames.contains('sectorStartDate')) {
              bStore.createIndex('sectorStartDate', ['sector', 'startDate'], { unique: false });
            }
            const cursorReq = bStore.openCursor();
            cursorReq.onsuccess = (cursorEvent) => {
              const cursor = (cursorEvent.target as IDBRequest<IDBCursorWithValue | null>).result;
              if (!cursor) return;
              const migrated = migrateBookingRecordV7(cursor.value as TimelineBooking);
              cursor.update(migrated);
              cursor.continue();
            };
          }
          if (db.objectStoreNames.contains('workspaceEntities')) {
            const wStore = upgradeTx.objectStore('workspaceEntities');
            const cursorReq = wStore.openCursor();
            cursorReq.onsuccess = (cursorEvent) => {
              const cursor = (cursorEvent.target as IDBRequest<IDBCursorWithValue | null>).result;
              if (!cursor) return;
              const row = cursor.value as { entity?: P2pEntity; payload?: Record<string, unknown> };
              if (row?.entity === 'booking' && row.payload && typeof row.payload === 'object') {
                cursor.update({
                  ...row,
                  payload: migrateBookingRecordV7(row.payload as Partial<TimelineBooking>),
                });
              }
              cursor.continue();
            };
          }
        } else if (db.objectStoreNames.contains('bookings') && upgradeTx) {
          const bStore = upgradeTx.objectStore('bookings');
          if (!bStore.indexNames.contains('sectorStartDate')) {
            bStore.createIndex('sectorStartDate', ['sector', 'startDate'], { unique: false });
          }
        }
      };

      req.onsuccess = () => {
        this.idb = req.result;
        this.isInitialized = true;
        resolve(true);
      };

      req.onerror = () => {
        this.isInitialized = false;
        console.error('[IndexedDB] Database open or schema upgrade failed', {
          database: this.dbName,
          requestedVersion: this.dbVersion,
          error: req.error?.message ?? null,
        });
        reject(req.error ?? new Error('Unable to open the local IndexedDB database'));
      };
      req.onblocked = () => {
        this.isInitialized = false;
        reject(new Error('Opening the local IndexedDB database was blocked by another tab'));
      };
    });
  }

  /** Read the complete contents of a dedicated operational store. */
  public async getAllFromStore<T>(storeName: 'issuedCards' | 'resourceGroups'): Promise<T[]> {
    await this.openStore();
    if (!this.idb) {
      try {
        return JSON.parse(localStorage.getItem(`ob_${storeName}`) || '[]') as T[];
      } catch {
        return [];
      }
    }
    const tx = this.idb.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    const result = await new Promise<T[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
    await waitForTransactionCompletion(tx, `getAllFromStore ${storeName}`);
    return result;
  }

  /** Atomically replace a dedicated operational store; IndexedDB remains authoritative. */
  public async replaceStoreForMigration<T extends { id: string }>(storeName: 'resourceGroups', items: T[]): Promise<void> {
    await this.openStore();
    if (!this.idb) {
      localStorage.setItem(`ob_${storeName}`, JSON.stringify(items));
      return;
    }
    const tx = this.createStrictTransaction([storeName]);
    const store = tx.objectStore(storeName);
    store.clear();
    for (const item of items) store.put(item);
    await waitForTransactionCompletion(tx, `replaceStore ${storeName}`);
  }

  /** Append a live PMS event log entry with bounded local retention. */
  public async appendEventLog(
    entry: EventLogEntry,
    maxEntries = EVENT_LOG_MAX_ENTRIES
  ): Promise<void> {
    await this.openStore();
    if (!this.idb) {
      let existing: EventLogEntry[] = [];
      try {
        existing = JSON.parse(localStorage.getItem('ob_eventLogs') || '[]') as EventLogEntry[];
      } catch {
        existing = [];
      }
      const next = sortEventLogsDesc([
        ...existing.filter((item) => item.id !== entry.id),
        entry,
      ]).slice(0, maxEntries);
      localStorage.setItem('ob_eventLogs', JSON.stringify(next));
      return;
    }

    const tx = this.createStrictTransaction(['eventLogs']);
    const store = tx.objectStore('eventLogs');
    store.put(entry);

    const getAllReq = store.getAll();
    getAllReq.onsuccess = () => {
      const all = sortEventLogsDesc(getAllReq.result as EventLogEntry[]);
      if (all.length > maxEntries) {
        for (const obsolete of all.slice(maxEntries)) {
          store.delete(obsolete.id);
        }
      }
    };
    getAllReq.onerror = () => tx.abort();
    await waitForTransactionCompletion(tx, `appendEventLog ${entry.id}`);
  }

  /** Read locally stored event log entries ordered newest-first. */
  public async getEventLogs(limit = EVENT_LOG_MAX_ENTRIES): Promise<EventLogEntry[]> {
    await this.openStore();
    if (!this.idb) {
      try {
        const list = JSON.parse(localStorage.getItem('ob_eventLogs') || '[]') as EventLogEntry[];
        return sortEventLogsDesc(Array.isArray(list) ? list : []).slice(0, limit);
      } catch {
        return [];
      }
    }

    const tx = this.idb.transaction('eventLogs', 'readonly');
    const request = tx.objectStore('eventLogs').getAll();
    const result = await new Promise<EventLogEntry[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as EventLogEntry[]);
      request.onerror = () => reject(request.error);
    });
    await waitForTransactionCompletion(tx, 'getEventLogs');
    return sortEventLogsDesc(result).slice(0, limit);
  }

  /** Clear locally persisted event logs without disturbing operational business records. */
  public async clearEventLogs(): Promise<void> {
    await this.openStore();
    if (this.idb) {
      const tx = this.createStrictTransaction(['eventLogs']);
      tx.objectStore('eventLogs').clear();
      await waitForTransactionCompletion(tx, 'clearEventLogs');
    }
    try {
      localStorage.removeItem('ob_eventLogs');
    } catch {
      /* storage unavailable */
    }
  }

  // Generic paginated box query with true storage-side cursor pagination (IndexedDB §11 pattern)
  public async queryStore<T>(
    storeName: 'bookings' | 'invoices' | 'resources' | 'resourceGroups',
    options?: IndexedDbQueryOptions<T>
  ): Promise<{ data: T[]; total: number }> {
    await this.openStore();

    if (!this.idb) {
      // Memory fallback from localStorage
      const raw = localStorage.getItem(`ob_${storeName}`);
      let list: T[] = raw ? JSON.parse(raw) : [];
      if (storeName === 'bookings') {
        list = list.map((entry) => migrateBookingRecordV7(entry as Partial<TimelineBooking>) as T);
      }
      if (options?.where) list = list.filter(options.where);
      const total = list.length;
      if (options?.offset !== undefined || options?.limit !== undefined) {
        const off = options.offset || 0;
        const lim = options.limit || list.length;
        list = list.slice(off, off + lim);
      }
      return { data: list, total };
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.idb!.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const direction: IDBCursorDirection = options?.orderDesc ? 'prev' : 'next';

        // Check if an index exists for the specified orderBy property
        let source: IDBObjectStore | IDBIndex = store;
        if (options?.orderBy && typeof options.orderBy === 'string' && store.indexNames.contains(options.orderBy)) {
          source = store.index(options.orderBy);
        }

        const offset = options?.offset || 0;
        const limit = options?.limit !== undefined ? options.limit : Infinity;
        const whereFn = options?.where;

        // If there's no custom filter function, perform true engine-level cursor skip & limit
        if (!whereFn) {
          const countReq = store.count();
          let totalCount = 0;

          countReq.onsuccess = () => {
            totalCount = countReq.result;

            if (totalCount === 0 || limit <= 0 || offset >= totalCount) {
              resolve({ data: [], total: totalCount });
              return;
            }

            const cursorReq = source.openCursor(null, direction);
            const results: T[] = [];
            let hasAdvanced = false;

            cursorReq.onsuccess = (e) => {
              const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
              if (!cursor) {
                resolve({ data: results, total: totalCount });
                return;
              }

              // True storage engine skip without loading skipped items into memory
              if (offset > 0 && !hasAdvanced) {
                hasAdvanced = true;
                cursor.advance(offset);
                return;
              }

              results.push(cursor.value);
              if (results.length < limit) {
                cursor.continue();
              } else {
                resolve({ data: results, total: totalCount });
              }
            };

            cursorReq.onerror = () => reject(cursorReq.error);
          };

          countReq.onerror = () => reject(countReq.error);
        } else {
          // Streaming cursor iteration with predicate evaluation
          const cursorReq = source.openCursor(null, direction);
          const results: T[] = [];
          let matchedIndex = 0;
          let totalMatching = 0;

          cursorReq.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (!cursor) {
              resolve({ data: results, total: totalMatching });
              return;
            }

            const item = cursor.value as T;
            if (whereFn(item)) {
              totalMatching++;
              if (matchedIndex >= offset && results.length < limit) {
                results.push(item);
              }
              matchedIndex++;
            }

            cursor.continue();
          };

          cursorReq.onerror = () => reject(cursorReq.error);
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Read only the operational booking projection. Closed bookings older than the
   * retention window live in bookingArchiveRecords and are never hydrated here.
   * Non-terminal records are retained even when their end date is old.
   */
  public async queryOperationalBookings(
    cutoffDate: string,
  ): Promise<{ data: TimelineBooking[]; total: number }> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoffDate)) {
      throw new Error('Operational booking cutoff must use YYYY-MM-DD.');
    }
    await this.openStore();
    if (!this.idb) {
      return this.queryStore<TimelineBooking>('bookings', {
        where: (booking) => booking.endDate >= cutoffDate
          || (booking.status !== 'checked_out' && booking.status !== 'cancelled'),
      });
    }
    const tx = this.idb.transaction('bookings', 'readonly');
    const store = tx.objectStore('bookings');
    const activeStatuses = ['new', 'confirmed', 'due_in', 'checked_in', 'due_out', 'booking_offer', 'out_of_order'];
    const requests: IDBRequest<TimelineBooking[]>[] = [
      store.index('endDate').getAll(IDBKeyRange.lowerBound(cutoffDate)),
      ...activeStatuses.map((status) => store.index('status').getAll(status)),
    ];
    const pages = await Promise.all(requests.map((request) => new Promise<TimelineBooking[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Operational booking query failed.'));
    })));
    await waitForTransactionCompletion(tx, 'queryOperationalBookings');
    const byId = new Map<string, TimelineBooking>();
    for (const page of pages) for (const booking of page) byId.set(booking.id, booking);
    const data = [...byId.values()].sort((a, b) =>
      a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id),
    );
    return { data, total: data.length };
  }

  /**
   * Move only checked-out/cancelled bookings older than the six-month cutoff.
   * Each batch atomically writes the archive row + manifest and removes the
   * operational row. Pending/failed Outbox mutations are never archived.
   */
  public async archiveClosedBookings(
    cutoffDate: string,
    fallbackWorkspaceId = 'local',
    limit = 250,
  ): Promise<{ archivedIds: string[]; skippedPendingCount: number; periodCount: number }> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoffDate)
      || !fallbackWorkspaceId.trim()
      || !Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
      throw new Error('Invalid booking archive scope, cutoff or batch limit.');
    }
    await this.openStore();
    if (!this.idb) {
      return { archivedIds: [], skippedPendingCount: 0, periodCount: 0 };
    }
    const tx = this.createStrictTransaction([
      'bookings', 'outbox', 'p2pTransportQueue', 'bookingArchiveRecords', 'bookingArchiveManifests',
    ]);
    const bookingStore = tx.objectStore('bookings');
    const archiveStore = tx.objectStore('bookingArchiveRecords');
    const manifestStore = tx.objectStore('bookingArchiveManifests');
    const outboxIndex = tx.objectStore('outbox').index('workspaceEntity');
    const p2pQueueIndex = tx.objectStore('p2pTransportQueue').index('workspaceEntity');
    const statusEndDate = bookingStore.index('statusEndDate');
    const checkedOutRequest = statusEndDate.getAll(
      IDBKeyRange.bound(['checked_out', ''], ['checked_out', cutoffDate], false, true),
      limit,
    );
    const cancelledRequest = statusEndDate.getAll(
      IDBKeyRange.bound(['cancelled', ''], ['cancelled', cutoffDate], false, true),
      limit,
    );
    const manifestsRequest = manifestStore.getAll();
    let checkedOutRows: TimelineBooking[] = [];
    let cancelledRows: TimelineBooking[] = [];
    let manifests: BookingArchiveManifest[] = [];
    let readsReady = 0;
    let skippedPendingCount = 0;
    let archivedIds: string[] = [];
    let periodCount = 0;

    const abort = () => { try { tx.abort(); } catch { /* already inactive */ } };
    const writeArchiveBatch = (eligible: Array<{ booking: TimelineBooking; workspaceId: string }>) => {
      if (eligible.length === 0) return;
      const now = new Date().toISOString();
      const manifestByKey = new Map(manifests.map((manifest) => [
        `${manifest.workspaceId}:${manifest.periodKey}`,
        manifest,
      ]));
      const grouped = new Map<string, { workspaceId: string; periodKey: string; count: number }>();
      for (const item of eligible) {
        const periodKey = getBookingArchivePeriodKey(item.booking.endDate);
        const groupKey = `${item.workspaceId}:${periodKey}`;
        const group = grouped.get(groupKey) ?? {
          workspaceId: item.workspaceId,
          periodKey,
          count: 0,
        };
        group.count += 1;
        grouped.set(groupKey, group);
        archiveStore.put({
          workspaceId: item.workspaceId,
          periodKey,
          bookingId: item.booking.id,
          startDate: item.booking.startDate,
          endDate: item.booking.endDate,
          resourceId: item.booking.resourceId,
          sector: item.booking.sector,
          archivedAt: now,
          schemaVersion: BOOKING_ARCHIVE_SCHEMA_VERSION,
          booking: item.booking,
        } satisfies BookingArchiveRecord);
        bookingStore.delete(item.booking.id);
      }
      for (const group of grouped.values()) {
        const previous = manifestByKey.get(`${group.workspaceId}:${group.periodKey}`);
        const bounds = getBookingArchivePeriodBounds(group.periodKey);
        manifestStore.put({
          workspaceId: group.workspaceId,
          periodKey: group.periodKey,
          periodStartDate: bounds.startDate,
          periodEndDate: bounds.endDate,
          bookingCount: (previous?.bookingCount ?? 0) + group.count,
          archivedAt: now,
          schemaVersion: BOOKING_ARCHIVE_SCHEMA_VERSION,
          storage: 'indexeddb',
        } satisfies BookingArchiveManifest);
      }
      archivedIds = eligible.map((item) => item.booking.id);
      periodCount = grouped.size;
    };

    const processCandidates = () => {
      if (readsReady !== 3) return;
      const unique = new Map<string, TimelineBooking>();
      for (const booking of [...checkedOutRows, ...cancelledRows]) {
        if (isBookingEligibleForArchive(booking, cutoffDate)) unique.set(booking.id, booking);
      }
      const candidates = [...unique.values()].slice(0, limit);
      if (candidates.length === 0) return;
      const eligible: Array<{ booking: TimelineBooking; workspaceId: string }> = [];
      let pendingChecks = candidates.length;
      const finishPendingChecks = () => {
        if (pendingChecks !== 0) return;
        writeArchiveBatch(eligible);
      };
      for (const booking of candidates) {
        const workspaceId = (booking as TimelineBooking & { workspaceId?: string }).workspaceId || fallbackWorkspaceId;
        let checksReady = 0;
        let hasPendingOutbox = false;
        let hasPendingP2p = false;
        const finishCandidateChecks = () => {
          if (checksReady !== 2) return;
          if (hasPendingOutbox || hasPendingP2p) skippedPendingCount += 1;
          else eligible.push({ booking, workspaceId });
          pendingChecks -= 1;
          finishPendingChecks();
        };
        const pendingRequest = outboxIndex.getAll(
          IDBKeyRange.only([workspaceId, 'booking', booking.id]),
        );
        pendingRequest.onsuccess = () => {
          hasPendingOutbox = (pendingRequest.result as OutboxRecord[]).some((record) =>
            record.status === 'pending' || record.status === 'failed',
          );
          checksReady += 1;
          finishCandidateChecks();
        };
        pendingRequest.onerror = abort;
        const p2pPendingRequest = p2pQueueIndex.getAll(
          IDBKeyRange.only([workspaceId, 'booking', booking.id]),
        );
        p2pPendingRequest.onsuccess = () => {
          hasPendingP2p = p2pPendingRequest.result.length > 0;
          checksReady += 1;
          finishCandidateChecks();
        };
        p2pPendingRequest.onerror = abort;
      }
    };

    checkedOutRequest.onsuccess = () => { checkedOutRows = checkedOutRequest.result; readsReady += 1; processCandidates(); };
    cancelledRequest.onsuccess = () => { cancelledRows = cancelledRequest.result; readsReady += 1; processCandidates(); };
    manifestsRequest.onsuccess = () => { manifests = manifestsRequest.result as BookingArchiveManifest[]; readsReady += 1; processCandidates(); };
    checkedOutRequest.onerror = abort;
    cancelledRequest.onerror = abort;
    manifestsRequest.onerror = abort;

    await waitForTransactionCompletion(tx, 'archiveClosedBookings');
    return { archivedIds, skippedPendingCount, periodCount };
  }

  /** Lazy historical read by exact end-date window; no archive is loaded at startup. */
  /** Lazy historical read by booking start-date window; supports bounded cursor pagination. */
  public async getArchivedBookingsWindow(
    workspaceId: string,
    startDate: string,
    endDate: string,
    limit = 500,
    offset = 0,
  ): Promise<TimelineBooking[]> {
    if (!workspaceId.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)
      || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate
      || !Number.isSafeInteger(limit) || limit < 1 || limit > 1000
      || !Number.isSafeInteger(offset) || offset < 0) {
      throw new Error('Invalid archived booking window.');
    }
    await this.openStore();
    if (!this.idb) return [];
    const tx = this.idb.transaction('bookingArchiveRecords', 'readonly');
    const request = tx.objectStore('bookingArchiveRecords').index('workspaceStartDate').openCursor(
      IDBKeyRange.bound([workspaceId, startDate], [workspaceId, endDate]),
    );
    const records = await new Promise<BookingArchiveRecord[]>((resolve, reject) => {
      const result: BookingArchiveRecord[] = [];
      let skipped = 0;
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || result.length >= limit) { resolve(result); return; }
        if (skipped < offset) {
          skipped += 1;
          cursor.continue();
          return;
        }
        result.push(cursor.value as BookingArchiveRecord);
        if (result.length < limit) cursor.continue();
        else resolve(result);
      };
      request.onerror = () => reject(request.error ?? new Error('Archived booking query failed.'));
    });
    await waitForTransactionCompletion(tx, 'getArchivedBookingsWindow');
    return records.map((record) => record.booking);
  }

  /** Archive manifests are small and can be listed without reading historical payloads. */
  public async getBookingArchiveManifests(
    workspaceId: string,
    limit = 100,
  ): Promise<BookingArchiveManifest[]> {
    if (!workspaceId.trim() || !Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
      throw new Error('Invalid booking archive manifest query.');
    }
    await this.openStore();
    if (!this.idb) return [];
    const tx = this.idb.transaction('bookingArchiveManifests', 'readonly');
    const request = tx.objectStore('bookingArchiveManifests').index('workspaceArchivedAt')
      .openCursor(IDBKeyRange.bound([workspaceId, ''], [workspaceId, '\uffff']), 'prev');
    const manifests = await new Promise<BookingArchiveManifest[]>((resolve, reject) => {
      const result: BookingArchiveManifest[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || result.length >= limit) { resolve(result); return; }
        result.push(cursor.value as BookingArchiveManifest);
        cursor.continue();
      };
      request.onerror = () => reject(request.error ?? new Error('Booking archive manifest query failed.'));
    });
    await waitForTransactionCompletion(tx, 'getBookingArchiveManifests');
    return manifests;
  }

  /** Replace non-business issued-card metadata; it is not part of P2P business replication. */
  public async replaceStore<T extends { id: string }>(storeName: 'issuedCards', items: T[]): Promise<void> {
    await this.openStore();
    if (!this.idb) {
      localStorage.setItem(`ob_${storeName}`, JSON.stringify(items));
      return;
    }
    const tx = this.createStrictTransaction([storeName]);
    const store = tx.objectStore(storeName);
    store.clear();
    for (const item of items) store.put(item);
    await waitForTransactionCompletion(tx, `replaceStore ${storeName}`);
  }

  // Atomically replace a collection snapshot. This removes rows deleted from app state.
  public async replaceAllForMigration<T extends { id: string }>(
    storeName: 'bookings' | 'invoices' | 'resources' | 'resourceGroups',
    items: T[]
  ): Promise<void> {
    const normalizedItems =
      storeName === 'bookings'
        ? items.map((entry) => migrateBookingRecordV7(entry as Partial<TimelineBooking>) as T)
        : items;
    this.beginSyncOp();
    try {
      await this.openStore();
      if (this.idb) {
        const tx = this.createStrictTransaction([storeName]);
        const store = tx.objectStore(storeName);
        const existingRequest = store.getAll();
        existingRequest.onsuccess = () => {
          const existingById = new Map(
            (existingRequest.result as Array<T & { workspaceId?: string; establishmentId?: string; syncVersion?: number; deletedAt?: string | null }>)
              .map((entry) => [entry.id, entry])
          );
          store.clear();
          for (const item of normalizedItems) {
            const existing = existingById.get(item.id);
            store.put(existing ? {
              ...item,
              workspaceId: existing.workspaceId,
              establishmentId: existing.establishmentId,
              syncVersion: existing.syncVersion,
              deletedAt: existing.deletedAt,
            } : item);
          }
        };
        existingRequest.onerror = () => tx.abort();
        await waitForTransactionCompletion(tx, `replaceAll ${storeName}`);

        // IndexedDB is authoritative; do not duplicate large collections in localStorage.
        return;
      }

      // In fallback mode this is the primary store, so failure must reach the caller.
      localStorage.setItem(`ob_${storeName}`, JSON.stringify(normalizedItems));
    } finally {
      this.endSyncOp();
    }
  }

  // Put / Upsert
  public async put<T extends { id: string }>(
    storeName: 'bookings' | 'invoices' | 'resources' | 'resourceGroups',
    item: T
  ): Promise<void> {
    if (['bookings', 'invoices', 'resources', 'resourceGroups'].includes(storeName)) {
      throw new Error('Direct business writes are disabled. Use putWithOutbox or reconcileSnapshotWithOutbox.');
    }
    const normalizedItem = item;
    this.beginSyncOp();
    try {
      await this.openStore();

      if (this.idb) {
        const tx = this.createStrictTransaction([storeName]);
        tx.objectStore(storeName).put(normalizedItem);
        await waitForTransactionCompletion(tx, `put ${storeName}/${item.id}`);

        // Do not mirror operational records into localStorage when IndexedDB is available.
        return;
      }

      // In fallback mode localStorage is the primary store; propagate quota/security errors.
      const raw = localStorage.getItem(`ob_${storeName}`);
      const list: T[] = raw ? JSON.parse(raw) : [];
      localStorage.setItem(
        `ob_${storeName}`,
        JSON.stringify([...list.filter((entry) => entry.id !== normalizedItem.id), normalizedItem])
      );
    } finally {
      this.endSyncOp();
    }
  }

  /** Physical business-record deletion is disabled; use deleteWithOutbox for a tombstone. */
  public async remove(
    _storeName: 'bookings' | 'resources' | 'resourceGroups',
    _id: string,
  ): Promise<void> {
    throw new Error(
      'Physical deletion is disabled. Use deleteWithOutbox to persist a tombstone, Outbox mutation and P2P event.',
    );
  }

  // Clear all stores completely (for legal GDPR / Account Deletion purge).
  // Reject on transaction failure so the caller cannot falsely report a successful deletion.
  public async clearAll(): Promise<void> {
    this.beginSyncOp();
    try {
      await this.openStore();

      if (this.idb) {
        // Rotate the node ID before clearing its event sequence. If the IDB purge
        // aborts, the old persisted ID remains authoritative and discovery re-adopts it.
        const nextNodeId = supportsNativeLanDiscovery()
          ? await resetNativeLanNodeIdentity()
          : this.createId();
        const tx = this.createStrictTransaction(['bookings', 'bookingArchiveRecords', 'bookingArchiveManifests', 'invoices', 'resources', 'outbox', 'tombstones', 'workspaceEntities', 'localBusinessEntities', 'issuedCards', 'resourceGroups', 'eventLogs', 'p2pEvents', 'p2pTransportQueue', 'p2pPeerAcks', 'p2pClock', 'p2pMeta', 'p2pPeerCursors', 'p2pRecordFrontiers']);
        tx.objectStore('bookings').clear();
        tx.objectStore('bookingArchiveRecords').clear();
        tx.objectStore('bookingArchiveManifests').clear();
        tx.objectStore('invoices').clear();
        tx.objectStore('resources').clear();
        tx.objectStore('outbox').clear();
        tx.objectStore('tombstones').clear();
        tx.objectStore('workspaceEntities').clear();
        tx.objectStore('localBusinessEntities').clear();
        tx.objectStore('issuedCards').clear();
        tx.objectStore('resourceGroups').clear();
        tx.objectStore('eventLogs').clear();
        tx.objectStore('p2pEvents').clear();
        tx.objectStore('p2pTransportQueue').clear();
        tx.objectStore('p2pPeerAcks').clear();
        tx.objectStore('p2pClock').clear();
        tx.objectStore('p2pMeta').clear();
        tx.objectStore('p2pMeta').put({ key: 'nodeId', value: nextNodeId });
        tx.objectStore('p2pPeerCursors').clear();
        tx.objectStore('p2pRecordFrontiers').clear();
        await waitForTransactionCompletion(tx, 'clear all stores');
      }

      // Clear the fallback only after the authoritative IDB transaction commits.
      for (const storeName of ['bookings', 'invoices', 'resources', 'issuedCards', 'resourceGroups', 'eventLogs'] as const) {
        localStorage.removeItem(`ob_${storeName}`);
      }
      this.emitOutboxChange();
    } finally {
      this.endSyncOp();
    }
  }

  private createId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  private createOutboxRecord(context: OutboxMutationContext, entity: OutboxEntity, entityId: string,
    operation: OutboxOperation, version: number, payload: Record<string, unknown> | null, now: string,
    idempotencyKey?: string): OutboxRecord {
    if (!context.workspaceId.trim()) throw new Error('A workspace is required before queuing a cloud mutation.');
    return {
      id: this.createId(),
      idempotencyKey: idempotencyKey ?? `${context.workspaceId}:${entity}:${entityId}:${version}`,
      workspaceId: context.workspaceId,
      establishmentId: context.establishmentId,
      entity, entityId, operation, version, payload,
      status: 'pending', attempts: 0, createdAt: now, nextAttemptAt: now,
    };
  }

  /**
   * Apply one authenticated transport page. Event log, vector clock, materialized
   * records, conflict frontier and peer cursor commit in one IndexedDB transaction.
   */
  public async applyReceivedP2pBatch(batch: P2pInboundBatch): Promise<P2pApplyReport> {
    if (
      !batch.workspaceId.trim()
      || !batch.peerId.trim()
      || !Number.isSafeInteger(batch.expectedCursor)
      || !Number.isSafeInteger(batch.nextCursor)
      || batch.events.length > 500
      || !validateP2pCursorAdvance(batch.expectedCursor, batch.nextCursor, batch.events.length)
    ) throw new Error('Invalid P2P inbound batch identity, cursor or page size.');
    let batchBytes = 0;
    for (const event of batch.events) {
      validateP2pEvent(event);
      if (event.workspaceId !== batch.workspaceId) {
        throw new Error('P2P inbound batch contains an event from another workspace.');
      }
      if (!isP2pEventAuthoredByPeer(batch.peerId, event)) {
        throw new Error('P2P peer may only submit events authored by its authenticated node identity.');
      }
      const eventBytes = new TextEncoder().encode(JSON.stringify(event)).byteLength;
      if (eventBytes > 1024 * 1024) {
        throw new Error('P2P event exceeds the 1 MiB persistence limit.');
      }
      batchBytes += eventBytes;
      if (!validateP2pBatchSize(batch.events.length, batchBytes)) {
        throw new Error('P2P inbound batch exceeds its 500-event or 4 MiB limit.');
      }
      if (!P2P_SUPPORTED_ENTITIES.includes(event.entity)) {
        throw new Error(`Unsupported P2P entity type: ${event.entity}`);
      }
    }

    await this.openStore();
    if (!this.idb) throw new Error('P2P replication requires IndexedDB; localStorage fallback is unsafe.');
    const tx = this.createStrictTransaction(
      ['p2pEvents', 'p2pTransportQueue', 'p2pClock', 'p2pPeerCursors', 'p2pRecordFrontiers', 'p2pBookingConflicts', 'outbox',
        'tombstones', 'workspaceEntities', 'bookings', 'bookingArchiveRecords', 'bookingArchiveManifests', 'resources', 'invoices', 'resourceGroups'],
    );
    const report: P2pApplyReport = {
      appendedEvents: 0,
      appliedRecords: 0,
      conflicts: 0,
      blockedByPendingLocal: 0,
    };
    const affected = new Map<string, { entity: string; entityId: string }>();
    const abort = () => { try { tx.abort(); } catch { /* already inactive */ } };

    const cursorRequest = tx.objectStore('p2pPeerCursors').get([batch.workspaceId, batch.peerId]);
    cursorRequest.onsuccess = () => {
      const persisted = (cursorRequest.result as { cursor?: number } | undefined)?.cursor ?? 0;
      if (persisted !== batch.expectedCursor) {
        abort();
        return;
      }
      const appendNext = (index: number): void => {
        if (index >= batch.events.length) {
          mergeClockAndApply();
          return;
        }
        const event = batch.events[index];
        const eventStore = tx.objectStore('p2pEvents');
        const existingRequest = eventStore.get([batch.workspaceId, event.eventId]);
        existingRequest.onsuccess = () => {
          const existing = existingRequest.result as P2pEvent | undefined;
          try {
            if (existing) {
              mergeP2pEvents([existing], [event]);
            } else {
              eventStore.add(event);
              report.appendedEvents += 1;
            }
            affected.set(`${event.entity}\u0000${event.entityId}`, {
              entity: event.entity,
              entityId: event.entityId,
            });
            appendNext(index + 1);
          } catch {
            abort();
          }
        };
        existingRequest.onerror = abort;
      };

      const mergeClockAndApply = (): void => {
        const clockStore = tx.objectStore('p2pClock');
        const clockRequest = clockStore.index('workspaceId').getAll(batch.workspaceId);
        clockRequest.onsuccess = () => {
          const merged = new Map<string, number>();
          for (const row of clockRequest.result as Array<{ nodeId: string; sequence: number }>) {
            merged.set(row.nodeId, row.sequence);
          }
          for (const event of batch.events) {
            for (const [nodeId, sequence] of Object.entries(event.clock)) {
              merged.set(nodeId, Math.max(merged.get(nodeId) ?? 0, sequence));
            }
          }
          if (merged.size > 256) {
            abort();
            return;
          }
          for (const [nodeId, sequence] of merged) {
            clockStore.put({ workspaceId: batch.workspaceId, nodeId, sequence });
          }
          applyNext([...affected.values()], 0);
        };
        clockRequest.onerror = abort;
      };

      const applyNext = (records: Array<{ entity: string; entityId: string }>, index: number): void => {
        if (index >= records.length) {
          // Persist booking overlap conflicts in the same transaction as the inbound
          // events and peer cursor. The transport may ACK only after this transaction commits.
          const resourceIds = [...new Set(batch.events
            .filter((event) => event.entity === 'booking' && event.operation === 'upsert'
              && typeof event.payload?.resourceId === 'string')
            .map((event) => String(event.payload?.resourceId)))];
          const eventById = new Map<string, P2pEvent>();
                const conflictStore = tx.objectStore('p2pBookingConflicts');
          const finishConflictScan = (): void => {
            const conflicts = detectP2pBookingConflicts([...eventById.values()]);
            const applyResolution = (conflictId: string, done: () => void): void => {
              const conflictRequest = conflictStore.get(conflictId);
              conflictRequest.onsuccess = () => {
                const conflict = conflictRequest.result as BookingConflictSnapshot | undefined;
                if (!conflict || conflict.status !== 'pending') { done(); return; }
                const resolutionRequest = tx.objectStore('p2pEvents').index('workspaceEntity')
                  .getAll(IDBKeyRange.only([batch.workspaceId, 'booking_conflict', conflictId]));
                resolutionRequest.onsuccess = () => {
                  const state = getP2pRecordState(resolutionRequest.result as P2pEvent[]);
                  if (state.kind !== 'resolved') { done(); return; }
                  const event = state.event;
                  const payload = event.payload as Record<string, unknown>;
                  const expectedSourceIds = [conflict.firstEventId, conflict.secondEventId].sort();
                  const suppliedSourceIds = Array.isArray(payload.sourceEventIds)
                    ? (payload.sourceEventIds as unknown[]).filter((value): value is string => typeof value === 'string').sort()
                    : [];
                  const cancelledIds = Array.isArray(payload.cancelledBookingIds)
                    ? (payload.cancelledBookingIds as unknown[]).filter((value): value is string => typeof value === 'string')
                    : [];
                  const cancellationIds = Array.isArray(payload.cancellationEventIds)
                    ? (payload.cancellationEventIds as unknown[]).filter((value): value is string => typeof value === 'string')
                    : [];
                  const expectedCancelledIds = payload.decision === 'reject_both'
                    ? [conflict.firstBookingId, conflict.secondBookingId].sort()
                    : [conflict.firstBookingId === payload.chosenBookingId ? conflict.secondBookingId : conflict.firstBookingId];
                  const causallyIncludes = (sourceId: string): boolean => {
                    const separator = sourceId.lastIndexOf(':');
                    if (separator <= 0) return false;
                    const sourceNode = sourceId.slice(0, separator);
                    const sourceSequence = Number(sourceId.slice(separator + 1));
                    return Number.isSafeInteger(sourceSequence) && sourceSequence > 0
                      && (event.clock[sourceNode] ?? 0) >= sourceSequence;
                  };
                  const decision = payload.decision;
                  const chosenBookingId = payload.chosenBookingId;
                  const validDecision = decision === 'keep_booking'
                    ? (chosenBookingId === conflict.firstBookingId || chosenBookingId === conflict.secondBookingId)
                    : decision === 'reject_both' && chosenBookingId === null;
                  if (
                    payload.id !== conflict.id
                    || payload.conflictId !== conflict.id
                    || payload.actorNodeId !== event.nodeId
                    || typeof payload.reason !== 'string' || !payload.reason.trim() || payload.reason.length > 1000
                    || typeof payload.resolvedAt !== 'string'
                    || !validDecision
                    || suppliedSourceIds.length !== 2
                    || suppliedSourceIds[0] !== expectedSourceIds[0]
                    || suppliedSourceIds[1] !== expectedSourceIds[1]
                    || cancelledIds.length !== expectedCancelledIds.length
                    || expectedCancelledIds.some((id) => !cancelledIds.includes(id))
                    || cancellationIds.length !== expectedCancelledIds.length
                    || !expectedSourceIds.every(causallyIncludes)
                    || !cancellationIds.every(causallyIncludes)
                  ) { done(); return; }
                  let cancellationRemaining = cancellationIds.length;
                  let cancellationValid = true;
                  const commitResolution = (): void => {
                    if (cancellationRemaining !== 0) return;
                    if (!cancellationValid) { done(); return; }
                    conflictStore.put({
                      ...conflict,
                      status: decision === 'keep_booking' ? 'resolved' : 'rejected',
                      resolution: {
                        decision: decision as 'keep_booking' | 'reject_both',
                        chosenBookingId: chosenBookingId as string | null,
                        actorNodeId: event.nodeId,
                        reason: payload.reason as string,
                        resolvedAt: payload.resolvedAt as string,
                        eventId: event.eventId,
                      },
                    } satisfies BookingConflictSnapshot);
                    done();
                  };
                  for (let index = 0; index < cancellationIds.length; index += 1) {
                    const cancellationRequest = tx.objectStore('p2pEvents')
                      .get([batch.workspaceId, cancellationIds[index]]);
                    cancellationRequest.onsuccess = () => {
                      const cancellation = cancellationRequest.result as P2pEvent | undefined;
                      const expectedBookingId = expectedCancelledIds[index];
                      if (
                        !cancellation || cancellation.entity !== 'booking'
                        || cancellation.entityId !== expectedBookingId
                        || cancellation.operation !== 'upsert'
                        || cancellation.payload?.status !== 'cancelled'
                      ) cancellationValid = false;
                      const frontierRequest = tx.objectStore('p2pRecordFrontiers')
                        .get([batch.workspaceId, 'booking', expectedBookingId]);
                      frontierRequest.onsuccess = () => {
                        const frontier = frontierRequest.result as { status?: string; frontier?: P2pEvent[] } | undefined;
                        if (frontier?.status !== 'resolved'
                          || !frontier.frontier?.some((item) => item.eventId === cancellationIds[index])) {
                          cancellationValid = false;
                        }
                        cancellationRemaining -= 1;
                        commitResolution();
                      };
                      frontierRequest.onerror = abort;
                    };
                    cancellationRequest.onerror = abort;
                  }
                };
                resolutionRequest.onerror = abort;
              };
              conflictRequest.onerror = abort;
            };
            const applyPendingConflicts = (): void => {
              const pendingRequest = conflictStore.index('workspaceStatus')
                .getAll(IDBKeyRange.only([batch.workspaceId, 'pending']));
              pendingRequest.onsuccess = () => {
                const pendingIds = (pendingRequest.result as BookingConflictSnapshot[]).map((item) => item.id);
                const conflictIds = [...new Set([
                  ...conflicts.map((conflict) => conflict.id),
                  ...pendingIds,
                  ...batch.events.filter((event) => event.entity === 'booking_conflict').map((event) => event.entityId),
                ])];
                const applyResolutionNext = (index: number): void => {
                  if (index >= conflictIds.length) {
                    tx.objectStore('p2pPeerCursors').put({
                      workspaceId: batch.workspaceId,
                      peerId: batch.peerId,
                      cursor: batch.nextCursor,
                      updatedAt: new Date().toISOString(),
                    });
                    return;
                  }
                  applyResolution(conflictIds[index], () => applyResolutionNext(index + 1));
                };
                applyResolutionNext(0);
              };
              pendingRequest.onerror = abort;
            };
            const persistNext = (conflictIndex: number): void => {
              if (conflictIndex >= conflicts.length) {
                applyPendingConflicts();
                return;
              }
              const conflict = conflicts[conflictIndex];
              const existingRequest = conflictStore.get(conflict.id);
              existingRequest.onsuccess = () => {
                // Preserve any explicit resolution already recorded for this exact pair.
                if (!existingRequest.result) conflictStore.put(conflict);
                persistNext(conflictIndex + 1);
              };
              existingRequest.onerror = abort;
            };
            persistNext(0);
          };
          const pendingFrontiers: Array<{ entityId: string }> = [];
          const loadFrontier = (entityId: string, done: () => void): void => {
            const request = tx.objectStore('p2pRecordFrontiers').get([batch.workspaceId, 'booking', entityId]);
            request.onsuccess = () => {
              const row = request.result as { frontier?: P2pEvent[] } | undefined;
              for (const event of row?.frontier ?? []) eventById.set(event.eventId, event);
              done();
            };
            request.onerror = abort;
          };
          const loadRowsForResource = (index: number): void => {
            if (index >= resourceIds.length) {
              let remaining = pendingFrontiers.length;
              if (remaining === 0) { finishConflictScan(); return; }
              for (const row of pendingFrontiers) {
                loadFrontier(row.entityId, () => {
                  remaining -= 1;
                  if (remaining === 0) finishConflictScan();
                });
              }
              return;
            }
            const resourceId = resourceIds[index];
            const request = tx.objectStore('workspaceEntities').index('workspaceResource')
              .getAll(IDBKeyRange.only([batch.workspaceId, resourceId]));
            request.onsuccess = () => {
              for (const row of request.result as Array<{ entity: string; entityId: string }>) {
                if (row.entity === 'booking' && !pendingFrontiers.some((item) => item.entityId === row.entityId)) {
                  pendingFrontiers.push({ entityId: row.entityId });
                }
              }
              loadRowsForResource(index + 1);
            };
            request.onerror = abort;
          };
          for (const event of batch.events) {
            if (event.entity === 'booking') eventById.set(event.eventId, event);
            if (event.entity === 'booking' && !pendingFrontiers.some((item) => item.entityId === event.entityId)) {
              pendingFrontiers.push({ entityId: event.entityId });
            }
          }
          loadRowsForResource(0);
          return;
        }
        const record = records[index];
        const eventsRequest = tx.objectStore('p2pEvents').index('workspaceEntity')
          .getAll(IDBKeyRange.only([batch.workspaceId, record.entity, record.entityId]));
        eventsRequest.onsuccess = () => {
          const state = getP2pRecordState(eventsRequest.result as P2pEvent[]);
          if (state.kind === 'missing') {
            applyNext(records, index + 1);
            return;
          }
          const frontier = state.kind === 'resolved' ? [state.event] : state.events;
          const frontierStore = tx.objectStore('p2pRecordFrontiers');
          if (state.kind === 'conflict') {
            frontierStore.put({
              workspaceId: batch.workspaceId,
              entity: record.entity,
              entityId: record.entityId,
              status: 'conflict',
              frontier,
              appliedEventId: null,
              updatedAt: new Date().toISOString(),
            });
            report.conflicts += 1;
            applyNext(records, index + 1);
            return;
          }

          const outboxRequest = tx.objectStore('outbox').index('workspaceEntity')
            .getAll(IDBKeyRange.only([batch.workspaceId, record.entity, record.entityId]));
          outboxRequest.onsuccess = () => {
            const hasPending = (outboxRequest.result as OutboxRecord[])
              .some((item) => item.status === 'pending' || item.status === 'failed');
            if (hasPending) {
              frontierStore.put({
                workspaceId: batch.workspaceId,
                entity: record.entity,
                entityId: record.entityId,
                status: 'blocked_pending_local',
                frontier,
                appliedEventId: null,
                updatedAt: new Date().toISOString(),
              });
              report.blockedByPendingLocal += 1;
              applyNext(records, index + 1);
              return;
            }
            const previousRequest = frontierStore.get([batch.workspaceId, record.entity, record.entityId]);
            previousRequest.onsuccess = () => {
              const previous = previousRequest.result as { appliedEventId?: string; status?: string } | undefined;
              const apply = () => this.applyIndexedDbP2pProjection(tx, state.event, () => {
                frontierStore.put({
                  workspaceId: batch.workspaceId,
                  entity: record.entity,
                  entityId: record.entityId,
                  status: 'resolved',
                  frontier,
                  appliedEventId: state.event.eventId,
                  updatedAt: new Date().toISOString(),
                });
                report.appliedRecords += 1;
                applyNext(records, index + 1);
              }, abort);
              if (previous?.status === 'resolved' && previous.appliedEventId === state.event.eventId) {
                applyNext(records, index + 1);
              } else {
                apply();
              }
            };
            previousRequest.onerror = abort;
          };
          outboxRequest.onerror = abort;
        };
        eventsRequest.onerror = abort;
      };

      appendNext(0);
    };
    cursorRequest.onerror = abort;

    await waitForTransactionCompletion(tx, 'applyReceivedP2pBatch');
    return report;
  }

  /** Resolve one cross-device booking conflict and replicate the decision as an immutable P2P event. */
  public async resolveP2pBookingConflict(
    workspaceId: string,
    conflictId: string,
    decision: 'keep_booking' | 'reject_both',
    chosenBookingId: string | null,
    actorId: string,
    reason: string,
  ): Promise<BookingConflictSnapshot> {
    if (!workspaceId.trim() || !conflictId.trim() || !actorId.trim() || !reason.trim() || reason.length > 1000) {
      throw new Error('Workspace, conflict, actor and a resolution reason are required.');
    }
    if (decision === 'keep_booking' && !chosenBookingId) {
      throw new Error('A booking must be selected when resolving with keep_booking.');
    }
    if (decision === 'reject_both' && chosenBookingId !== null) {
      throw new Error('reject_both must not select a booking.');
    }
    await this.openStore();
    if (!this.idb) throw new Error('P2P conflict resolution requires IndexedDB.');
    const nodeId = await this.getP2pNodeId();
    const tx = this.createStrictTransaction([
      'p2pBookingConflicts', 'p2pMeta', 'p2pClock', 'p2pEvents',
      'p2pTransportQueue', 'p2pRecordFrontiers', 'bookings', 'workspaceEntities', 'outbox',
    ]);
    let validationError: Error | null = null;
    let resolved: BookingConflictSnapshot | undefined;
    const store = tx.objectStore('p2pBookingConflicts');
    const request = store.get(conflictId);
    request.onsuccess = () => {
      const conflict = request.result as BookingConflictSnapshot | undefined;
      if (!conflict || conflict.workspaceId !== workspaceId) {
        validationError = new Error('Booking conflict was not found in this workspace.');
        tx.abort();
        return;
      }
      if (conflict.status !== 'pending') {
        validationError = new Error('Booking conflict has already been resolved.');
        tx.abort();
        return;
      }
      if (decision === 'keep_booking'
        && chosenBookingId !== conflict.firstBookingId && chosenBookingId !== conflict.secondBookingId) {
        validationError = new Error('Selected booking is not part of this conflict.');
        tx.abort();
        return;
      }
      const sourceIds = [conflict.firstEventId, conflict.secondEventId];
      let remaining = sourceIds.length;
      let sourceMissing = false;
      const sourceEvents: P2pEvent[] = [];
      const createResolution = (): void => {
        if (remaining !== 0) return;
        if (sourceMissing || sourceEvents.length !== 2) {
          validationError = new Error('Both source booking events must be present before resolving the conflict.');
          tx.abort();
          return;
        }
        const resolvedAt = new Date().toISOString();
        const cancellationEventIds: string[] = [];
        const appendResolutionEvent = (): void => {
          const payload = {
            id: conflict.id,
            conflictId: conflict.id,
            decision,
            chosenBookingId,
            actorNodeId: nodeId,
            actorId,
            reason: reason.trim(),
            resolvedAt,
            sourceEventIds: sourceIds,
            cancellationEventIds,
            cancelledBookingIds: bookingsToCancel,
          };
          this.appendLocalP2pEvent(
            tx, workspaceId, 'booking_conflict', conflict.id, 'upsert', payload, resolvedAt,
            (event) => {
              if (!event) { tx.abort(); return; }
              resolved = {
                ...conflict,
                status: decision === 'keep_booking' ? 'resolved' : 'rejected',
                resolution: {
                  decision,
                  chosenBookingId,
                  actorNodeId: nodeId,
                  reason: reason.trim(),
                  resolvedAt,
                  eventId: event.eventId,
                },
              };
              store.put(resolved);
            },
          );
        };
        const bookingsToCancel = decision === 'reject_both'
          ? [conflict.firstBookingId, conflict.secondBookingId]
          : [conflict.firstBookingId === chosenBookingId ? conflict.secondBookingId : conflict.firstBookingId];
        const cancelNext = (index: number): void => {
          if (index >= bookingsToCancel.length) { appendResolutionEvent(); return; }
          const bookingId = bookingsToCancel[index];
          const bookingRequest = tx.objectStore('bookings').get(bookingId);
          const entityRequest = tx.objectStore('workspaceEntities').get([workspaceId, 'booking', bookingId]);
          const frontierRequest = tx.objectStore('p2pRecordFrontiers').get([workspaceId, 'booking', bookingId]);
          let bookingRecord: Record<string, unknown> | undefined;
          let entityRecord: { version?: number; establishmentId?: string } | undefined;
          let frontierRecord: { status?: string; frontier?: P2pEvent[] } | undefined;
          let ready = 0;
          const applyCancellation = (): void => {
            ready += 1;
            if (ready !== 3) return;
            if (!bookingRecord || bookingRecord.workspaceId !== workspaceId) {
              validationError = new Error(`Booking ${bookingId} is unavailable in this workspace; conflict resolution was not applied.`);
              tx.abort();
              return;
            }
            if (frontierRecord?.status !== 'resolved') {
              validationError = new Error(`Booking ${bookingId} has an unresolved record frontier; resolve that record first.`);
              tx.abort();
              return;
            }
            if (bookingRecord.status === 'cancelled') {
              const existingCancellation = frontierRecord.frontier?.find((event) =>
                event.entity === 'booking' && event.entityId === bookingId
                && event.operation === 'upsert' && event.payload?.status === 'cancelled'
              );
              if (!existingCancellation) {
                validationError = new Error(`Booking ${bookingId} is cancelled but has no durable cancellation event.`);
                tx.abort();
                return;
              }
              cancellationEventIds.push(existingCancellation.eventId);
              cancelNext(index + 1);
              return;
            }
            const version = Math.max(entityRecord?.version ?? 0, Number(bookingRecord.syncVersion ?? 0)) + 1;
            const establishmentId = entityRecord?.establishmentId
              ?? (typeof bookingRecord.establishmentId === 'string' ? bookingRecord.establishmentId : undefined);
            const cancelledPayload = { ...bookingRecord, status: 'cancelled', syncVersion: version };
            tx.objectStore('bookings').put(cancelledPayload);
            tx.objectStore('workspaceEntities').put({
              workspaceId, establishmentId, entity: 'booking', entityId: bookingId,
              version, updatedAt: resolvedAt, payload: cancelledPayload,
            });
            tx.objectStore('outbox').add(this.createOutboxRecord(
              { workspaceId, establishmentId }, 'booking', bookingId, 'upsert', version,
              cancelledPayload, resolvedAt,
            ));
            this.appendLocalP2pEvent(
              tx, workspaceId, 'booking', bookingId, 'upsert', cancelledPayload, resolvedAt,
              (event) => {
                if (!event) { tx.abort(); return; }
                cancellationEventIds.push(event.eventId);
                cancelNext(index + 1);
              },
            );
          };
          bookingRequest.onsuccess = () => {
            bookingRecord = bookingRequest.result as Record<string, unknown> | undefined;
            applyCancellation();
          };
          entityRequest.onsuccess = () => {
            entityRecord = entityRequest.result as typeof entityRecord;
            applyCancellation();
          };
          frontierRequest.onsuccess = () => {
            frontierRecord = frontierRequest.result as typeof frontierRecord;
            applyCancellation();
          };
          bookingRequest.onerror = () => tx.abort();
          entityRequest.onerror = () => tx.abort();
          frontierRequest.onerror = () => tx.abort();
        };
        cancelNext(0);
      };
      for (const sourceId of sourceIds) {
        const sourceRequest = tx.objectStore('p2pEvents').get([workspaceId, sourceId]);
        sourceRequest.onsuccess = () => {
          if (!sourceRequest.result) sourceMissing = true;
          else sourceEvents.push(sourceRequest.result as P2pEvent);
          remaining -= 1;
          createResolution();
        };
        sourceRequest.onerror = () => tx.abort();
      }
    };
    request.onerror = () => tx.abort();
    try {
      await waitForTransactionCompletion(tx, 'resolveP2pBookingConflict');
    } catch (error) {
      if (validationError) throw validationError;
      throw error;
    }
    if (!resolved) throw new Error('Booking conflict resolution did not commit.');
    this.emitOutboxChange();
    return resolved;
  }

  /** List durable cross-ID booking conflicts for the conflict-resolution UI. */
  public async getP2pBookingConflicts(
    workspaceId: string,
    status?: 'pending' | 'resolved' | 'rejected',
    limit = 200,
  ): Promise<BookingConflictSnapshot[]> {
    if (!workspaceId.trim()) return [];
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
      throw new Error('P2P booking conflict page limit must be between 1 and 1000.');
    }
    await this.openStore();
    if (!this.idb) throw new Error('P2P conflict registry requires IndexedDB.');
    const tx = this.idb.transaction('p2pBookingConflicts', 'readonly');
    const range = IDBKeyRange.bound([workspaceId, ''], [workspaceId, '\uffff']);
    const request = tx.objectStore('p2pBookingConflicts').index('workspaceDetectedAt').openCursor(range, 'prev');
    const rows = await new Promise<BookingConflictSnapshot[]>((resolve, reject) => {
      const result: BookingConflictSnapshot[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || result.length >= limit) { resolve(result); return; }
        const item = cursor.value as BookingConflictSnapshot;
        if (!status || item.status === status) result.push(item);
        cursor.continue();
      };
      request.onerror = () => reject(request.error ?? new Error('Unable to read P2P booking conflicts.'));
    });
    await waitForTransactionCompletion(tx, 'getP2pBookingConflicts');
    return rows;
  }

  private applyIndexedDbP2pProjection(
    tx: IDBTransaction,
    event: P2pEvent,
    done: () => void,
    abort: () => void,
  ): void {
    const workspaceEntities = tx.objectStore('workspaceEntities');
    const tombstones = tx.objectStore('tombstones');
    const entity = event.entity as P2pEntity;
    const tombstoneId = `${event.workspaceId}:${entity}:${event.entityId}`;
    const entityRequest = workspaceEntities.get([event.workspaceId, entity, event.entityId]);
    const tombstoneRequest = tombstones.get(tombstoneId);
    const storeName = entity === 'booking' ? 'bookings'
      : entity === 'resource' ? 'resources'
        : entity === 'invoice' ? 'invoices'
          : entity === 'resource_group' ? 'resourceGroups'
            : undefined;
    let currentEntity: { version?: number; establishmentId?: string } | undefined;
    let currentTombstone: TombstoneRecord | undefined;
    let currentOperational: Record<string, unknown> | undefined;
    let entityReady = false;
    let tombstoneReady = false;
    let operationalReady = !storeName;

    const commit = () => {
      if (!entityReady || !tombstoneReady || !operationalReady) return;
      if (currentOperational && currentOperational.workspaceId !== event.workspaceId) {
        abort();
        return;
      }
      const version = Math.max(currentEntity?.version ?? 0, currentTombstone?.version ?? 0) + 1;
      const establishmentId = currentEntity?.establishmentId
        ?? (typeof event.payload?.establishmentId === 'string' ? event.payload.establishmentId : undefined);
      if (event.operation === 'upsert') {
        if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)
          || event.payload.id !== event.entityId) {
          abort();
          return;
        }
        const persisted = {
          ...event.payload,
          workspaceId: event.workspaceId,
          establishmentId,
          syncVersion: version,
          deletedAt: null,
        };
        workspaceEntities.put({
          workspaceId: event.workspaceId,
          establishmentId,
          entity,
          entityId: event.entityId,
          version,
          updatedAt: event.createdAt,
          payload: persisted,
        });
        if (storeName) tx.objectStore(storeName).put(persisted);
        tombstones.delete(tombstoneId);
      } else {
        if (storeName) tx.objectStore(storeName).delete(event.entityId);
        workspaceEntities.delete([event.workspaceId, entity, event.entityId]);
        tombstones.put({
          id: tombstoneId,
          workspaceId: event.workspaceId,
          establishmentId,
          entity,
          entityId: event.entityId,
          version,
          deletedAt: event.createdAt,
        } satisfies TombstoneRecord);
      }
      done();
    };

    entityRequest.onsuccess = () => {
      currentEntity = entityRequest.result as typeof currentEntity;
      entityReady = true;
      commit();
    };
    tombstoneRequest.onsuccess = () => {
      currentTombstone = tombstoneRequest.result as TombstoneRecord | undefined;
      tombstoneReady = true;
      commit();
    };
    entityRequest.onerror = abort;
    tombstoneRequest.onerror = abort;
    if (storeName) {
      const operationalRequest = tx.objectStore(storeName).get(event.entityId);
      operationalRequest.onsuccess = () => {
        currentOperational = operationalRequest.result as Record<string, unknown> | undefined;
        operationalReady = true;
        commit();
      };
      operationalRequest.onerror = abort;
    }
  }

  /**
   * Use strict durability for every business/Outbox/P2P write transaction.
   * Fail closed instead of silently falling back to relaxed durability.
   */
  private createStrictTransaction(storeNames: string[]): IDBTransaction {
    if (!this.idb) throw new Error('Strict durable transaction requires IndexedDB.');
    try {
      return this.idb.transaction(storeNames, 'readwrite', { durability: 'strict' });
    } catch (error) {
      throw new Error(
        `Strict IndexedDB durability is unavailable; refusing a replication write: ${String(error)}`,
      );
    }
  }

  /** Stable per-installation node identity shared with Android multicast discovery. */
  public async getP2pNodeId(): Promise<string> {
    await this.openStore();
    if (!this.idb) throw new Error('P2P persistence requires IndexedDB.');
    const candidate = supportsNativeLanDiscovery()
      ? await getNativeLanNodeIdentity()
      : this.createId();
    const tx = this.createStrictTransaction(['p2pMeta']);
    let resolvedNodeId: string | undefined;
    const request = tx.objectStore('p2pMeta').get('nodeId');
    request.onsuccess = () => {
      const existing = (request.result as { value?: string } | undefined)?.value;
      resolvedNodeId = existing || candidate;
      if (!existing) tx.objectStore('p2pMeta').add({ key: 'nodeId', value: candidate });
    };
    request.onerror = () => tx.abort();
    await waitForTransactionCompletion(tx, 'getP2pNodeId');
    if (!resolvedNodeId) throw new Error('Could not persist the local P2P node identity.');
    return resolvedNodeId;
  }

  /** Read the durable establishment device registry from the local P2P metadata store. */
  public async getDeviceRegistry(
    workspaceId: string,
    establishmentId: string,
  ): Promise<DeviceRegistry | null> {
    if (!workspaceId.trim() || !establishmentId.trim()) {
      throw new Error('Device registry scope is required.');
    }
    await this.openStore();
    if (!this.idb) throw new Error('Device registry requires durable IndexedDB storage.');
    const tx = this.idb.transaction(['p2pMeta'], 'readonly');
    const key = `deviceRegistry:${workspaceId}:${establishmentId}`;
    const request = tx.objectStore('p2pMeta').get(key);
    const value = await new Promise<DeviceRegistry | null>((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as { value?: DeviceRegistry } | undefined)?.value ?? null);
      request.onerror = () => reject(request.error ?? new Error('Device registry read failed.'));
    });
    await waitForTransactionCompletion(tx, 'getDeviceRegistry');
    if (value) {
      validateDeviceRegistry(value);
      if (value.workspaceId !== workspaceId || value.establishmentId !== establishmentId) {
        throw new Error('Stored device registry scope mismatch.');
      }
    }
    return value;
  }

  /**
   * Persist a registry with compare-and-swap epoch protection.
   * expectedEpoch=null creates a registry only when none exists; otherwise the
   * supplied epoch must match the current value and the new epoch must be +1.
   */
  public async putDeviceRegistry(
    registry: DeviceRegistry,
    expectedEpoch: number | null,
  ): Promise<void> {
    validateDeviceRegistry(registry);
    await this.openStore();
    if (!this.idb) throw new Error('Device registry requires durable IndexedDB storage.');
    const key = `deviceRegistry:${registry.workspaceId}:${registry.establishmentId}`;
    const tx = this.createStrictTransaction(['p2pMeta']);
    const store = tx.objectStore('p2pMeta');
    const request = store.get(key);
    let validationError: Error | null = null;
    request.onsuccess = () => {
      const current = (request.result as { value?: DeviceRegistry } | undefined)?.value ?? null;
      if (expectedEpoch === null) {
        if (current) validationError = new Error('Device registry already exists; refusing overwrite.');
        else if (registry.epoch !== 1) validationError = new Error('Initial device registry epoch must be 1.');
      } else if (!current || current.epoch !== expectedEpoch || registry.epoch !== expectedEpoch + 1) {
        validationError = new Error('Device registry epoch changed; reload before retrying.');
      }
      if (validationError) {
        tx.abort();
        return;
      }
      store.put({ key, value: registry });
    };
    request.onerror = () => tx.abort();
    try {
      await waitForTransactionCompletion(tx, 'putDeviceRegistry');
    } catch (error) {
      if (validationError) throw validationError;
      throw error;
    }
  }

  /**
   * Read the next bounded page of immutable events not yet durably acknowledged by a peer.
   * The offered cursor is persisted before the page is returned, so ACKs cannot skip
   * arbitrary event ranges or acknowledge a page that was never offered.
   */
  public async getP2pOutboundPage(
    workspaceId: string,
    peerId: string,
    limit = 100,
  ): Promise<P2pOutboundPage> {
    if (!workspaceId.trim() || !peerId.trim() || !Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
      throw new Error('Invalid P2P outbound page scope or limit.');
    }
    await this.openStore();
    if (!this.idb) throw new Error('P2P outbound paging requires IndexedDB.');
    const localNodeId = await this.getP2pNodeId();
    const tx = this.createStrictTransaction(['p2pPeerAcks', 'p2pTransportQueue']);
    const ackStore = tx.objectStore('p2pPeerAcks');
    const queueIndex = tx.objectStore('p2pTransportQueue').index('workspaceOrder');
    let result: P2pOutboundPage | undefined;
    const ackRequest = ackStore.get([workspaceId, peerId]);
    ackRequest.onsuccess = () => {
      const ack = ackRequest.result as { cursor?: number } | undefined;
      const expectedCursor = ack?.cursor ?? 0;
      const events: P2pEvent[] = [];
      let nextCursor = expectedCursor;
      let hasMore = false;
      let pageBytes = 0;
      let scannedCount = 0;
      const finish = () => {
        ackStore.put({
          workspaceId, peerId, cursor: expectedCursor,
          offeredCursor: nextCursor, updatedAt: new Date().toISOString(),
        });
        result = { workspaceId, peerId, expectedCursor, nextCursor, events, hasMore };
      };
      const range = IDBKeyRange.bound(
        [workspaceId, expectedCursor + 1],
        [workspaceId, Number.MAX_SAFE_INTEGER],
      );
      const cursorRequest = queueIndex.openCursor(range);
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          finish();
          return;
        }
        if (scannedCount >= 1000) {
          hasMore = true;
          finish();
          return;
        }
        scannedCount += 1;
        const row = cursor.value as { workspaceId: string; event: P2pEvent };
        if (row.event.nodeId !== localNodeId) {
          nextCursor = Number((cursor.key as IDBValidKey[])[1]);
          cursor.continue();
          return;
        }
        const eventBytes = new TextEncoder().encode(JSON.stringify(row.event)).byteLength;
        if (eventBytes > 1024 * 1024) {
          tx.abort();
          return;
        }
        if (events.length >= limit || (events.length > 0 && pageBytes + eventBytes > MAX_P2P_BATCH_BYTES)) {
          hasMore = true;
          finish();
          return;
        }
        events.push(row.event);
        pageBytes += eventBytes;
        nextCursor = Number((cursor.key as IDBValidKey[])[1]);
        cursor.continue();
      };
      cursorRequest.onerror = () => tx.abort();
    };
    ackRequest.onerror = () => tx.abort();
    await waitForTransactionCompletion(tx, 'getP2pOutboundPage');
    if (!result) throw new Error('P2P outbound page could not be read.');
    return result;
  }

  /** Advance one peer's outbound cursor only for the exact page offered to it. */
  public async acknowledgeP2pOutboundPage(
    workspaceId: string,
    peerId: string,
    expectedCursor: number,
    nextCursor: number,
  ): Promise<void> {
    if (!workspaceId.trim() || !peerId.trim()
      || !Number.isSafeInteger(expectedCursor) || expectedCursor < 0
      || !Number.isSafeInteger(nextCursor) || nextCursor < expectedCursor) {
      throw new Error('Invalid P2P outbound acknowledgement.');
    }
    await this.openStore();
    if (!this.idb) throw new Error('P2P acknowledgement requires IndexedDB.');
    const tx = this.createStrictTransaction(['p2pPeerAcks', 'p2pTransportQueue']);
    const ackStore = tx.objectStore('p2pPeerAcks');
    let validationError: Error | null = null;
    const abortWith = (message: string) => {
      validationError = new Error(message);
      try { tx.abort(); } catch { /* transaction already inactive */ }
    };
    const ackRequest = ackStore.get([workspaceId, peerId]);
    ackRequest.onsuccess = () => {
      const ack = ackRequest.result as { cursor?: number; offeredCursor?: number } | undefined;
      const currentCursor = ack?.cursor ?? 0;
      if (currentCursor !== expectedCursor
        || !validateP2pAckAdvance(expectedCursor, ack?.offeredCursor ?? -1, nextCursor)) {
        abortWith('P2P acknowledgement does not match the current offered page.');
        return;
      }
      if (nextCursor === expectedCursor) return;
      const queueRequest = tx.objectStore('p2pTransportQueue').get(nextCursor);
      queueRequest.onsuccess = () => {
        const row = queueRequest.result as { workspaceId?: string } | undefined;
        if (!row || row.workspaceId !== workspaceId) {
          abortWith('P2P acknowledgement cursor does not identify an offered event in this workspace.');
          return;
        }
        ackStore.put({
          workspaceId, peerId, cursor: nextCursor, updatedAt: new Date().toISOString(),
        });
      };
      queueRequest.onerror = () => abortWith('Could not verify the acknowledged P2P event.');
    };
    ackRequest.onerror = () => abortWith('Could not read the current P2P acknowledgement cursor.');
    try {
      await waitForTransactionCompletion(tx, 'acknowledgeP2pOutboundPage');
    } catch (error) {
      if (validationError) throw validationError;
      throw error;
    }
  }

  /** Backfill an event for a legacy Outbox intent without duplicating an exact event. */
  private ensureP2pEventForOutbox(tx: IDBTransaction, record: OutboxRecord): void {
    const request = tx.objectStore('p2pEvents').index('workspaceEntity')
      .getAll(IDBKeyRange.only([record.workspaceId, record.entity, record.entityId]));
    request.onsuccess = () => {
      const events = request.result as P2pEvent[];
      const exists = events.some((event) =>
        event.createdAt === record.createdAt
        && event.operation === record.operation
        && stableSerialize(event.payload) === stableSerialize(record.payload)
      );
      if (!exists) {
        this.appendLocalP2pEvent(
          tx,
          record.workspaceId,
          record.entity,
          record.entityId,
          record.operation,
          record.payload,
          record.createdAt,
        );
      }
    };
    request.onerror = () => tx.abort();
  }

  /**
   * Reconcile a full UI snapshot without inferring deletions from absence.
   * Each changed row, Outbox intent and P2P event is committed atomically; batches
   * are bounded and event creation is serialized to preserve vector-clock sequence.
   */
  public async reconcileSnapshotWithOutbox<T extends { id: string }>(
    storeName: 'bookings' | 'resources' | 'resourceGroups',
    items: readonly T[],
    entity: OutboxEntity,
    contextForItem: (item: T) => OutboxMutationContext,
    excludedIds: ReadonlySet<string> = new Set(),
  ): Promise<{ queued: number; unchanged: number; blocked: number }> {
    await this.openStore();
    if (!this.idb) {
      throw new Error('Snapshot reconciliation requires IndexedDB; localStorage fallback is not safe for P2P.');
    }
    const expectedEntity = storeName === 'bookings' ? 'booking'
      : storeName === 'resources' ? 'resource'
        : 'resource_group';
    if (entity !== expectedEntity) {
      throw new Error(`Store/entity mismatch: ${storeName} cannot reconcile as ${entity}.`);
    }
    const seenIds = new Set<string>();
    for (const item of items) {
      if (seenIds.has(item.id)) throw new Error(`Duplicate entity ID in snapshot: ${item.id}`);
      seenIds.add(item.id);
    }
    const report = { queued: 0, unchanged: 0, blocked: 0 };
    const chunkSize = 100;
    for (let offset = 0; offset < items.length; offset += chunkSize) {
      const chunk = items.slice(offset, offset + chunkSize).filter((item) =>
        Boolean(item.id?.trim()) && !excludedIds.has(item.id)
      );
      if (chunk.length === 0) continue;
      const prepared: Array<{
        item: T;
        context: OutboxMutationContext;
        current?: { version?: number; establishmentId?: string; updatedAt?: string; payload?: Record<string, unknown> };
        tombstone?: TombstoneRecord;
        frontier?: { status?: string };
      }> = chunk.map((item) => ({
        item,
        context: contextForItem(item),
      }));
      await this.getP2pNodeId();
      const tx = this.createStrictTransaction([
        storeName,
        'workspaceEntities',
        'tombstones',
        'outbox',
        'p2pEvents',
        'p2pTransportQueue',
        'p2pClock',
        'p2pMeta',
        'p2pRecordFrontiers',
      ]);
      const store = tx.objectStore(storeName);
      const workspaceEntities = tx.objectStore('workspaceEntities');
      const tombstones = tx.objectStore('tombstones');
      const frontiers = tx.objectStore('p2pRecordFrontiers');
      let readyCount = 0;
      const abort = () => { try { tx.abort(); } catch { /* already inactive */ } };

      const processNext = (index: number): void => {
        if (index >= prepared.length) return;
        const entry = prepared[index];
        const itemWorkspaceId = (entry.item as T & { workspaceId?: string }).workspaceId;
        if (!entry.context.workspaceId.trim() || itemWorkspaceId !== entry.context.workspaceId) {
          // Never copy an unscoped or another workspace's row into the active workspace.
          report.blocked += 1;
          processNext(index + 1);
          return;
        }
        if (entry.frontier?.status === 'conflict' || entry.frontier?.status === 'blocked_pending_local') {
          report.blocked += 1;
          processNext(index + 1);
          return;
        }
        if (entry.tombstone && !entry.current) {
          // A snapshot cannot resurrect a tombstoned row. Restoration must be an explicit mutation.
          report.blocked += 1;
          processNext(index + 1);
          return;
        }
        const baseItem = storeName === 'bookings'
          ? (migrateBookingRecordV7(entry.item as Partial<TimelineBooking>) as T)
          : entry.item;
        const establishmentId = entry.context.establishmentId
          ?? entry.current?.establishmentId
          ?? (baseItem as T & { establishmentId?: string }).establishmentId;
        const candidate = {
          ...baseItem,
          workspaceId: entry.context.workspaceId,
          deletedAt: null,
        } as T & Record<string, unknown>;
        const candidateRecord = candidate as Record<string, unknown>;
        if (establishmentId) candidateRecord.establishmentId = establishmentId;
        else delete candidateRecord.establishmentId;
        const currentPayload = entry.current?.payload;
        if (
          entry.current
          && !entry.tombstone
          && currentPayload
          && stableSerialize(businessPayloadForComparison(currentPayload))
            === stableSerialize(businessPayloadForComparison(candidate))
        ) {
          store.put(currentPayload as T);
          if (entry.frontier?.status === 'resolved') {
            report.unchanged += 1;
            processNext(index + 1);
            return;
          }
          // Backfill the P2P frontier for pre-v8 rows without changing business data.
          this.appendLocalP2pEvent(
            tx,
            entry.context.workspaceId,
            entity,
            entry.item.id,
            'upsert',
            currentPayload,
            entry.current.updatedAt ?? new Date().toISOString(),
            () => {
              report.queued += 1;
              report.unchanged += 1;
              processNext(index + 1);
            },
          );
          return;
        }

        const version = Math.max(entry.current?.version ?? 0, entry.tombstone?.version ?? 0) + 1;
        const now = new Date().toISOString();
        const persisted = { ...candidate, syncVersion: version };
        const effectiveContext = {
          workspaceId: entry.context.workspaceId,
          establishmentId,
        };
        workspaceEntities.put({
          workspaceId: entry.context.workspaceId,
          establishmentId,
          entity,
          entityId: entry.item.id,
          version,
          updatedAt: now,
          payload: persisted,
        });
        store.put(persisted);
        tombstones.delete(`${entry.context.workspaceId}:${entity}:${entry.item.id}`);
        tx.objectStore('outbox').add(
          this.createOutboxRecord(
            effectiveContext,
            entity,
            entry.item.id,
            'upsert',
            version,
            persisted as Record<string, unknown>,
            now,
          ),
        );
        this.appendLocalP2pEvent(
          tx,
          entry.context.workspaceId,
          entity,
          entry.item.id,
          'upsert',
          persisted as Record<string, unknown>,
          now,
          () => {
            report.queued += 1;
            processNext(index + 1);
          },
        );
      };

      prepared.forEach((entry) => {
        const tombstoneId = `${entry.context.workspaceId}:${entity}:${entry.item.id}`;
        const requests = [
          workspaceEntities.get([entry.context.workspaceId, entity, entry.item.id]),
          tombstones.get(tombstoneId),
          frontiers.get([entry.context.workspaceId, entity, entry.item.id]),
        ];
        requests[0].onsuccess = () => {
          entry.current = requests[0].result as typeof entry.current;
          readyCount += 1;
          if (readyCount === prepared.length * 3) processNext(0);
        };
        requests[1].onsuccess = () => {
          entry.tombstone = requests[1].result as TombstoneRecord | undefined;
          readyCount += 1;
          if (readyCount === prepared.length * 3) processNext(0);
        };
        requests[2].onsuccess = () => {
          entry.frontier = requests[2].result as typeof entry.frontier;
          readyCount += 1;
          if (readyCount === prepared.length * 3) processNext(0);
        };
        requests.forEach((request) => { request.onerror = abort; });
      });

      await waitForTransactionCompletion(tx, `reconcileSnapshotWithOutbox ${entity}`);
    }
    this.emitOutboxChange();
    return report;
  }

  /**
   * Append a local immutable P2P event and advance every observed vector-clock component
   * inside the caller's existing business+Outbox IndexedDB transaction.
   */
  private appendLocalP2pEvent(
    tx: IDBTransaction,
    workspaceId: string,
    entity: P2pEntity,
    entityId: string,
    operation: P2pOperation,
    payload: Record<string, unknown> | null,
    createdAt: string,
    onQueued?: (event?: P2pEvent) => void,
  ): void {
    const metaStore = tx.objectStore('p2pMeta');
    const clockStore = tx.objectStore('p2pClock');
    let nodeId: string | undefined;
    let clockRows: Array<{ workspaceId: string; nodeId: string; sequence: number }> = [];
    let metaReady = false;
    let clockReady = false;
    let frontierReady = false;
    let currentFrontier: { status?: string } | undefined;

    const finish = () => {
      if (!metaReady || !clockReady || !frontierReady) return;
      if (currentFrontier?.status === 'conflict' || currentFrontier?.status === 'blocked_pending_local') {
        tx.abort();
        return;
      }
      try {
        if (!nodeId) {
          tx.abort();
          return;
        }
        const observed = Object.fromEntries(clockRows.map((row) => [row.nodeId, row.sequence]));
        const event = createP2pEvent({
          nodeId,
          workspaceId,
          entity,
          entityId,
          operation,
          payload,
          createdAt,
          observedClock: observed,
        });
        tx.objectStore('p2pEvents').add(event);
        tx.objectStore('p2pTransportQueue').add({ workspaceId, event });
        tx.objectStore('p2pRecordFrontiers').put({
          workspaceId,
          entity,
          entityId,
          status: 'resolved',
          frontier: [event],
          appliedEventId: event.eventId,
          updatedAt: createdAt,
        });
        for (const [clockNodeId, sequence] of Object.entries(event.clock)) {
          clockStore.put({ workspaceId, nodeId: clockNodeId, sequence });
        }
        onQueued?.(event);
      } catch (error) {
        tx.abort();
        throw error;
      }
    };

    const metaRequest = metaStore.get('nodeId');
    metaRequest.onsuccess = () => {
      nodeId = (metaRequest.result as { value?: string } | undefined)?.value;
      metaReady = true;
      finish();
    };
    metaRequest.onerror = () => tx.abort();

    const frontierRequest = tx.objectStore('p2pRecordFrontiers').get([workspaceId, entity, entityId]);
    frontierRequest.onsuccess = () => {
      currentFrontier = frontierRequest.result as { status?: string } | undefined;
      frontierReady = true;
      finish();
    };
    frontierRequest.onerror = () => tx.abort();

    const clockRequest = clockStore.index('workspaceId').getAll(workspaceId);
    clockRequest.onsuccess = () => {
      clockRows = clockRequest.result as Array<{ workspaceId: string; nodeId: string; sequence: number }>;
      clockReady = true;
      finish();
    };
    clockRequest.onerror = () => tx.abort();
  }

  /** Opt-in only: demo/bootstrap data must never call this method. */
  public async putWithOutbox<T extends { id: string }>(
    storeName: 'bookings' | 'resources' | 'resourceGroups', item: T,
    context: OutboxMutationContext, entity: OutboxEntity,
    validateCurrentBookings?: (bookings: TimelineBooking[]) => void,
  ): Promise<void> {
    if (entity !== expectedOutboxEntityForStore(storeName)) {
      throw new Error(`Store/entity mismatch: ${storeName} cannot be queued as ${entity}.`);
    }
    if (!context.workspaceId.trim()) throw new Error('Workspace isolation required for outbox writes.');
    await this.openStore();
    if (!this.idb) throw new Error('Transactional outbox requires IndexedDB; localStorage fallback is not safe for cloud sync.');
    await this.getP2pNodeId();
    const tx = this.createStrictTransaction([storeName, 'outbox', 'tombstones', 'workspaceEntities', 'p2pEvents', 'p2pTransportQueue', 'p2pClock', 'p2pMeta', 'p2pRecordFrontiers']);
    const store = tx.objectStore(storeName);
    const workspaceEntities = tx.objectStore('workspaceEntities');
    const tombstones = tx.objectStore('tombstones');
    const tombstoneId = `${context.workspaceId}:${entity}:${item.id}`;
    const request = workspaceEntities.get([context.workspaceId, entity, item.id]);
    const tombstoneRequest = tombstones.get(tombstoneId);
    let current: { version?: number; establishmentId?: string; payload?: Record<string, unknown> } | undefined;
    let previousTombstone: TombstoneRecord | undefined;
    let entityReady = false;
    let tombstoneReady = false;
    let bookingRowsReady = !validateCurrentBookings;
    let currentBookingRows: TimelineBooking[] = [];
    let validationError: Error | null = null;
    const commitMutation = () => {
      if (!entityReady || !tombstoneReady || !bookingRowsReady) return;
      if (validateCurrentBookings) {
        try {
          validateCurrentBookings(currentBookingRows);
        } catch (error) {
          validationError = error instanceof Error ? error : new Error(String(error));
          tx.abort();
          return;
        }
      }
      const baseItem =
        storeName === 'bookings'
          ? (migrateBookingRecordV7(item as Partial<TimelineBooking>) as T)
          : item;
      const establishmentId = context.establishmentId
        ?? current?.establishmentId
        ?? (baseItem as T & { establishmentId?: string }).establishmentId;
      const candidate = {
        ...baseItem,
        workspaceId: context.workspaceId,
        ...(establishmentId ? { establishmentId } : {}),
        deletedAt: null,
      } as T & Record<string, unknown>;
      if (
        current?.payload
        && !previousTombstone
        && stableSerialize(businessPayloadForComparison(current.payload))
          === stableSerialize(businessPayloadForComparison(candidate))
      ) {
        store.put(current.payload as T);
        return;
      }
      const version = Math.max(current?.version ?? 0, previousTombstone?.version ?? 0) + 1;
      const now = new Date().toISOString();
      const persisted = { ...candidate, syncVersion: version };
      const effectiveContext = { workspaceId: context.workspaceId, establishmentId };
      const entityRecord = {
        workspaceId: context.workspaceId, establishmentId,
        entity, entityId: item.id, version, updatedAt: now, payload: persisted,
      };
      workspaceEntities.put(entityRecord);
      store.put(persisted);
      // Keep prior tombstones until the matching delete event receives a server ACK.
      tx.objectStore('outbox').add(this.createOutboxRecord(effectiveContext, entity, item.id, 'upsert', version, persisted as Record<string, unknown>, now));
      this.appendLocalP2pEvent(tx, context.workspaceId, entity, item.id, 'upsert', persisted as Record<string, unknown>, now);
    };
    request.onsuccess = () => {
      current = request.result as typeof current;
      entityReady = true;
      commitMutation();
    };
    tombstoneRequest.onsuccess = () => { previousTombstone = tombstoneRequest.result as TombstoneRecord | undefined; tombstoneReady = true; commitMutation(); };
    request.onerror = () => tx.abort();
    tombstoneRequest.onerror = () => tx.abort();
    if (validateCurrentBookings) {
      const bookingsRequest = store.getAll();
      bookingsRequest.onsuccess = () => {
        currentBookingRows = bookingsRequest.result as TimelineBooking[];
        bookingRowsReady = true;
        commitMutation();
      };
      bookingsRequest.onerror = () => tx.abort();
    }
    try {
      await waitForTransactionCompletion(tx, `putWithOutbox ${entity}/${item.id}`);
    } catch (error) {
      if (validationError) throw validationError;
      throw error;
    }
    this.emitOutboxChange();
  }

  /** Durable local-only booking write before workspace authentication. */
  public async putLocalBooking(
    item: TimelineBooking,
    validateCurrentBookings?: (bookings: TimelineBooking[]) => void,
  ): Promise<void> {
    await this.openStore();
    if (!this.idb) throw new Error('Durable booking persistence requires IndexedDB.');
    const tx = this.createStrictTransaction(['bookings']);
    const store = tx.objectStore('bookings');
    let validationError: Error | null = null;
    const request = store.getAll();
    request.onsuccess = () => {
      try {
        validateCurrentBookings?.(request.result as TimelineBooking[]);
        store.put(migrateBookingRecordV7(item as Partial<TimelineBooking>));
      } catch (error) {
        validationError = error instanceof Error ? error : new Error(String(error));
        tx.abort();
      }
    };
    request.onerror = () => tx.abort();
    try {
      await waitForTransactionCompletion(tx, `putLocalBooking ${item.id}`);
    } catch (error) {
      if (validationError) throw validationError;
      throw error;
    }
  }

  /** Persist a multi-booking room swap as one durable local + Outbox + P2P transaction. */
  public async putBookingsAtomicallyWithOutbox(
    items: [TimelineBooking, TimelineBooking],
    context: OutboxMutationContext,
    validateCurrentBookings: (bookings: TimelineBooking[]) => void,
  ): Promise<void> {
    if (items[0].id === items[1].id) throw new Error('A room swap requires two distinct bookings.');
    if (!context.workspaceId.trim()) throw new Error('Workspace isolation required for outbox writes.');
    await this.openStore();
    if (!this.idb) throw new Error('Transactional room swaps require IndexedDB.');
    await this.getP2pNodeId();

    const tx = this.createStrictTransaction([
      'bookings', 'outbox', 'tombstones', 'workspaceEntities',
      'p2pEvents', 'p2pTransportQueue', 'p2pClock', 'p2pMeta', 'p2pRecordFrontiers',
    ]);
    const bookingsStore = tx.objectStore('bookings');
    const workspaceEntities = tx.objectStore('workspaceEntities');
    const tombstones = tx.objectStore('tombstones');
    const outbox = tx.objectStore('outbox');
    let rows: TimelineBooking[] = [];
    let rowsReady = false;
    let readyCount = 0;
    const currentEntities: Array<{ version?: number; establishmentId?: string } | undefined> = [undefined, undefined];
    const previousTombstones: Array<TombstoneRecord | undefined> = [undefined, undefined];
    let validationError: Error | null = null;
    const finish = () => {
      if (!rowsReady || readyCount !== 4) return;
      try {
        const replacedIds = new Set(items.map((item) => item.id));
        validateCurrentBookings([
          ...rows.filter((row) => !replacedIds.has(row.id)),
          ...items,
        ]);
      } catch (error) {
        validationError = error instanceof Error ? error : new Error(String(error));
        tx.abort();
        return;
      }

      const persistedItems = items.map((item, index) => {
        const baseItem = migrateBookingRecordV7(item as Partial<TimelineBooking>) as TimelineBooking;
        const establishmentId = context.establishmentId
          ?? currentEntities[index]?.establishmentId
          ?? (baseItem as TimelineBooking & { establishmentId?: string }).establishmentId;
        const version = Math.max(
          currentEntities[index]?.version ?? 0,
          previousTombstones[index]?.version ?? 0,
        ) + 1;
        const persisted = {
          ...baseItem,
          workspaceId: context.workspaceId,
          ...(establishmentId ? { establishmentId } : {}),
          syncVersion: version,
          deletedAt: null,
        } as TimelineBooking & Record<string, unknown>;
        workspaceEntities.put({
          workspaceId: context.workspaceId,
          establishmentId,
          entity: 'booking',
          entityId: item.id,
          version,
          updatedAt: new Date().toISOString(),
          payload: persisted,
        });
        bookingsStore.put(persisted);
        outbox.add(this.createOutboxRecord(
          { workspaceId: context.workspaceId, establishmentId },
          'booking',
          item.id,
          'upsert',
          version,
          persisted,
          new Date().toISOString(),
        ));
        return persisted;
      });

      // appendLocalP2pEvent reads the per-node clock. Queue the two events serially
      // so both cannot observe the same sequence number inside this transaction.
      const appendNext = (index: number) => {
        if (index >= persistedItems.length) return;
        const persisted = persistedItems[index];
        this.appendLocalP2pEvent(
          tx,
          context.workspaceId,
          'booking',
          persisted.id,
          'upsert',
          persisted as Record<string, unknown>,
          new Date().toISOString(),
          () => appendNext(index + 1),
        );
      };
      appendNext(0);
    };

    const rowsRequest = bookingsStore.getAll();
    rowsRequest.onsuccess = () => { rows = rowsRequest.result as TimelineBooking[]; rowsReady = true; finish(); };
    rowsRequest.onerror = () => tx.abort();

    items.forEach((item, index) => {
      const entityRequest = workspaceEntities.get([context.workspaceId, 'booking', item.id]);
      const tombstoneRequest = tombstones.get(`${context.workspaceId}:booking:${item.id}`);
      entityRequest.onsuccess = () => {
        currentEntities[index] = entityRequest.result as { version?: number; establishmentId?: string } | undefined;
        readyCount += 1;
        finish();
      };
      tombstoneRequest.onsuccess = () => {
        previousTombstones[index] = tombstoneRequest.result as TombstoneRecord | undefined;
        readyCount += 1;
        finish();
      };
      entityRequest.onerror = () => tx.abort();
      tombstoneRequest.onerror = () => tx.abort();
    });

    try {
      await waitForTransactionCompletion(tx, 'putBookingsAtomicallyWithOutbox');
    } catch (error) {
      if (validationError) throw validationError;
      throw error;
    }
    this.emitOutboxChange();
  }

  /** Local-only counterpart used before a workspace identity is available. */
  public async putLocalBookingsAtomically(
    items: [TimelineBooking, TimelineBooking],
    validateCurrentBookings: (bookings: TimelineBooking[]) => void,
  ): Promise<void> {
    if (items[0].id === items[1].id) throw new Error('A room swap requires two distinct bookings.');
    await this.openStore();
    if (!this.idb) throw new Error('Transactional room swaps require IndexedDB.');
    const tx = this.createStrictTransaction(['bookings']);
    const store = tx.objectStore('bookings');
    let validationError: Error | null = null;
    const request = store.getAll();
    request.onsuccess = () => {
      try {
        const replacedIds = new Set(items.map((item) => item.id));
        validateCurrentBookings([
          ...(request.result as TimelineBooking[]).filter((row) => !replacedIds.has(row.id)),
          ...items,
        ]);
        for (const item of items) store.put(migrateBookingRecordV7(item as Partial<TimelineBooking>));
      } catch (error) {
        validationError = error instanceof Error ? error : new Error(String(error));
        tx.abort();
      }
    };
    request.onerror = () => tx.abort();
    try {
      await waitForTransactionCompletion(tx, 'putLocalBookingsAtomically');
    } catch (error) {
      if (validationError) throw validationError;
      throw error;
    }
  }

  /**
   * Read a single outbox record by its unique idempotency key within a workspace.
   * Used by backfill to avoid seeding duplicate Outbox records on re-runs.
   */
  public async getOutboxRecordByIdempotencyKey(
    workspaceId: string,
    idempotencyKey: string,
  ): Promise<OutboxRecord | undefined> {
    if (!workspaceId.trim() || !idempotencyKey) return undefined;
    await this.openStore();
    if (!this.idb) return undefined;
    const tx = this.idb.transaction('outbox', 'readonly');
    const record = await new Promise<OutboxRecord | undefined>((resolve, reject) => {
      const request = tx.objectStore('outbox').index('idempotencyKey').get(idempotencyKey);
      request.onsuccess = () => resolve(request.result as OutboxRecord | undefined);
      request.onerror = () => reject(request.error);
    });
    await waitForTransactionCompletion(tx, 'getOutboxRecordByIdempotencyKey');
    return record?.workspaceId === workspaceId ? record : undefined;
  }

  /**
   * Put an operational record and enqueue exactly one Outbox mutation guarded by
   * an explicit idempotency key. If a record with the same key already exists
   * (pending, failed or synced), no duplicate Outbox row is created; a failed
   * record keeps retrying through the normal backoff instead of multiplying.
   * Opt-in only: demo/bootstrap data must never call this method.
   */
  public async putWithOutboxByKey<T extends { id: string }>(
    storeName: 'bookings' | 'resources' | 'resourceGroups',
    item: T,
    context: OutboxMutationContext,
    entity: OutboxEntity,
    idempotencyKey: string,
    version?: number,
  ): Promise<void> {
    if (entity !== expectedOutboxEntityForStore(storeName)) {
      throw new Error(`Store/entity mismatch: ${storeName} cannot be queued as ${entity}.`);
    }
    if (!context.workspaceId.trim()) throw new Error('Workspace isolation required for outbox writes.');
    await this.openStore();
    if (!this.idb) throw new Error('Transactional outbox requires IndexedDB; localStorage fallback is not safe for cloud sync.');

    const existing = await this.getOutboxRecordByIdempotencyKey(context.workspaceId, idempotencyKey);
    if (existing) {
      const expectedBaseItem =
        storeName === 'bookings'
          ? (migrateBookingRecordV7(item as Partial<TimelineBooking>) as T)
          : item;
      const expectedPayload = {
        ...expectedBaseItem,
        workspaceId: context.workspaceId,
        establishmentId: context.establishmentId
          ?? (expectedBaseItem as T & { establishmentId?: string }).establishmentId
          ?? existing.establishmentId,
        syncVersion: existing.version,
        deletedAt: null,
      };
      if (
        existing.entity !== entity
        || existing.entityId !== item.id
        || existing.operation !== 'upsert'
        || stableSerialize(existing.payload) !== stableSerialize(expectedPayload)
      ) {
        throw new Error('Idempotency key collision: existing Outbox intent does not match this mutation.');
      }
      // Idempotent backfill: keep the existing Outbox intent and only restore a
      // missing operational row. Never overwrite newer local state with the
      // snapshot the plan was built from.
      await this.getP2pNodeId();
      const storeTx = this.createStrictTransaction(
        [storeName, 'p2pEvents', 'p2pTransportQueue', 'p2pClock', 'p2pMeta', 'p2pRecordFrontiers'],
      );
      const store = storeTx.objectStore(storeName);
      const current = await new Promise<T | undefined>((resolve) => {
        const req = store.get(item.id);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => resolve(undefined);
      });
      if (!current) {
        const persisted = existing.payload ?? {
          ...expectedBaseItem,
          workspaceId: context.workspaceId,
          establishmentId: context.establishmentId,
          syncVersion: existing.version,
          deletedAt: null,
        };
        store.put(persisted as T);
      }
      // Never replay an older Outbox snapshot over a newer local projection.
      if (!current || JSON.stringify(current) === JSON.stringify(existing.payload)) {
        this.ensureP2pEventForOutbox(storeTx, existing);
      }
      await waitForTransactionCompletion(storeTx, `putWithOutboxByKey-idempotent ${entity}/${item.id}`);
      this.emitOutboxChange();
      return;
    }

    await this.getP2pNodeId();
    const tx = this.createStrictTransaction([storeName, 'outbox', 'tombstones', 'workspaceEntities', 'p2pEvents', 'p2pTransportQueue', 'p2pClock', 'p2pMeta', 'p2pRecordFrontiers']);
    const store = tx.objectStore(storeName);
    const workspaceEntities = tx.objectStore('workspaceEntities');
    const tombstones = tx.objectStore('tombstones');
    const tombstoneId = `${context.workspaceId}:${entity}:${item.id}`;
    const request = workspaceEntities.get([context.workspaceId, entity, item.id]);
    const tombstoneRequest = tombstones.get(tombstoneId);
    let current: { version?: number } | undefined;
    let previousTombstone: TombstoneRecord | undefined;
    let entityReady = false;
    let tombstoneReady = false;
    const commitMutation = () => {
      if (!entityReady || !tombstoneReady) return;
      const resolvedVersion = Math.max(
        version ?? current?.version ?? 0,
        previousTombstone?.version ?? 0,
      ) + 1;
      const now = new Date().toISOString();
      const baseItem =
        storeName === 'bookings'
          ? (migrateBookingRecordV7(item as Partial<TimelineBooking>) as T)
          : item;
      const persisted = { ...baseItem, workspaceId: context.workspaceId, establishmentId: context.establishmentId, syncVersion: resolvedVersion, deletedAt: null };
      const entityRecord = {
        workspaceId: context.workspaceId, establishmentId: context.establishmentId,
        entity, entityId: item.id, version: resolvedVersion, updatedAt: now, payload: persisted,
      };
      workspaceEntities.put(entityRecord);
      store.put(persisted);
      // An explicit local upsert is a new incarnation and supersedes the older
      // tombstone atomically; otherwise every later pull would keep hiding it.
      tombstones.delete(tombstoneId);
      tx.objectStore('outbox').add(this.createOutboxRecord(context, entity, item.id, 'upsert', resolvedVersion, persisted as Record<string, unknown>, now, idempotencyKey));
      this.appendLocalP2pEvent(tx, context.workspaceId, entity, item.id, 'upsert', persisted as Record<string, unknown>, now);
    };
    request.onsuccess = () => { current = request.result as { version?: number } | undefined; entityReady = true; commitMutation(); };
    tombstoneRequest.onsuccess = () => { previousTombstone = tombstoneRequest.result as TombstoneRecord | undefined; tombstoneReady = true; commitMutation(); };
    request.onerror = () => tx.abort();
    tombstoneRequest.onerror = () => tx.abort();
    await waitForTransactionCompletion(tx, `putWithOutboxByKey ${entity}/${item.id}`);
    this.emitOutboxChange();
  }

  /**
   * Commit a bounded set of generic business upserts, their Outbox rows and their
   * P2P events in one strict IndexedDB transaction. Optional payload transforms
   * apply deltas to the latest persisted projection and return committed payloads; P2P events are appended
   * sequentially so every event observes the previous event's vector-clock advance.
   */
  public async enqueueWorkspaceUpsertsAtomically(
    context: OutboxMutationContext,
    mutations: ReadonlyArray<{
      entity: OutboxEntity;
      entityId: string;
      payload: Record<string, unknown>;
      applyToCurrent?: (
        currentPayload?: Record<string, unknown>,
        currentBatch?: ReadonlyMap<string, Record<string, unknown>>,
      ) => Record<string, unknown>;
      toOutboxPayload?: (
        currentPayload?: Record<string, unknown>,
        currentBatch?: ReadonlyMap<string, Record<string, unknown>>,
      ) => Record<string, unknown>;
      skipIfCurrent?: (
        currentPayload?: Record<string, unknown>,
        currentBatch?: ReadonlyMap<string, Record<string, unknown>>,
      ) => boolean;
      skipOutbox?: boolean;
    }>,
    commandId: string,
    rejectIfCurrentFieldEquals?: {
      entity: OutboxEntity;
      entityId: string;
      field: string;
      value: unknown;
    },
  ): Promise<Array<{ entity: OutboxEntity; entityId: string; payload: Record<string, unknown> }>> {
    if (!context.workspaceId.trim() || !context.establishmentId?.trim() || !commandId.trim()) {
      throw new Error('Workspace, establishment and command identity are required for an atomic mutation.');
    }
    if (mutations.length === 0 || mutations.length > 100) {
      throw new Error('Atomic workspace mutation batch must contain between 1 and 100 records.');
    }
    const identities = new Set<string>();
    for (const mutation of mutations) {
      if (!mutation.entityId.trim() || !mutation.payload || typeof mutation.payload !== 'object'
        || Array.isArray(mutation.payload) || mutation.payload.id !== mutation.entityId) {
        throw new Error('Atomic workspace mutation contains an invalid entity identity or payload.');
      }
      const identity = `${mutation.entity}:${mutation.entityId}`;
      if (identities.has(identity)) throw new Error(`Duplicate entity in atomic mutation batch: ${identity}`);
      identities.add(identity);
    }
    if (rejectIfCurrentFieldEquals && !mutations.some((item) =>
      item.entity === rejectIfCurrentFieldEquals.entity && item.entityId === rejectIfCurrentFieldEquals.entityId
    )) {
      throw new Error('Atomic mutation precondition must reference a record in the same batch.');
    }

    await this.openStore();
    if (!this.idb) throw new Error('Atomic workspace mutation requires IndexedDB.');
    await this.getP2pNodeId();

    const tx = this.createStrictTransaction([
      'outbox', 'workspaceEntities', 'tombstones',
      'p2pEvents', 'p2pTransportQueue', 'p2pClock', 'p2pMeta', 'p2pRecordFrontiers',
    ]);
    const outbox = tx.objectStore('outbox');
    const workspaceEntities = tx.objectStore('workspaceEntities');
    const tombstones = tx.objectStore('tombstones');
    const entries = mutations.map((mutation) => ({
      ...mutation,
      idempotencyKey: `${context.workspaceId}:${commandId}:${mutation.entity}:${mutation.entityId}`,
      current: undefined as { version?: number; payload?: Record<string, unknown> } | undefined,
      tombstone: undefined as TombstoneRecord | undefined,
      existing: undefined as OutboxRecord | undefined,
      ready: 0,
    }));
    let readyCount = 0;
    const committed: Array<{ entity: OutboxEntity; entityId: string; payload: Record<string, unknown> }> = [];
    let validationError: Error | null = null;
    const abortWith = (message: string) => {
      validationError = new Error(message);
      try { tx.abort(); } catch { /* transaction may already be inactive */ }
    };

    const processNext = (index: number): void => {
      if (index >= entries.length) return;
      const entry = entries[index];
      if (entry.existing) {
        abortWith(`Atomic command idempotency key already exists: ${entry.entity}/${entry.entityId}.`);
        return;
      }
      if (
        rejectIfCurrentFieldEquals
        && entry.entity === rejectIfCurrentFieldEquals.entity
        && entry.entityId === rejectIfCurrentFieldEquals.entityId
        && entry.current?.payload?.[rejectIfCurrentFieldEquals.field] === rejectIfCurrentFieldEquals.value
      ) {
        abortWith(`Atomic command precondition failed: ${entry.entity}/${entry.entityId} is already in the requested state.`);
        return;
      }

      const version = Math.max(entry.current?.version ?? 0, entry.tombstone?.version ?? 0) + 1;
      const now = new Date().toISOString();
      const currentBatch = new Map<string, Record<string, unknown>>();
      for (const currentEntry of entries) {
        if (currentEntry.current?.payload) {
          currentBatch.set(`${currentEntry.entity}:${currentEntry.entityId}`, currentEntry.current.payload);
        }
      }
      if (entry.skipIfCurrent) {
        try {
          if (entry.skipIfCurrent(entry.current?.payload, currentBatch)) {
            processNext(index + 1);
            return;
          }
        } catch (error) {
          abortWith(`Atomic mutation skip predicate failed for ${entry.entity}/${entry.entityId}: ${String(error)}`);
          return;
        }
      }
      let commandPayload: Record<string, unknown>;
      let outboundPayload: Record<string, unknown>;
      try {
        commandPayload = entry.applyToCurrent
          ? entry.applyToCurrent(entry.current?.payload, currentBatch)
          : entry.payload;
        outboundPayload = entry.toOutboxPayload
          ? entry.toOutboxPayload(entry.current?.payload, currentBatch)
          : commandPayload;
      } catch (error) {
        abortWith(`Atomic payload transformation failed for ${entry.entity}/${entry.entityId}: ${String(error)}`);
        return;
      }
      if (!commandPayload || typeof commandPayload !== 'object' || Array.isArray(commandPayload) || commandPayload.id !== entry.entityId
        || !outboundPayload || typeof outboundPayload !== 'object' || Array.isArray(outboundPayload) || outboundPayload.id !== entry.entityId) {
        abortWith(`Atomic payload transformation returned an invalid record for ${entry.entity}/${entry.entityId}.`);
        return;
      }
      const persisted = {
        ...commandPayload,
        workspaceId: context.workspaceId,
        establishmentId: context.establishmentId,
        syncVersion: version,
        deletedAt: null,
      };
      const persistedOutbound = {
        ...outboundPayload,
        workspaceId: context.workspaceId,
        establishmentId: context.establishmentId,
        syncVersion: version,
        deletedAt: null,
      };
      workspaceEntities.put({
        workspaceId: context.workspaceId,
        establishmentId: context.establishmentId,
        entity: entry.entity,
        entityId: entry.entityId,
        version,
        updatedAt: now,
        payload: persisted,
      });
      tombstones.delete(`${context.workspaceId}:${entry.entity}:${entry.entityId}`);
      if (!entry.skipOutbox) {
        outbox.add(this.createOutboxRecord(
          context,
          entry.entity,
          entry.entityId,
          'upsert',
          version,
          persistedOutbound,
          now,
          entry.idempotencyKey,
        ));
      }
      committed.push({ entity: entry.entity, entityId: entry.entityId, payload: persisted });
      this.appendLocalP2pEvent(
        tx,
        context.workspaceId,
        entry.entity,
        entry.entityId,
        'upsert',
        persisted,
        now,
        () => processNext(index + 1),
      );
    };

    for (const entry of entries) {
      const tombstoneId = `${context.workspaceId}:${entry.entity}:${entry.entityId}`;
      const requests = [
        outbox.index('idempotencyKey').get(entry.idempotencyKey),
        workspaceEntities.get([context.workspaceId, entry.entity, entry.entityId]),
        tombstones.get(tombstoneId),
      ];
      requests[0].onsuccess = () => {
        entry.existing = requests[0].result as OutboxRecord | undefined;
        entry.ready += 1;
        readyCount += 1;
        if (readyCount === entries.length * 3) processNext(0);
      };
      requests[1].onsuccess = () => {
        entry.current = requests[1].result as typeof entry.current;
        entry.ready += 1;
        readyCount += 1;
        if (readyCount === entries.length * 3) processNext(0);
      };
      requests[2].onsuccess = () => {
        entry.tombstone = requests[2].result as TombstoneRecord | undefined;
        entry.ready += 1;
        readyCount += 1;
        if (readyCount === entries.length * 3) processNext(0);
      };
      requests.forEach((request) => { request.onerror = () => tx.abort(); });
    }

    try {
      await waitForTransactionCompletion(tx, 'enqueueWorkspaceUpsertsAtomically');
    } catch (error) {
      if (validationError) throw validationError;
      throw error;
    }
    this.emitOutboxChange();
    return committed;
  }

  public async enqueueOutboxOnly(
    context: OutboxMutationContext,
    entity: OutboxEntity,
    entityId: string,
    operation: OutboxOperation,
    version: number,
    payload: Record<string, unknown> | null,
    idempotencyKey: string,
  ): Promise<void> {
    if (!context.workspaceId.trim()) throw new Error('Workspace isolation required for outbox writes.');
    if (operation !== 'upsert') {
      throw new Error('Outbox-only compatibility writes currently accept upserts only; use a tombstone-aware delete API.');
    }
    if (!entityId.trim() || !idempotencyKey.trim() || !Number.isSafeInteger(version) || version < 1) {
      throw new Error('Outbox-only mutation identity, idempotency key and version are required.');
    }
    await this.openStore();
    if (!this.idb) throw new Error('Transactional outbox requires IndexedDB; localStorage fallback is not safe for cloud sync.');

    // Read the idempotency key, current entity version and tombstone in the SAME
    // strict read/write transaction as the Outbox + P2P append. This closes the
    // read-then-write race between tabs and makes revisions monotonic.
    await this.getP2pNodeId();
    const tx = this.createStrictTransaction([
      'outbox',
      'workspaceEntities',
      'tombstones',
      'p2pEvents',
      'p2pTransportQueue',
      'p2pClock',
      'p2pMeta',
      'p2pRecordFrontiers',
    ]);
    const outbox = tx.objectStore('outbox');
    const workspaceEntities = tx.objectStore('workspaceEntities');
    const tombstones = tx.objectStore('tombstones');
    const tombstoneId = `${context.workspaceId}:${entity}:${entityId}`;
    const existingRequest = outbox.index('idempotencyKey').get(idempotencyKey);
    const currentRequest = workspaceEntities.get([context.workspaceId, entity, entityId]);
    const tombstoneRequest = tombstones.get(tombstoneId);

    let existing: OutboxRecord | undefined;
    let current: { version?: number; establishmentId?: string } | undefined;
    let previousTombstone: TombstoneRecord | undefined;
    let existingReady = false;
    let currentReady = false;
    let tombstoneReady = false;
    let validationError: Error | null = null;

    const abortWith = (message: string) => {
      validationError = new Error(message);
      try { tx.abort(); } catch { /* transaction may already be inactive */ }
    };

    const commit = () => {
      if (!existingReady || !currentReady || !tombstoneReady) return;

      if (existing) {
        if (
          existing.workspaceId !== context.workspaceId
          || existing.entity !== entity
          || existing.entityId !== entityId
          || existing.operation !== operation
          || (context.establishmentId !== undefined && existing.establishmentId !== context.establishmentId)
          || stableSerialize(existing.payload) !== stableSerialize(payload)
        ) {
          abortWith(
            `Idempotency key collision for ${entity}/${entityId}: the key already identifies a different immutable mutation.`,
          );
          return;
        }

        // An exact retry keeps the original ACK state/version. Only repair a
        // missing P2P envelope; never overwrite a newer materialized entity.
        if (!current || (current.version ?? 0) <= existing.version) {
          this.ensureP2pEventForOutbox(tx, existing);
        }
        return;
      }

      const resolvedVersion = Math.max(
        version,
        (current?.version ?? 0) + 1,
        (previousTombstone?.version ?? 0) + 1,
      );
      const now = new Date().toISOString();
      workspaceEntities.put({
        workspaceId: context.workspaceId,
        establishmentId: context.establishmentId ?? current?.establishmentId,
        entity,
        entityId,
        version: resolvedVersion,
        updatedAt: now,
        payload: payload ?? {},
      });
      // A new upsert supersedes the old tombstone at this higher entity version.
      tombstones.delete(tombstoneId);
      outbox.add(this.createOutboxRecord(
        context,
        entity,
        entityId,
        operation,
        resolvedVersion,
        payload,
        now,
        idempotencyKey,
      ));
      this.appendLocalP2pEvent(tx, context.workspaceId, entity, entityId, operation, payload, now);
    };

    existingRequest.onsuccess = () => {
      existing = existingRequest.result as OutboxRecord | undefined;
      existingReady = true;
      commit();
    };
    currentRequest.onsuccess = () => {
      current = currentRequest.result as typeof current;
      currentReady = true;
      commit();
    };
    tombstoneRequest.onsuccess = () => {
      previousTombstone = tombstoneRequest.result as TombstoneRecord | undefined;
      tombstoneReady = true;
      commit();
    };
    existingRequest.onerror = () => tx.abort();
    currentRequest.onerror = () => tx.abort();
    tombstoneRequest.onerror = () => tx.abort();

    try {
      await waitForTransactionCompletion(tx, `enqueueOutboxOnly ${entity}/${entityId}`);
    } catch (error) {
      if (validationError) throw validationError;
      throw error;
    }
    this.emitOutboxChange();
  }

  /** Apply cloud tombstones without resurrecting a locally pending mutation. */
  public async applyRemoteWorkspaceTombstones(
    workspaceId: string,
    remoteTombstones: readonly RemoteWorkspaceTombstone[],
  ): Promise<AppliedRemoteTombstones> {
    if (!workspaceId.trim()) throw new Error('Workspace is required for remote tombstones.');
    if (remoteTombstones.length > 500) throw new Error('Remote tombstone page exceeds the 500-row limit.');
    await this.openStore();
    if (!this.idb) throw new Error('Remote tombstones require IndexedDB.');
    await this.getP2pNodeId();
    const report: AppliedRemoteTombstones = { applied: [], conflicts: [] };

    for (const remote of remoteTombstones) {
      if (!P2P_SUPPORTED_ENTITIES.includes(remote.entity) || !remote.entityId.trim()
        || !Number.isSafeInteger(remote.remoteVersion) || remote.remoteVersion < 1
        || !Number.isFinite(Date.parse(remote.deletedAt))) {
        throw new Error('Invalid remote workspace tombstone.');
      }
      const tx = this.createStrictTransaction([
        'outbox', 'workspaceEntities', 'tombstones', 'p2pEvents', 'p2pTransportQueue', 'p2pClock', 'p2pMeta', 'p2pRecordFrontiers',
      ]);
      const outbox = tx.objectStore('outbox');
      const workspaceEntities = tx.objectStore('workspaceEntities');
      const tombstones = tx.objectStore('tombstones');
      const id = `${workspaceId}:${remote.entity}:${remote.entityId}`;
      const pendingRequest = outbox.index('workspaceEntity').getAll([workspaceId, remote.entity, remote.entityId]);
      const currentRequest = workspaceEntities.get([workspaceId, remote.entity, remote.entityId]);
      const tombstoneRequest = tombstones.get(id);
      let pending: OutboxRecord[] = [];
      let current: { version?: number } | undefined;
      let existing: TombstoneRecord | undefined;
      let ready = 0;
      const action: { value: 'apply' | 'skip' | 'conflict' } = { value: 'skip' };
      const commit = () => {
        if (++ready !== 3) return;
        const activePending = pending.filter((row) => row.status !== 'synced');
        if (activePending.some((row) => row.operation === 'upsert')) {
          action.value = 'conflict';
          return;
        }
        if (existing?.origin === 'local' || existing?.origin === 'p2p') {
          action.value = 'skip';
          return;
        }
        if (existing?.origin === 'supabase') {
          if ((existing.remoteVersion ?? 0) < remote.remoteVersion) {
            tombstones.put({ ...existing, deletedAt: remote.deletedAt, remoteVersion: remote.remoteVersion });
          }
          action.value = 'skip';
          return;
        }
        const createdAt = new Date().toISOString();
        const version = (current?.version ?? 0) + 1;
        workspaceEntities.delete([workspaceId, remote.entity, remote.entityId]);
        tombstones.put({
          id, workspaceId, establishmentId: remote.establishmentId,
          entity: remote.entity, entityId: remote.entityId, version,
          deletedAt: remote.deletedAt, origin: 'supabase', remoteVersion: remote.remoteVersion,
        } satisfies TombstoneRecord);
        this.appendLocalP2pEvent(tx, workspaceId, remote.entity, remote.entityId, 'delete', null, createdAt);
        action.value = 'apply';
      };
      pendingRequest.onsuccess = () => { pending = pendingRequest.result as OutboxRecord[]; commit(); };
      currentRequest.onsuccess = () => { current = currentRequest.result as typeof current; commit(); };
      tombstoneRequest.onsuccess = () => { existing = tombstoneRequest.result as TombstoneRecord | undefined; commit(); };
      pendingRequest.onerror = () => tx.abort();
      currentRequest.onerror = () => tx.abort();
      tombstoneRequest.onerror = () => tx.abort();
      await waitForTransactionCompletion(tx, `applyRemoteWorkspaceTombstone ${remote.entity}/${remote.entityId}`);
      const entry = { entity: remote.entity, entityId: remote.entityId };
      if (action.value === 'apply') report.applied.push(entry);
      if (action.value === 'conflict') report.conflicts.push(entry);
    }
    return report;
  }

  /** Persist local-only business data without inventing a workspace or emitting P2P events. */
  public async putLocalBusinessEntity(
    entity: OutboxEntity,
    entityId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!entityId.trim() || !payload || typeof payload !== 'object') {
      throw new Error('Local business entity identity and payload are required.');
    }
    await this.openStore();
    if (!this.idb) throw new Error('Durable local business storage requires IndexedDB.');
    const tx = this.createStrictTransaction(['localBusinessEntities']);
    tx.objectStore('localBusinessEntities').put({
      entity, entityId, payload, updatedAt: new Date().toISOString(),
    });
    await waitForTransactionCompletion(tx, `putLocalBusinessEntity ${entity}/${entityId}`);
  }


  /** Persist a local-only multi-entity command atomically without fabricating a workspace. */
  public async putLocalBusinessEntitiesAtomically(
    mutations: ReadonlyArray<{
      entity: OutboxEntity;
      entityId: string;
      payload: Record<string, unknown>;
      applyToCurrent?: (
        currentPayload?: Record<string, unknown>,
        currentBatch?: ReadonlyMap<string, Record<string, unknown>>,
      ) => Record<string, unknown>;
      skipIfCurrent?: (
        currentPayload?: Record<string, unknown>,
        currentBatch?: ReadonlyMap<string, Record<string, unknown>>,
      ) => boolean;
      skipOutbox?: boolean;
    }>,
    rejectIfCurrentFieldEquals?: {
      entity: OutboxEntity;
      entityId: string;
      field: string;
      value: unknown;
    },
  ): Promise<Array<{ entity: OutboxEntity; entityId: string; payload: Record<string, unknown> }>> {
    if (mutations.length === 0 || mutations.length > 100) {
      throw new Error('Atomic local mutation batch must contain between 1 and 100 records.');
    }
    const identities = new Set<string>();
    for (const mutation of mutations) {
      if (!mutation.entityId.trim() || !mutation.payload || typeof mutation.payload !== 'object'
        || Array.isArray(mutation.payload) || mutation.payload.id !== mutation.entityId) {
        throw new Error('Atomic local mutation contains an invalid entity identity or payload.');
      }
      const identity = `${mutation.entity}:${mutation.entityId}`;
      if (identities.has(identity)) throw new Error(`Duplicate entity in atomic local mutation batch: ${identity}`);
      identities.add(identity);
    }
    await this.openStore();
    if (!this.idb) throw new Error('Atomic local business mutation requires IndexedDB.');
    if (rejectIfCurrentFieldEquals && !mutations.some((item) =>
      item.entity === rejectIfCurrentFieldEquals.entity && item.entityId === rejectIfCurrentFieldEquals.entityId
    )) {
      throw new Error('Atomic local mutation precondition must reference a record in the same batch.');
    }
    const tx = this.createStrictTransaction(['localBusinessEntities']);
    const store = tx.objectStore('localBusinessEntities');
    const updatedAt = new Date().toISOString();
    const entries = mutations.map((mutation) => ({ ...mutation, current: undefined as { payload?: Record<string, unknown> } | undefined }));
    const committed: Array<{ entity: OutboxEntity; entityId: string; payload: Record<string, unknown> }> = [];
    let readyCount = 0;
    let validationError: Error | null = null;
    const abortWith = (message: string) => {
      validationError = new Error(message);
      try { tx.abort(); } catch { /* already inactive */ }
    };
    const commit = () => {
      if (readyCount !== entries.length) return;
      if (rejectIfCurrentFieldEquals) {
        const guarded = entries.find((entry) => entry.entity === rejectIfCurrentFieldEquals.entity && entry.entityId === rejectIfCurrentFieldEquals.entityId);
        if (guarded?.current?.payload?.[rejectIfCurrentFieldEquals.field] === rejectIfCurrentFieldEquals.value) {
          abortWith('Atomic local mutation precondition failed: record is already in the requested state.');
          return;
        }
      }
      for (const entry of entries) {
        let payload: Record<string, unknown>;
        const currentBatch = new Map<string, Record<string, unknown>>();
        for (const currentEntry of entries) {
          if (currentEntry.current?.payload) {
            currentBatch.set(`${currentEntry.entity}:${currentEntry.entityId}`, currentEntry.current.payload);
          }
        }
        if (entry.skipIfCurrent) {
          try {
            if (entry.skipIfCurrent(entry.current?.payload, currentBatch)) continue;
          } catch (error) {
            abortWith(`Atomic local mutation skip predicate failed for ${entry.entity}/${entry.entityId}: ${String(error)}`);
            return;
          }
        }
        try { payload = entry.applyToCurrent ? entry.applyToCurrent(entry.current?.payload, currentBatch) : entry.payload; }
        catch (error) { abortWith(`Atomic local payload transformation failed: ${String(error)}`); return; }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.id !== entry.entityId) {
          abortWith(`Atomic local payload transformation returned an invalid record for ${entry.entity}/${entry.entityId}.`);
          return;
        }
        store.put({ entity: entry.entity, entityId: entry.entityId, payload, updatedAt });
        committed.push({ entity: entry.entity, entityId: entry.entityId, payload });
      }
    };
    for (const entry of entries) {
      const request = store.get([entry.entity, entry.entityId]);
      request.onsuccess = () => { entry.current = request.result as typeof entry.current; readyCount += 1; commit(); };
      request.onerror = () => tx.abort();
    }
    try {
      await waitForTransactionCompletion(tx, 'putLocalBusinessEntitiesAtomically');
    } catch (error) {
      if (validationError) throw validationError;
      throw error;
    }
    return committed;
  }

  /** Remove one local-only business projection. Workspace deletes must use tombstones. */
  public async deleteLocalBusinessEntity(entity: OutboxEntity, entityId: string): Promise<void> {
    if (!entityId.trim()) throw new Error('Local business entity identity is required.');
    await this.openStore();
    if (!this.idb) throw new Error('Durable local business storage requires IndexedDB.');
    const tx = this.createStrictTransaction(['localBusinessEntities']);
    tx.objectStore('localBusinessEntities').delete([entity, entityId]);
    await waitForTransactionCompletion(tx, `deleteLocalBusinessEntity ${entity}/${entityId}`);
  }

  /** Read durable local-only projections for an unauthenticated/offline installation. */
  public async getLocalBusinessEntities<T = Record<string, unknown>>(): Promise<Array<{ entity: OutboxEntity; entityId: string; payload: T }>> {
    await this.openStore();
    if (!this.idb) throw new Error('Durable local business storage requires IndexedDB.');
    const tx = this.idb.transaction(['localBusinessEntities'], 'readonly');
    const request = tx.objectStore('localBusinessEntities').getAll();
    const rows = await new Promise<Array<{ entity: OutboxEntity; entityId: string; payload: T }>>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as Array<{ entity: OutboxEntity; entityId: string; payload: T }>);
      request.onerror = () => reject(request.error ?? new Error('Local business entity read failed.'));
    });
    await waitForTransactionCompletion(tx, 'getLocalBusinessEntities');
    return rows;
  }

  /** Read one entity family from the workspace-scoped generic materialized projection. */
  public async getWorkspaceEntities<T = Record<string, unknown>>(
    workspaceId: string,
    entity: P2pEntity,
  ): Promise<T[]> {
    if (!workspaceId.trim()) return [];
    await this.openStore();
    if (!this.idb) throw new Error('Workspace entity reads require IndexedDB.');
    const tx = this.idb.transaction(['workspaceEntities'], 'readonly');
    const request = tx.objectStore('workspaceEntities').index('workspaceEntityType').getAll([workspaceId, entity]);
    const rows = await new Promise<Array<{ payload?: T }>>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as Array<{ payload?: T }>);
      request.onerror = () => reject(request.error ?? new Error('Workspace entity read failed.'));
    });
    await waitForTransactionCompletion(tx, `getWorkspaceEntities ${entity}`);
    return rows.flatMap((row) => row.payload ? [row.payload] : []);
  }

  /** Generic soft-delete for entities without a dedicated operational IndexedDB store. */
  public async deleteWorkspaceEntityWithOutbox(
    context: OutboxMutationContext,
    entity: OutboxEntity,
    entityId: string,
    idempotencyKey: string,
  ): Promise<void> {
    if (!context.workspaceId.trim() || !entityId.trim() || !idempotencyKey.trim()) {
      throw new Error('Workspace, entity identity and idempotency key are required for a delete.');
    }
    await this.openStore();
    if (!this.idb) throw new Error('Transactional Outbox deletes require IndexedDB.');
    await this.getP2pNodeId();
    const tx = this.createStrictTransaction([
      'outbox', 'workspaceEntities', 'tombstones', 'p2pEvents', 'p2pTransportQueue', 'p2pClock', 'p2pMeta', 'p2pRecordFrontiers',
    ]);
    const outbox = tx.objectStore('outbox');
    const workspaceEntities = tx.objectStore('workspaceEntities');
    const tombstones = tx.objectStore('tombstones');
    const tombstoneId = `${context.workspaceId}:${entity}:${entityId}`;
    const existingRequest = outbox.index('idempotencyKey').get(idempotencyKey);
    const currentRequest = workspaceEntities.get([context.workspaceId, entity, entityId]);
    const tombstoneRequest = tombstones.get(tombstoneId);
    let existing: OutboxRecord | undefined;
    let current: { version?: number } | undefined;
    let previousTombstone: TombstoneRecord | undefined;
    let ready = 0;
    let validationError: Error | null = null;
    const abortWith = (message: string) => {
      validationError = new Error(message);
      try { tx.abort(); } catch { /* transaction may already be inactive */ }
    };
    const commit = () => {
      if (ready !== 3) return;
      if (existing) {
        if (existing.workspaceId !== context.workspaceId || existing.entity !== entity
          || existing.entityId !== entityId || existing.operation !== 'delete' || existing.payload !== null) {
          abortWith('Idempotency key collision for workspace entity delete.');
          return;
        }
        this.ensureP2pEventForOutbox(tx, existing);
        return;
      }
      const version = Math.max(current?.version ?? 0, previousTombstone?.version ?? 0) + 1;
      const deletedAt = new Date().toISOString();
      workspaceEntities.delete([context.workspaceId, entity, entityId]);
      tombstones.put({
        id: tombstoneId, workspaceId: context.workspaceId, establishmentId: context.establishmentId,
        entity, entityId, version, deletedAt, origin: 'local',
      } satisfies TombstoneRecord);
      outbox.add(this.createOutboxRecord(context, entity, entityId, 'delete', version, null, deletedAt, idempotencyKey));
      this.appendLocalP2pEvent(tx, context.workspaceId, entity, entityId, 'delete', null, deletedAt);
    };
    existingRequest.onsuccess = () => { existing = existingRequest.result as OutboxRecord | undefined; ready += 1; commit(); };
    currentRequest.onsuccess = () => { current = currentRequest.result as typeof current; ready += 1; commit(); };
    tombstoneRequest.onsuccess = () => { previousTombstone = tombstoneRequest.result as TombstoneRecord | undefined; ready += 1; commit(); };
    existingRequest.onerror = () => tx.abort();
    currentRequest.onerror = () => tx.abort();
    tombstoneRequest.onerror = () => tx.abort();
    try {
      await waitForTransactionCompletion(tx, `deleteWorkspaceEntityWithOutbox ${entity}/${entityId}`);
    } catch (error) {
      if (validationError) throw validationError;
      throw error;
    }
    this.emitOutboxChange();
  }

  /** Atomically delete the local row and retain a workspace-scoped tombstone + delete intent. */
  public async deleteWithOutbox(
    storeName: 'bookings' | 'resources' | 'resourceGroups', entityId: string,
    context: OutboxMutationContext, entity: OutboxEntity
  ): Promise<void> {
    if (entity !== expectedOutboxEntityForStore(storeName)) {
      throw new Error(`Store/entity mismatch: ${storeName} cannot be deleted as ${entity}.`);
    }
    if (!context.workspaceId.trim()) throw new Error('Workspace isolation required for outbox deletes.');
    await this.openStore();
    if (!this.idb) throw new Error('Transactional outbox requires IndexedDB; localStorage fallback is not safe for cloud sync.');
    await this.getP2pNodeId();
    const tx = this.createStrictTransaction([storeName, 'outbox', 'tombstones', 'workspaceEntities', 'p2pEvents', 'p2pTransportQueue', 'p2pClock', 'p2pMeta', 'p2pRecordFrontiers']);
    const store = tx.objectStore(storeName);
    const workspaceEntities = tx.objectStore('workspaceEntities');
    const tombstones = tx.objectStore('tombstones');
    const tombstoneId = `${context.workspaceId}:${entity}:${entityId}`;
    const request = workspaceEntities.get([context.workspaceId, entity, entityId]);
    const tombstoneRequest = tombstones.get(tombstoneId);
    let current: { version?: number } | undefined;
    let previousTombstone: TombstoneRecord | undefined;
    let entityReady = false;
    let tombstoneReady = false;
    const commitDelete = () => {
      if (!entityReady || !tombstoneReady) return;
      const version = Math.max(current?.version ?? 0, previousTombstone?.version ?? 0) + 1;
      const deletedAt = new Date().toISOString();
      store.delete(entityId);
      workspaceEntities.delete([context.workspaceId, entity, entityId]);
      tombstones.put({
        id: tombstoneId, workspaceId: context.workspaceId, establishmentId: context.establishmentId,
        entity, entityId, version, deletedAt, origin: 'local',
      } satisfies TombstoneRecord);
      tx.objectStore('outbox').add(this.createOutboxRecord(context, entity, entityId, 'delete', version, null, deletedAt));
      this.appendLocalP2pEvent(tx, context.workspaceId, entity, entityId, 'delete', null, deletedAt);
    };
    request.onsuccess = () => { current = request.result as { version?: number } | undefined; entityReady = true; commitDelete(); };
    tombstoneRequest.onsuccess = () => { previousTombstone = tombstoneRequest.result as TombstoneRecord | undefined; tombstoneReady = true; commitDelete(); };
    request.onerror = () => tx.abort();
    tombstoneRequest.onerror = () => tx.abort();
    await waitForTransactionCompletion(tx, `deleteWithOutbox ${entity}/${entityId}`);
    this.emitOutboxChange();
  }

  /**
   * Apply authoritative remote booking tombstones to this device. This path
   * deliberately creates no Supabase Outbox row: it is a replicated remote
   * mutation, not a new local command. The business row, local tombstone and
   * local P2P delete envelope are committed atomically.
   */
  public async applyRemoteBookingTombstones(
    workspaceId: string,
    remoteTombstones: Array<{
      entityId: string;
      establishmentId: string;
      version: number;
      deletedAt: string;
    }>,
  ): Promise<void> {
    if (!workspaceId.trim()) throw new Error('Workspace isolation required for remote tombstones.');
    if (remoteTombstones.length === 0) return;

    const latestById = new Map<string, {
      entityId: string;
      establishmentId: string;
      version: number;
      deletedAt: string;
    }>();
    for (const tombstone of remoteTombstones) {
      if (
        !tombstone.entityId.trim()
        || !tombstone.establishmentId.trim()
        || !Number.isSafeInteger(tombstone.version)
        || tombstone.version < 1
        || !Number.isFinite(Date.parse(tombstone.deletedAt))
      ) {
        throw new Error('Remote booking tombstone has an invalid identity, version or timestamp.');
      }
      const previous = latestById.get(tombstone.entityId);
      if (!previous || tombstone.version > previous.version) {
        latestById.set(tombstone.entityId, tombstone);
      }
    }

    await this.openStore();
    if (!this.idb) {
      throw new Error('Remote tombstones require transactional IndexedDB; localStorage fallback is not safe.');
    }
    await this.getP2pNodeId();

    const tx = this.createStrictTransaction([
      'bookings',
      'outbox',
      'tombstones',
      'workspaceEntities',
      'p2pEvents',
      'p2pTransportQueue',
      'p2pClock',
      'p2pMeta',
      'p2pRecordFrontiers',
    ]);
    const bookings = tx.objectStore('bookings');
    const outbox = tx.objectStore('outbox');
    const tombstones = tx.objectStore('tombstones');
    const workspaceEntities = tx.objectStore('workspaceEntities');
    const outboxRequest = outbox.getAll();
    let appliedCount = 0;

    outboxRequest.onsuccess = () => {
      const allOutbox = outboxRequest.result as OutboxRecord[];
      const remotes = [...latestById.values()];
      let index = 0;

      // P2P events share one per-node sequence and a unique
      // (workspace,node,sequence) index. Queue each tombstone only after the
      // previous event has queued its clock writes; parallel callbacks would
      // otherwise read the same clock and generate duplicate sequence numbers.
      runSerialQueue(remotes, (remote, processNext) => {
        const localIntentExists = allOutbox.some((record) =>
          record.workspaceId === workspaceId
          && record.entity === 'booking'
          && record.entityId === remote.entityId
          && (record.status === 'pending' || record.status === 'failed'),
        );

        // Never discard an unsent local edit or local delete.
        if (localIntentExists) {
          processNext();
          return;
        }

        const tombstoneId = workspaceId + ':booking:' + remote.entityId;
        const entityRequest = workspaceEntities.get([workspaceId, 'booking', remote.entityId]);
        const tombstoneRequest = tombstones.get(tombstoneId);
        let entityRecord: { version?: number } | undefined;
        let previousTombstone: TombstoneRecord | undefined;
        let entityReady = false;
        let tombstoneReady = false;
        let processed = false;

        const apply = () => {
          if (!entityReady || !tombstoneReady || processed) return;
          processed = true;
          // Local or peer deletion has precedence over a cloud snapshot.
          if (previousTombstone && previousTombstone.origin !== 'supabase') {
            processNext();
            return;
          }
          if (
            previousTombstone?.origin === 'supabase'
            && (previousTombstone.remoteVersion ?? 0) >= remote.version
          ) {
            processNext();
            return;
          }

          const localVersion = Math.max(
            entityRecord?.version ?? 0,
            previousTombstone?.version ?? 0,
          ) + 1;
          bookings.delete(remote.entityId);
          workspaceEntities.delete([workspaceId, 'booking', remote.entityId]);
          tombstones.put({
            id: tombstoneId,
            workspaceId,
            establishmentId: remote.establishmentId,
            entity: 'booking',
            entityId: remote.entityId,
            version: localVersion,
            deletedAt: remote.deletedAt,
            origin: 'supabase',
            remoteVersion: remote.version,
          } satisfies TombstoneRecord);
          this.appendLocalP2pEvent(
            tx,
            workspaceId,
            'booking',
            remote.entityId,
            'delete',
            null,
            remote.deletedAt,
            () => {
              appliedCount += 1;
              processNext();
            },
          );
        };

        entityRequest.onsuccess = () => {
          entityRecord = entityRequest.result as { version?: number } | undefined;
          entityReady = true;
          apply();
        };
        tombstoneRequest.onsuccess = () => {
          previousTombstone = tombstoneRequest.result as TombstoneRecord | undefined;
          tombstoneReady = true;
          apply();
        };
        entityRequest.onerror = () => tx.abort();
        tombstoneRequest.onerror = () => tx.abort();
      }, () => undefined);
    };
    outboxRequest.onerror = () => tx.abort();

    await waitForTransactionCompletion(tx, 'applyRemoteBookingTombstones');
    if (appliedCount > 0) this.emitOutboxChange();
  }

  public async getPendingOutbox(
    workspaceId: string,
    limit = 100,
    options?: { includeFutureRetries?: boolean }
  ): Promise<OutboxRecord[]> {
    if (!workspaceId.trim()) return [];
    await this.openStore();
    if (!this.idb) throw new Error('Outbox is unavailable without IndexedDB.');
    const nowIso = new Date().toISOString();
    const includeFuture = options?.includeFutureRetries === true;
    const tx = this.idb.transaction('outbox', 'readonly');
    const records = await new Promise<OutboxRecord[]>((resolve, reject) => {
      const request = tx.objectStore('outbox').getAll();
      request.onsuccess = () => resolve((request.result as OutboxRecord[])
        .filter((record) =>
          record.workspaceId === workspaceId &&
          record.status === 'pending' &&
          (includeFuture || record.nextAttemptAt <= nowIso)
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, Math.max(1, limit)));
      request.onerror = () => reject(request.error);
    });
    await waitForTransactionCompletion(tx, 'getPendingOutbox');
    return records;
  }

  public async getOutboxSummary(workspaceId: string): Promise<OutboxSummary> {
    if (!workspaceId.trim()) return { pendingCount: 0, failedCount: 0, dueCount: 0 };
    await this.openStore();
    if (!this.idb) return { pendingCount: 0, failedCount: 0, dueCount: 0 };
    const nowIso = new Date().toISOString();
    const tx = this.idb.transaction('outbox', 'readonly');
    const records = await new Promise<OutboxRecord[]>((resolve, reject) => {
      const request = tx.objectStore('outbox').getAll();
      request.onsuccess = () =>
        resolve((request.result as OutboxRecord[]).filter((record) => record.workspaceId === workspaceId));
      request.onerror = () => reject(request.error);
    });
    await waitForTransactionCompletion(tx, 'getOutboxSummary');
    const pendingRecords = records.filter((record) => record.status === 'pending');
    const erroredRecords = records
      .filter((record) => record.status === 'failed' || (record.status === 'pending' && record.attempts > 0))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      pendingCount: pendingRecords.length,
      failedCount: erroredRecords.length,
      dueCount: pendingRecords.filter((record) => record.nextAttemptAt <= nowIso).length,
      lastError: erroredRecords[0]?.lastError,
    };
  }

  public async getTombstones(workspaceId: string): Promise<TombstoneRecord[]> {
    if (!workspaceId.trim()) return [];
    await this.openStore();
    if (!this.idb) return [];
    const tx = this.idb.transaction('tombstones', 'readonly');
    const records = await new Promise<TombstoneRecord[]>((resolve, reject) => {
      const request = tx.objectStore('tombstones').getAll();
      request.onsuccess = () =>
        resolve((request.result as TombstoneRecord[]).filter((record) => record.workspaceId === workspaceId));
      request.onerror = () => reject(request.error);
    });
    await waitForTransactionCompletion(tx, 'getTombstones');
    return records;
  }

  public async markOutboxSynced(id: string): Promise<void> {
    await this.openStore();
    if (!this.idb) throw new Error('Outbox is unavailable without IndexedDB.');
    const tx = this.createStrictTransaction(
      ['outbox', 'tombstones', 'p2pEvents', 'p2pTransportQueue', 'p2pRecordFrontiers', 'workspaceEntities',
        'bookings', 'bookingArchiveRecords', 'bookingArchiveManifests', 'resources', 'invoices', 'resourceGroups'],
    );
    const outbox = tx.objectStore('outbox');
    const request = outbox.get(id);
    request.onsuccess = () => {
      const record = request.result as OutboxRecord | undefined;
      if (!record) return;
      outbox.put({ ...record, status: 'synced', lastError: undefined });
      // A server ACK is not an all-replica tombstone-retention ACK. Never purge
      // tombstones here; peer checkpoint/retention policy owns their collection.
      this.reconcileP2pFrontierAfterAck(tx, record, () => undefined, () => tx.abort());
    };
    request.onerror = () => tx.abort();
    await waitForTransactionCompletion(tx, `markOutboxSynced ${id}`);
    this.emitOutboxChange();
  }

  private reconcileP2pFrontierAfterAck(
    tx: IDBTransaction,
    record: OutboxRecord,
    done: () => void,
    abort: () => void,
  ): void {
    const eventsRequest = tx.objectStore('p2pEvents').index('workspaceEntity')
      .getAll(IDBKeyRange.only([record.workspaceId, record.entity, record.entityId]));
    eventsRequest.onsuccess = () => {
      const state = getP2pRecordState(eventsRequest.result as P2pEvent[]);
      const frontierStore = tx.objectStore('p2pRecordFrontiers');
      if (state.kind === 'missing') {
        done();
        return;
      }
      if (state.kind === 'conflict') {
        frontierStore.put({
          workspaceId: record.workspaceId,
          entity: record.entity,
          entityId: record.entityId,
          status: 'conflict',
          frontier: state.events,
          appliedEventId: null,
          updatedAt: new Date().toISOString(),
        });
        done();
        return;
      }
      const pendingRequest = tx.objectStore('outbox').index('workspaceEntity')
        .getAll(IDBKeyRange.only([record.workspaceId, record.entity, record.entityId]));
      pendingRequest.onsuccess = () => {
        const pending = (pendingRequest.result as OutboxRecord[])
          .some((entry) => entry.status === 'pending' || entry.status === 'failed');
        if (pending) {
          done();
          return;
        }
        const previousRequest = frontierStore.get([record.workspaceId, record.entity, record.entityId]);
        previousRequest.onsuccess = () => {
          const previous = previousRequest.result as { status?: string; appliedEventId?: string } | undefined;
          const finish = () => {
            frontierStore.put({
              workspaceId: record.workspaceId,
              entity: record.entity,
              entityId: record.entityId,
              status: 'resolved',
              frontier: [state.event],
              appliedEventId: state.event.eventId,
              updatedAt: new Date().toISOString(),
            });
            done();
          };
          if (previous?.status === 'resolved' && previous.appliedEventId === state.event.eventId) {
            done();
            return;
          }
          this.applyIndexedDbP2pProjection(tx, state.event, finish, abort);
        };
        previousRequest.onerror = abort;
      };
      pendingRequest.onerror = abort;
    };
    eventsRequest.onerror = abort;
  }

  public async markOutboxFailed(id: string, error: string, nextAttemptAt: string): Promise<void> {
    await this.updateOutboxRecord(id, (record) => ({
      ...record, status: 'pending', attempts: record.attempts + 1, lastError: error, nextAttemptAt,
    }));
    this.emitOutboxChange();
  }

  private async updateOutboxRecord(id: string, update: (record: OutboxRecord) => OutboxRecord): Promise<void> {
    await this.openStore();
    if (!this.idb) throw new Error('Outbox is unavailable without IndexedDB.');
    const tx = this.createStrictTransaction(['outbox']);
    const store = tx.objectStore('outbox');
    const request = store.get(id);
    request.onsuccess = () => { if (request.result) store.put(update(request.result as OutboxRecord)); };
    request.onerror = () => tx.abort();
    await waitForTransactionCompletion(tx, `updateOutboxRecord ${id}`);
  }

  /** Export every IndexedDB object store for an explicit user-requested backup. */
  public async exportSnapshot(): Promise<Record<string, unknown[]>> {
    await this.openStore();
    if (!this.idb) {
      const fallback: Record<string, unknown[]> = {};
      for (const name of ['bookings', 'invoices', 'resources']) {
        try { fallback[name] = JSON.parse(localStorage.getItem(`ob_${name}`) || '[]') as unknown[]; }
        catch { fallback[name] = []; }
      }
      return fallback;
    }

    const names = Array.from(this.idb.objectStoreNames);
    if (names.length === 0) return {};
    const tx = this.idb.transaction(names, 'readonly');
    const transactionComplete = waitForTransactionCompletion(tx, 'exportSnapshot');
    const snapshot = await new Promise<Record<string, unknown[]>>((resolve, reject) => {
      const result: Record<string, unknown[]> = {};
      let remaining = names.length;
      for (const name of names) {
        const request = tx.objectStore(name).getAll();
        request.onsuccess = () => {
          result[name] = request.result as unknown[];
          remaining -= 1;
          if (remaining === 0) resolve(result);
        };
        request.onerror = () => reject(request.error ?? new Error(`Unable to export IndexedDB store ${name}`));
      }
    });
    await transactionComplete;
    return snapshot;
  }

  // Get Store Statistics
  public async getStats(): Promise<IndexedDbStoreStats> {
    await this.openStore();
    const bk = await this.queryStore<TimelineBooking>('bookings');
    const inv = await this.queryStore<InvoiceRecord>('invoices');
    const res = await this.queryStore<ResourceItem>('resources');

    return {
      storeName: this.dbName,
      version: this.dbVersion,
      isOpen: true,
      storeCounts: {
        bookings: bk.total,
        invoices: inv.total,
        resources: res.total,
      },
      indexedFields: ['sector (domain)', 'startDate', 'status', 'guestEmail', 'docNumber'],
      storageType: this.idb ? 'IndexedDB' : 'LocalStorage_Fallback',
    };
  }
}

export const indexedDb = new IndexedDbStore();
