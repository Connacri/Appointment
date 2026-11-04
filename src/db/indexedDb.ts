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
import { waitForTransactionCompletion } from './indexedDbTransaction';

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

export type OutboxEntity = 'booking' | 'resource' | 'establishment' | 'task' | 'stock_item' | 'invoice';
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

class IndexedDbStore {
  // Preserve the legacy database identifier so existing browser data remains accessible.
  private dbName = 'OmniBook_ObjectBox_Store';
  private dbVersion = 3;
  private idb: IDBDatabase | null = null;
  private isInitialized = false;
  private syncState: IndexedDbSyncState = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'synced';
  private syncListeners = new Set<(status: IndexedDbSyncState) => void>();
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
          for (const item of items) {
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

        // IndexedDB is authoritative. The localStorage snapshot is only a fallback mirror.
        try {
          localStorage.setItem(`ob_${storeName}`, JSON.stringify(items));
        } catch (error) {
          console.warn('[IndexedDB] Snapshot fallback mirror failed:', error);
        }
        return;
      }

      // In fallback mode this is the primary store, so failure must reach the caller.
      localStorage.setItem(`ob_${storeName}`, JSON.stringify(items));
    } finally {
      this.endSyncOp();
    }
  }

  // Put / Upsert
  public async put<T extends { id: string }>(
    storeName: 'bookings' | 'invoices' | 'resources',
    item: T
  ): Promise<void> {
    this.beginSyncOp();
    try {
      await this.openStore();

      if (this.idb) {
        const tx = this.idb.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(item);
        await waitForTransactionCompletion(tx, `put ${storeName}/${item.id}`);

        // Keep the fallback mirror best-effort; it is never authoritative when IDB is available.
        try {
          const raw = localStorage.getItem(`ob_${storeName}`);
          const list: T[] = raw ? JSON.parse(raw) : [];
          localStorage.setItem(
            `ob_${storeName}`,
            JSON.stringify([...list.filter((entry) => entry.id !== item.id), item])
          );
        } catch (error) {
          console.warn('[IndexedDB] Fallback mirror update failed:', error);
        }
        return;
      }

      // In fallback mode localStorage is the primary store; propagate quota/security errors.
      const raw = localStorage.getItem(`ob_${storeName}`);
      const list: T[] = raw ? JSON.parse(raw) : [];
      localStorage.setItem(
        `ob_${storeName}`,
        JSON.stringify([...list.filter((entry) => entry.id !== item.id), item])
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

        try {
          const raw = localStorage.getItem(`ob_${storeName}`);
          if (raw) {
            const list = JSON.parse(raw) as Array<{ id: string }>;
            localStorage.setItem(
              `ob_${storeName}`,
              JSON.stringify(list.filter((entry) => entry.id !== id))
            );
          }
        } catch (error) {
          console.warn('[IndexedDB] Fallback mirror remove failed:', error);
        }
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
        const tx = this.idb.transaction(['bookings', 'invoices', 'resources', 'outbox', 'tombstones', 'workspaceEntities'], 'readwrite');
        tx.objectStore('bookings').clear();
        tx.objectStore('invoices').clear();
        tx.objectStore('resources').clear();
        tx.objectStore('outbox').clear();
        tx.objectStore('tombstones').clear();
        tx.objectStore('workspaceEntities').clear();
        await waitForTransactionCompletion(tx, 'clear all stores');
      }

      // Clear the fallback only after the authoritative IDB transaction commits.
      for (const storeName of ['bookings', 'invoices', 'resources'] as const) {
        localStorage.removeItem(`ob_${storeName}`);
      }
    } finally {
      this.endSyncOp();
    }
  }

  private createId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  private createOutboxRecord(context: OutboxMutationContext, entity: OutboxEntity, entityId: string,
    operation: OutboxOperation, version: number, payload: Record<string, unknown> | null, now: string): OutboxRecord {
    if (!context.workspaceId.trim()) throw new Error('A workspace is required before queuing a cloud mutation.');
    return {
      id: this.createId(),
      idempotencyKey: `${context.workspaceId}:${entity}:${entityId}:${version}`,
      workspaceId: context.workspaceId,
      establishmentId: context.establishmentId,
      entity, entityId, operation, version, payload,
      status: 'pending', attempts: 0, createdAt: now, nextAttemptAt: now,
    };
  }

  /** Opt-in only: demo/bootstrap data must never call this method. */
  public async putWithOutbox<T extends { id: string }>(
    storeName: 'bookings' | 'invoices' | 'resources', item: T,
    context: OutboxMutationContext, entity: OutboxEntity
  ): Promise<void> {
    if (!context.workspaceId.trim()) throw new Error('Workspace isolation required for outbox writes.');
    await this.openStore();
    if (!this.idb) throw new Error('Transactional outbox requires IndexedDB; localStorage fallback is not safe for cloud sync.');
    const tx = this.idb.transaction([storeName, 'outbox', 'tombstones', 'workspaceEntities'], 'readwrite');
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
      const persisted = { ...item, workspaceId: context.workspaceId, establishmentId: context.establishmentId, syncVersion: version, deletedAt: null };
      const entityRecord = {
        workspaceId: context.workspaceId, establishmentId: context.establishmentId,
        entity, entityId: item.id, version, updatedAt: now, payload: persisted,
      };
      workspaceEntities.put(entityRecord);
      store.put(persisted);
      // Keep prior tombstones until the matching delete event receives a server ACK.
      tx.objectStore('outbox').add(this.createOutboxRecord(context, entity, item.id, 'upsert', version, persisted as Record<string, unknown>, now));
    };
    request.onsuccess = () => { current = request.result as { version?: number } | undefined; entityReady = true; commitMutation(); };
    tombstoneRequest.onsuccess = () => { previousTombstone = tombstoneRequest.result as TombstoneRecord | undefined; tombstoneReady = true; commitMutation(); };
    request.onerror = () => tx.abort();
    tombstoneRequest.onerror = () => tx.abort();
    await waitForTransactionCompletion(tx, `putWithOutbox ${entity}/${item.id}`);
  }

  /** Atomically delete the local row and retain a workspace-scoped tombstone + delete intent. */
  public async deleteWithOutbox(
    storeName: 'bookings' | 'invoices' | 'resources', entityId: string,
    context: OutboxMutationContext, entity: OutboxEntity
  ): Promise<void> {
    if (!context.workspaceId.trim()) throw new Error('Workspace isolation required for outbox deletes.');
    await this.openStore();
    if (!this.idb) throw new Error('Transactional outbox requires IndexedDB; localStorage fallback is not safe for cloud sync.');
    const tx = this.idb.transaction([storeName, 'outbox', 'tombstones', 'workspaceEntities'], 'readwrite');
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
    };
    request.onsuccess = () => { current = request.result as { version?: number } | undefined; entityReady = true; commitDelete(); };
    tombstoneRequest.onsuccess = () => { previousTombstone = tombstoneRequest.result as TombstoneRecord | undefined; tombstoneReady = true; commitDelete(); };
    request.onerror = () => tx.abort();
    tombstoneRequest.onerror = () => tx.abort();
    await waitForTransactionCompletion(tx, `deleteWithOutbox ${entity}/${entityId}`);
  }

  public async getPendingOutbox(workspaceId: string, limit = 100): Promise<OutboxRecord[]> {
    if (!workspaceId.trim()) return [];
    await this.openStore();
    if (!this.idb) throw new Error('Outbox is unavailable without IndexedDB.');
    const tx = this.idb.transaction('outbox', 'readonly');
    const records = await new Promise<OutboxRecord[]>((resolve, reject) => {
      const request = tx.objectStore('outbox').getAll();
      request.onsuccess = () => resolve((request.result as OutboxRecord[])
        .filter((record) => record.workspaceId === workspaceId && record.status === 'pending' && record.nextAttemptAt <= new Date().toISOString())
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, Math.max(1, limit)));
      request.onerror = () => reject(request.error);
    });
    await waitForTransactionCompletion(tx, 'getPendingOutbox');
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
  }

  public async markOutboxFailed(id: string, error: string, nextAttemptAt: string): Promise<void> {
    await this.updateOutboxRecord(id, (record) => ({
      ...record, status: 'pending', attempts: record.attempts + 1, lastError: error, nextAttemptAt,
    }));
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
    await waitForTransactionCompletion(tx, 'exportSnapshot');
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
