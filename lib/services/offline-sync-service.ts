import { idempotencyService } from "./idempotency-service";

const DB_NAME = "pruebas-maria-offline";
const DB_VERSION = 2;

type BackgroundSyncRegistration = ServiceWorkerRegistration & {
  sync?: {
    register: (tag: string) => Promise<void>;
  };
};

function ensureIndex(
  store: IDBObjectStore,
  name: string,
  keyPath: string
): void {
  if (!store.indexNames.contains(name)) {
    store.createIndex(name, keyPath, { unique: false });
  }
}

export const offlineSyncService = {
  // Inicializar IndexedDB
  async initializeDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        const transaction = (e.target as IDBOpenDBRequest).transaction;

        // findings_cache
        const findingsStore = db.objectStoreNames.contains("findings_cache")
          ? transaction?.objectStore("findings_cache")
          : db.createObjectStore("findings_cache", { keyPath: "id" });
        if (findingsStore) {
          ensureIndex(findingsStore, "status", "status");
          ensureIndex(findingsStore, "createdAt", "createdAt");
        }

        // sync_queue
        const queueStore = db.objectStoreNames.contains("sync_queue")
          ? transaction?.objectStore("sync_queue")
          : db.createObjectStore("sync_queue", { keyPath: "id" });
        if (queueStore) {
          ensureIndex(queueStore, "timestamp", "timestamp");
          ensureIndex(queueStore, "status", "status");
        }

        // metadata
        if (!db.objectStoreNames.contains("metadata")) {
          db.createObjectStore("metadata", { keyPath: "key" });
        }
      };

      request.onsuccess = () => resolve((request as IDBOpenDBRequest).result);
      request.onerror = () => reject(request.error);
    });
  },

  // Guardar findings en cache
  async cacheFindings(findings: any[]): Promise<void> {
    const db = await this.initializeDB();

    return new Promise((resolve) => {
      const transaction = db.transaction(["findings_cache"], "readwrite");
      const store = transaction.objectStore("findings_cache");

      findings.forEach((finding) => {
        store.put({
          ...finding,
          cachedAt: new Date(),
        });
      });

      transaction.oncomplete = () => {
        // Guardar timestamp
        this.setMetadata("lastFindingsSync", new Date().toISOString());
        resolve();
      };
    });
  },

  // Obtener findings del cache
  async getCachedFindings(): Promise<any[]> {
    const db = await this.initializeDB();

    return new Promise((resolve) => {
      const transaction = db.transaction(["findings_cache"], "readonly");
      const store = transaction.objectStore("findings_cache");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  },

  // Crear request offline
  async createOfflineRequest(
    endpoint: string,
    method: "POST" | "PATCH" | "DELETE",
    payload: Record<string, any>,
    idempotencyKey: string
  ): Promise<string> {
    const db = await this.initializeDB();
    const id = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["sync_queue"], "readwrite");
      const store = transaction.objectStore("sync_queue");

      const item = {
        id,
        endpoint,
        method,
        payload,
        idempotencyKey,
        timestamp: Date.now(),
        status: "pending",
        retries: 0,
        createdAt: new Date(),
      };

      store.add(item);

      transaction.oncomplete = () => {
        // Notificar Service Worker para background sync
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.ready.then((registration) => {
            const sync = (registration as BackgroundSyncRegistration).sync;
            sync?.register("sync-queue").catch((err: unknown) => {
              console.error("Failed to register background sync:", err);
            });
          });
        }
        resolve(id);
      };

      transaction.onerror = () => reject(transaction.error);
    });
  },

  // Obtener requests pendientes
  async getPendingRequests(): Promise<any[]> {
    const db = await this.initializeDB();

    return new Promise((resolve) => {
      const transaction = db.transaction(["sync_queue"], "readonly");
      const store = transaction.objectStore("sync_queue");
      const index = store.index("status");
      const request = index.getAll("pending");

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  },

  // Obtener todos los requests
  async getAllRequests(): Promise<any[]> {
    const db = await this.initializeDB();

    return new Promise((resolve) => {
      const transaction = db.transaction(["sync_queue"], "readonly");
      const store = transaction.objectStore("sync_queue");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  },

  // Actualizar request
  async updateRequest(
    id: string,
    updates: Partial<any>
  ): Promise<void> {
    const db = await this.initializeDB();

    return new Promise((resolve) => {
      const transaction = db.transaction(["sync_queue"], "readwrite");
      const store = transaction.objectStore("sync_queue");

      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          const updated = { ...item, ...updates };
          store.put(updated);
        }
        resolve();
      };

      getRequest.onerror = () => resolve();
    });
  },

  // Eliminar request
  async removeRequest(id: string): Promise<void> {
    const db = await this.initializeDB();

    return new Promise((resolve) => {
      const transaction = db.transaction(["sync_queue"], "readwrite");
      const store = transaction.objectStore("sync_queue");
      store.delete(id);
      transaction.oncomplete = () => resolve();
    });
  },

  // Metadata helpers
  async getMetadata(key: string): Promise<any> {
    const db = await this.initializeDB();

    return new Promise((resolve) => {
      const transaction = db.transaction(["metadata"], "readonly");
      const store = transaction.objectStore("metadata");
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => resolve(null);
    });
  },

  async setMetadata(key: string, value: any): Promise<void> {
    const db = await this.initializeDB();

    return new Promise((resolve) => {
      const transaction = db.transaction(["metadata"], "readwrite");
      const store = transaction.objectStore("metadata");
      store.put({ key, value, updatedAt: new Date() });
      transaction.oncomplete = () => resolve();
    });
  },

  // Limpiar datos expirados
  async cleanup(maxAgeDays = 7): Promise<number> {
    const db = await this.initializeDB();
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAge;

    return new Promise((resolve) => {
      const transaction = db.transaction(["sync_queue"], "readwrite");
      const store = transaction.objectStore("sync_queue");
      const index = store.index("timestamp");
      const range = IDBKeyRange.upperBound(cutoff);

      const toDelete: any[] = [];

      index.openCursor(range).onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result;
        if (cursor) {
          toDelete.push(cursor.primaryKey);
          cursor.continue();
        } else {
          // Eliminar items
          let count = 0;
          toDelete.forEach((key) => {
            store.delete(key);
            count++;
          });

          transaction.oncomplete = () => resolve(count);
        }
      };
    });
  },

  // Estadísticas
  async getStats(): Promise<{
    cachedFindings: number;
    pendingRequests: number;
    totalRequests: number;
  }> {
    const db = await this.initializeDB();

    return new Promise((resolve) => {
      const transaction = db.transaction(["findings_cache", "sync_queue"], "readonly");

      const findingsStore = transaction.objectStore("findings_cache");
      const queueStore = transaction.objectStore("sync_queue");

      const findingsCount = findingsStore.count();
      const totalQueueCount = queueStore.count();
      const pendingIndex = queueStore.index("status");
      const pendingCount = pendingIndex.count(IDBKeyRange.only("pending"));

      Promise.all([
        new Promise<number>((r) => {
          findingsCount.onsuccess = () => r(findingsCount.result);
        }),
        new Promise<number>((r) => {
          totalQueueCount.onsuccess = () => r(totalQueueCount.result);
        }),
        new Promise<number>((r) => {
          pendingCount.onsuccess = () => r(pendingCount.result);
        }),
      ]).then(([cached, total, pending]) => {
        resolve({
          cachedFindings: cached,
          pendingRequests: pending,
          totalRequests: total,
        });
      });
    });
  },
};
