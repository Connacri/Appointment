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
import { migrateBookingRecordV7 } from './bookingMigration';
import { createP2pEvent, type P2pOperation } from '../services/p2p/protocol';

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

export type OutboxEntity =
  | 'booking'
  | 'resource'
  | 'resource_group'
  | 'establishment'
  | 'task'
  | 'stock_item'
  | 'invoice';
export type OutboxOperation = 'upsert' | 'delete';
export type OutboxStatus = 'pending' | 'synced' | 'failed';
export interface OutboxRecord {
  id: string; idempotencyKey: string; workspaceId: string; establishmentId?: string;
  entity: OutboxEntity; entityId: string; operation: OutboxOperation; version: number;
  payload: Record<string, unknown> | null; status: OutboxStatus; attempts: number;
  createdAt: string; nextAttemptAt: string; lastError?: string;
}
export interface TombstoneRecord {
  id: string; workspaceId: string; establishmentId?: string; entity: OutboxEntity;
  entityId: string; version: number; deletedAt: string;
}
export interface OutboxMutationContext { workspaceId: string; establishmentId?: string; }
export interface OutboxSummary {
  pendingCount: number;
  failedCount: number;
  dueCount: number;
  lastError?: string;
}

class IndexedDbStore {
  // Preserve the legacy database identifier so existing browser data remains accessible.
  private dbName = 'OmniBook_ObjectBox_Store';
  private dbVersion = 8;
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

        // v7 upgrade: index sector+startDate and normalize existing local booking records without data loss.
        const upgradeTx = (e.target as IDBOpenDBRequest).transaction;
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
              const row = cursor.value as { entity?: OutboxEntity; payload?: Record<string, unknown> };
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
  public async replaceStore<T extends { id: string }>(storeName: 'issuedCards' | 'resourceGroups', items: T[]): Promise<void> {
    await this.openStore();
    if (!this.idb) {
      localStorage.setItem(`ob_${storeName}`, JSON.stringify(items));
      return;
    }
    const tx = this.idb.transaction(storeName, 'readwrite');
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

    const tx = this.idb.transaction('eventLogs', 'readwrite');
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
      const tx = this.idb.transaction('eventLogs', 'readwrite');
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
    storeName: 'bookings' | 'invoices' | 'resources',
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

  // Atomically replace a collection snapshot. This removes rows deleted from app state.
  public async replaceAll<T extends { id: string }>(
    storeName: 'bookings' | 'invoices' | 'resources',
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
        const tx = this.idb.transaction(storeName, 'readwrite');
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
    storeName: 'bookings' | 'invoices' | 'resources',
    item: T
  ): Promise<void> {
    const normalizedItem =
      storeName === 'bookings'
        ? (migrateBookingRecordV7(item as Partial<TimelineBooking>) as T)
        : item;
    this.beginSyncOp();
    try {
      await this.openStore();

      if (this.idb) {
        const tx = this.idb.transaction(storeName, 'readwrite');
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

  // Remove — guarantees complete deletion from both IDB and fallback store
  public async remove(
    storeName: 'bookings' | 'invoices' | 'resources',
    id: string
  ): Promise<void> {
    this.beginSyncOp();
    try {
      await this.openStore();

      if (this.idb) {
        const tx = this.idb.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).delete(id);
        await waitForTransactionCompletion(tx, `remove ${storeName}/${id}`);

        // IndexedDB is authoritative; no duplicate localStorage snapshot is maintained.
        return;
      }

      // In fallback mode localStorage is the primary store; propagate failures.
      const raw = localStorage.getItem(`ob_${storeName}`);
      if (raw) {
        const list = JSON.parse(raw) as Array<{ id: string }>;
        localStorage.setItem(
          `ob_${storeName}`,
          JSON.stringify(list.filter((entry) => entry.id !== id))
        );
      }
    } finally {
      this.endSyncOp();
    }
  }

  // Clear all stores completely (for legal GDPR / Account Deletion purge).
  // Reject on transaction failure so the caller cannot falsely report a successful deletion.
  public async clearAll(): Promise<void> {
    this.beginSyncOp();
    try {
      await this.openStore();

      if (this.idb) {
        const tx = this.idb.transaction(['bookings', 'invoices', 'resources', 'outbox', 'tombstones', 'workspaceEntities', 'issuedCards', 'resourceGroups', 'eventLogs', 'p2pEvents', 'p2pClock', 'p2pMeta', 'p2pPeerCursors', 'p2pRecordFrontiers'], 'readwrite');
        tx.objectStore('bookings').clear();
        tx.objectStore('invoices').clear();
        tx.objectStore('resources').clear();
        tx.objectStore('outbox').clear();
        tx.objectStore('tombstones').clear();
        tx.objectStore('workspaceEntities').clear();
        tx.objectStore('issuedCards').clear();
        tx.objectStore('resourceGroups').clear();
        tx.objectStore('eventLogs').clear();
        tx.objectStore('p2pEvents').clear();
        tx.objectStore('p2pClock').clear();
        tx.objectStore('p2pMeta').clear();
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
   * Append a local immutable P2P event and advance every observed vector-clock component
   * inside the caller's existing business+Outbox IndexedDB transaction.
   */
  private appendLocalP2pEvent(
    tx: IDBTransaction,
    workspaceId: string,
    entity: OutboxEntity,
    entityId: string,
    operation: P2pOperation,
    payload: Record<string, unknown> | null,
    createdAt: string,
  ): void {
    const metaStore = tx.objectStore('p2pMeta');
    const clockStore = tx.objectStore('p2pClock');
    let nodeId: string | undefined;
    let clockRows: Array<{ workspaceId: string; nodeId: string; sequence: number }> = [];
    let metaReady = false;
    let clockReady = false;

    const finish = () => {
      if (!metaReady || !clockReady) return;
      try {
        nodeId ??= this.createId();
        metaStore.put({ key: 'nodeId', value: nodeId });
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
        for (const [clockNodeId, sequence] of Object.entries(event.clock)) {
          clockStore.put({ workspaceId, nodeId: clockNodeId, sequence });
        }
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
    storeName: 'bookings' | 'invoices' | 'resources', item: T,
    context: OutboxMutationContext, entity: OutboxEntity
  ): Promise<void> {
    if (!context.workspaceId.trim()) throw new Error('Workspace isolation required for outbox writes.');
    await this.openStore();
    if (!this.idb) throw new Error('Transactional outbox requires IndexedDB; localStorage fallback is not safe for cloud sync.');
    const tx = this.idb.transaction([storeName, 'outbox', 'tombstones', 'workspaceEntities', 'p2pEvents', 'p2pClock', 'p2pMeta'], 'readwrite');
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
      const version = Math.max(current?.version ?? 0, previousTombstone?.version ?? 0) + 1;
      const now = new Date().toISOString();
      const baseItem =
        storeName === 'bookings'
          ? (migrateBookingRecordV7(item as Partial<TimelineBooking>) as T)
          : item;
      const persisted = { ...baseItem, workspaceId: context.workspaceId, establishmentId: context.establishmentId, syncVersion: version, deletedAt: null };
      const entityRecord = {
        workspaceId: context.workspaceId, establishmentId: context.establishmentId,
        entity, entityId: item.id, version, updatedAt: now, payload: persisted,
      };
      workspaceEntities.put(entityRecord);
      store.put(persisted);
      // Keep prior tombstones until the matching delete event receives a server ACK.
      tx.objectStore('outbox').add(this.createOutboxRecord(context, entity, item.id, 'upsert', version, persisted as Record<string, unknown>, now));
      this.appendLocalP2pEvent(tx, context.workspaceId, entity, item.id, 'upsert', persisted as Record<string, unknown>, now);
    };
    request.onsuccess = () => { current = request.result as { version?: number } | undefined; entityReady = true; commitMutation(); };
    tombstoneRequest.onsuccess = () => { previousTombstone = tombstoneRequest.result as TombstoneRecord | undefined; tombstoneReady = true; commitMutation(); };
    request.onerror = () => tx.abort();
    tombstoneRequest.onerror = () => tx.abort();
    await waitForTransactionCompletion(tx, `putWithOutbox ${entity}/${item.id}`);
    this.emitOutboxChange();
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
    storeName: 'bookings' | 'invoices' | 'resources',
    item: T,
    context: OutboxMutationContext,
    entity: OutboxEntity,
    idempotencyKey: string,
    version?: number,
  ): Promise<void> {
    if (!context.workspaceId.trim()) throw new Error('Workspace isolation required for outbox writes.');
    await this.openStore();
    if (!this.idb) throw new Error('Transactional outbox requires IndexedDB; localStorage fallback is not safe for cloud sync.');

    const existing = await this.getOutboxRecordByIdempotencyKey(context.workspaceId, idempotencyKey);
    if (existing) {
      // Idempotent backfill: keep the existing Outbox intent and only restore a
      // missing operational row. Never overwrite newer local state with the
      // snapshot the plan was built from.
      const storeTx = this.idb.transaction(storeName, 'readwrite');
      const store = storeTx.objectStore(storeName);
      const current = await new Promise<T | undefined>((resolve) => {
        const req = store.get(item.id);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => resolve(undefined);
      });
      if (!current) {
        const persisted = { ...item, workspaceId: context.workspaceId, establishmentId: context.establishmentId, deletedAt: null };
        store.put(persisted);
      }
      await waitForTransactionCompletion(storeTx, `putWithOutboxByKey-idempotent ${entity}/${item.id}`);
      this.emitOutboxChange();
      return;
    }

    const tx = this.idb.transaction([storeName, 'outbox', 'tombstones', 'workspaceEntities', 'p2pEvents', 'p2pClock', 'p2pMeta'], 'readwrite');
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
   * Enqueue exactly one Outbox mutation guarded by an explicit idempotency key,
   * without touching any operational store. Used for entities that have no local
   * IndexedDB store (e.g. establishments) where the remote row is the source of
   * truth after the push ACK. Idempotent: any record with the same key for this
   * workspace/entity is not duplicated (failed records keep retrying in place).
   */
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
    await this.openStore();
    if (!this.idb) throw new Error('Transactional outbox requires IndexedDB; localStorage fallback is not safe for cloud sync.');

    const existing = await this.getOutboxRecordByIdempotencyKey(context.workspaceId, idempotencyKey);
    if (existing) {
      this.emitOutboxChange();
      return;
    }

    const now = new Date().toISOString();
    const tx = this.idb.transaction(['outbox', 'workspaceEntities', 'p2pEvents', 'p2pClock', 'p2pMeta'], 'readwrite');
    const outbox = tx.objectStore('outbox');
    const workspaceEntities = tx.objectStore('workspaceEntities');
    const entityRecord = {
      workspaceId: context.workspaceId, establishmentId: context.establishmentId,
      entity, entityId, version, updatedAt: now, payload: payload ?? {},
    };
    workspaceEntities.put(entityRecord);
    outbox.add(this.createOutboxRecord(context, entity, entityId, operation, version, payload, now, idempotencyKey));
    this.appendLocalP2pEvent(tx, context.workspaceId, entity, entityId, operation, payload, now);
    await waitForTransactionCompletion(tx, `enqueueOutboxOnly ${entity}/${entityId}`);
    this.emitOutboxChange();
  }

  /** Atomically delete the local row and retain a workspace-scoped tombstone + delete intent. */
  public async deleteWithOutbox(
    storeName: 'bookings' | 'invoices' | 'resources', entityId: string,
    context: OutboxMutationContext, entity: OutboxEntity
  ): Promise<void> {
    if (!context.workspaceId.trim()) throw new Error('Workspace isolation required for outbox deletes.');
    await this.openStore();
    if (!this.idb) throw new Error('Transactional outbox requires IndexedDB; localStorage fallback is not safe for cloud sync.');
    const tx = this.idb.transaction([storeName, 'outbox', 'tombstones', 'workspaceEntities', 'p2pEvents', 'p2pClock', 'p2pMeta'], 'readwrite');
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
        entity, entityId, version, deletedAt,
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
    const tx = this.idb.transaction(['outbox', 'tombstones'], 'readwrite');
    const outbox = tx.objectStore('outbox');
    const request = outbox.get(id);
    request.onsuccess = () => {
      const record = request.result as OutboxRecord | undefined;
      if (!record) return;
      outbox.put({ ...record, status: 'synced', lastError: undefined });
      if (record.operation === 'delete') {
        const tombstoneId = `${record.workspaceId}:${record.entity}:${record.entityId}`;
        const tombstoneRequest = tx.objectStore('tombstones').get(tombstoneId);
        tombstoneRequest.onsuccess = () => {
          const tombstone = tombstoneRequest.result as TombstoneRecord | undefined;
          if (tombstone && tombstone.version === record.version) {
            tx.objectStore('tombstones').delete(tombstoneId);
          }
        };
        tombstoneRequest.onerror = () => tx.abort();
      }
    };
    request.onerror = () => tx.abort();
    await waitForTransactionCompletion(tx, `markOutboxSynced ${id}`);
    this.emitOutboxChange();
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
    const tx = this.idb.transaction('outbox', 'readwrite');
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
