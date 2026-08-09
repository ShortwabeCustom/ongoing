"use client";

import { useEffect, useState } from "react";
import type { SyncQueueItem } from "@/lib/services/sync-queue-processor";

const DB_NAME = "pruebas-maria-offline";
const DB_VERSION = 1;

export interface Finding {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
}

export function useIndexedDB() {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initializeDB();
  }, []);

  const initializeDB = async () => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const database = (e.target as IDBOpenDBRequest).result;

        // findings_cache store
        if (!database.objectStoreNames.contains("findings_cache")) {
          const findingsStore = database.createObjectStore("findings_cache", {
            keyPath: "id",
          });
          findingsStore.createIndex("status", "status", { unique: false });
          findingsStore.createIndex("createdAt", "createdAt", {
            unique: false,
          });
        }

        // sync_queue store
        if (!database.objectStoreNames.contains("sync_queue")) {
          const queueStore = database.createObjectStore("sync_queue", {
            keyPath: "id",
          });
          queueStore.createIndex("timestamp", "timestamp", { unique: false });
          queueStore.createIndex("status", "status", { unique: false });
        }

        // metadata store
        if (!database.objectStoreNames.contains("metadata")) {
          database.createObjectStore("metadata", { keyPath: "key" });
        }
      };

      request.onsuccess = () => {
        setDb((request as IDBOpenDBRequest).result);
        setIsReady(true);
      };

      request.onerror = () => {
        console.error("Failed to open IndexedDB:", request.error);
      };
    } catch (err) {
      console.error("IndexedDB not available:", err);
    }
  };

  const getCachedFindings = async (): Promise<Finding[]> => {
    if (!db) return [];

    return new Promise((resolve) => {
      const transaction = db.transaction(["findings_cache"], "readonly");
      const store = transaction.objectStore("findings_cache");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve([]);
    });
  };

  const cacheFinding = async (finding: Finding): Promise<void> => {
    if (!db) return;

    return new Promise((resolve) => {
      const transaction = db.transaction(["findings_cache"], "readwrite");
      const store = transaction.objectStore("findings_cache");
      store.put(finding);
      resolve();
    });
  };

  const cacheFindings = async (findings: Finding[]): Promise<void> => {
    if (!db) return;

    return new Promise((resolve) => {
      const transaction = db.transaction(["findings_cache"], "readwrite");
      const store = transaction.objectStore("findings_cache");

      findings.forEach((finding) => store.put(finding));
      transaction.oncomplete = () => resolve();
    });
  };

  const addToSyncQueue = async (item: SyncQueueItem): Promise<void> => {
    if (!db) return;

    return new Promise((resolve) => {
      const transaction = db.transaction(["sync_queue"], "readwrite");
      const store = transaction.objectStore("sync_queue");
      store.put(item);
      transaction.oncomplete = () => resolve();
    });
  };

  const getSyncQueue = async (): Promise<SyncQueueItem[]> => {
    if (!db) return [];

    return new Promise((resolve) => {
      const transaction = db.transaction(["sync_queue"], "readonly");
      const store = transaction.objectStore("sync_queue");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve([]);
    });
  };

  const updateQueueItem = async (item: SyncQueueItem): Promise<void> => {
    if (!db) return;

    return new Promise((resolve) => {
      const transaction = db.transaction(["sync_queue"], "readwrite");
      const store = transaction.objectStore("sync_queue");
      store.put(item);
      transaction.oncomplete = () => resolve();
    });
  };

  const removeFromQueue = async (itemId: string): Promise<void> => {
    if (!db) return;

    return new Promise((resolve) => {
      const transaction = db.transaction(["sync_queue"], "readwrite");
      const store = transaction.objectStore("sync_queue");
      store.delete(itemId);
      transaction.oncomplete = () => resolve();
    });
  };

  const getMetadata = async (key: string): Promise<any> => {
    if (!db) return null;

    return new Promise((resolve) => {
      const transaction = db.transaction(["metadata"], "readonly");
      const store = transaction.objectStore("metadata");
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => resolve(null);
    });
  };

  const setMetadata = async (key: string, value: any): Promise<void> => {
    if (!db) return;

    return new Promise((resolve) => {
      const transaction = db.transaction(["metadata"], "readwrite");
      const store = transaction.objectStore("metadata");
      store.put({ key, value, updatedAt: new Date() });
      transaction.oncomplete = () => resolve();
    });
  };

  const clearAll = async (): Promise<void> => {
    if (!db) return;

    return new Promise((resolve) => {
      const transaction = db.transaction(
        ["findings_cache", "sync_queue", "metadata"],
        "readwrite"
      );

      transaction.objectStore("findings_cache").clear();
      transaction.objectStore("sync_queue").clear();
      transaction.objectStore("metadata").clear();

      transaction.oncomplete = () => resolve();
    });
  };

  return {
    isReady,
    getCachedFindings,
    cacheFinding,
    cacheFindings,
    addToSyncQueue,
    getSyncQueue,
    updateQueueItem,
    removeFromQueue,
    getMetadata,
    setMetadata,
    clearAll,
  };
}
