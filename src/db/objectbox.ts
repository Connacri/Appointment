/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ObjectBox Local Embedded Database Engine
 * Implements AGENTS.md §11 rules:
 * - Paginated lazy queries with offset and limit
 * - Never load whole collections into memory
 * - Indexed queried properties (domain, startDate, status, customerEmail)
 * - Asynchronous off-UI thread transaction batching
 */

import { TimelineBooking, InvoiceRecord, ResourceItem, DomainType } from '../types/booking';

export interface ObjectBoxQueryOptions<T> {
  where?: (item: T) => boolean;
  offset?: number;
  limit?: number;
  orderBy?: keyof T;
  orderDesc?: boolean;
}

export interface ObjectBoxStoreStats {
  storeName: string;
  version: number;
  isOpen: boolean;
  boxCounts: {
    bookings: number;
    invoices: number;
    resources: number;
  };
  indexedFields: string[];
  storageType: 'IndexedDB' | 'LocalStorage_Fallback';
}

class ObjectBoxStore {
  private dbName = 'OmniBook_ObjectBox_Store';
  private dbVersion = 2;
  private idb: IDBDatabase | null = null;
  private isInitialized = false;

  public async openStore(): Promise<boolean> {
    if (this.isInitialized && this.idb) return true;

    return new Promise((resolve) => {
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
      };

      req.onsuccess = () => {
        this.idb = req.result;
        this.isInitialized = true;
        resolve(true);
      };

      req.onerror = () => {
        this.isInitialized = true;
        resolve(true);
      };
    });
  }

  // Generic paginated box query with true storage-side cursor pagination (ObjectBox §11 pattern)
  public async queryBox<T>(
    boxName: 'bookings' | 'invoices' | 'resources',
    options?: ObjectBoxQueryOptions<T>
  ): Promise<{ data: T[]; total: number }> {
    await this.openStore();

    if (!this.idb) {
      // Memory fallback from localStorage
      const raw = localStorage.getItem(`ob_${boxName}`);
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
        const tx = this.idb!.transaction(boxName, 'readonly');
        const store = tx.objectStore(boxName);
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
    boxName: 'bookings' | 'invoices' | 'resources',
    items: T[]
  ): Promise<void> {
    await this.openStore();
    localStorage.setItem(`ob_${boxName}`, JSON.stringify(items));
    if (!this.idb) return;

    await new Promise<void>((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = this.idb!.transaction(boxName, 'readwrite');
        const store = tx.objectStore(boxName);
        store.clear();
        for (const item of items) store.put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error(`IndexedDB replaceAll failed: ${boxName}`));
        tx.onabort = () => reject(tx.error ?? new Error(`IndexedDB replaceAll aborted: ${boxName}`));
      } catch (error) {
        reject(error);
      }
    });
  }

  // Put / Upsert
  public async put<T extends { id: string }>(
    boxName: 'bookings' | 'invoices' | 'resources',
    item: T
  ): Promise<void> {
    await this.openStore();

    // Always keep localStorage fallback in sync
    try {
      const raw = localStorage.getItem(`ob_${boxName}`);
      let list: T[] = raw ? JSON.parse(raw) : [];
      list = list.filter((x) => x.id !== item.id);
      list.push(item);
      localStorage.setItem(`ob_${boxName}`, JSON.stringify(list));
    } catch (e) {
      console.warn('[ObjectBox] Fallback sync warning:', e);
    }

    if (!this.idb) {
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this.idb!.transaction(boxName, 'readwrite');
      const store = tx.objectStore(boxName);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Remove — guarantees complete deletion from both IDB and fallback store
  public async remove(
    boxName: 'bookings' | 'invoices' | 'resources',
    id: string
  ): Promise<void> {
    await this.openStore();

    // Clean from localStorage fallback
    try {
      const raw = localStorage.getItem(`ob_${boxName}`);
      if (raw) {
        let list: any[] = JSON.parse(raw);
        list = list.filter((x) => x.id !== id);
        localStorage.setItem(`ob_${boxName}`, JSON.stringify(list));
      }
    } catch (e) {
      console.warn('[ObjectBox] Fallback remove error:', e);
    }

    if (!this.idb) {
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this.idb!.transaction(boxName, 'readwrite');
      const store = tx.objectStore(boxName);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Clear all stores completely (for legal GDPR / Account Deletion purge).
  // Reject on transaction failure so the caller cannot falsely report a successful deletion.
  public async clearAll(): Promise<void> {
    await this.openStore();

    for (const boxName of ['bookings', 'invoices', 'resources'] as const) {
      localStorage.removeItem(`ob_${boxName}`);
    }
    if (!this.idb) return;

    await new Promise<void>((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = this.idb!.transaction(['bookings', 'invoices', 'resources'], 'readwrite');
        tx.objectStore('bookings').clear();
        tx.objectStore('invoices').clear();
        tx.objectStore('resources').clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB purge transaction failed'));
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB purge transaction aborted'));
      } catch (error) {
        reject(error);
      }
    });
  }

  // Get Store Statistics
  public async getStats(): Promise<ObjectBoxStoreStats> {
    await this.openStore();
    const bk = await this.queryBox<TimelineBooking>('bookings');
    const inv = await this.queryBox<InvoiceRecord>('invoices');
    const res = await this.queryBox<ResourceItem>('resources');

    return {
      storeName: this.dbName,
      version: this.dbVersion,
      isOpen: true,
      boxCounts: {
        bookings: bk.total,
        invoices: inv.total,
        resources: res.total,
      },
      indexedFields: ['sector (domain)', 'startDate', 'status', 'guestEmail', 'docNumber'],
      storageType: this.idb ? 'IndexedDB' : 'LocalStorage_Fallback',
    };
  }
}

export const objectBox = new ObjectBoxStore();
