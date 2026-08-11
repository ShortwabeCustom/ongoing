"use client";

import { useEffect, useState, useCallback } from "react";
import { useIndexedDB } from "./useIndexedDB";
import { offlineSessionService } from "@/lib/services/offline-session-service";
import { syncQueueProcessor } from "@/lib/services/sync-queue-processor";
import type { SyncQueueItem } from "@/lib/services/sync-queue-processor";

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  queueLength: number;
  lastSyncAt?: Date;
  error?: string;
}

export function useOfflineSync() {
  const idb = useIndexedDB();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: true,
    isSyncing: false,
    queueLength: 0,
  });
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);

  // Actualizar estado online
  useEffect(() => {
    const unsubscribe = offlineSessionService.onConnectionChange(
      (online) => {
        setSyncStatus((prev) => ({
          ...prev,
          isOnline: online,
          error: undefined,
        }));

        if (online) {
          // Trigger sync cuando vuelve online
          triggerSync();
        }
      }
    );

    return unsubscribe;
  }, []);

  // Cargar sync queue al iniciar
  useEffect(() => {
    loadSyncQueue();
  }, [idb.isReady]);

  const loadSyncQueue = async () => {
    if (!idb.isReady) return;

    const queue = await idb.getSyncQueue();
    setSyncQueue(queue);
    setSyncStatus((prev) => ({
      ...prev,
      queueLength: queue.length,
    }));
  };

  const addToQueue = useCallback(
    async (
      endpoint: string,
      method: "POST" | "PATCH" | "DELETE",
      payload: Record<string, any>,
      idempotencyKey: string
    ): Promise<SyncQueueItem> => {
      const item = syncQueueProcessor.createQueueItem(
        endpoint,
        method,
        payload,
        idempotencyKey
      );

      await idb.addToSyncQueue(item);
      setSyncQueue((prev) => [...prev, item]);
      setSyncStatus((prev) => ({
        ...prev,
        queueLength: prev.queueLength + 1,
      }));

      return item;
    },
    [idb]
  );

  const triggerSync = useCallback(async () => {
    if (syncStatus.isSyncing || !idb.isReady) return;
    if (!syncStatus.isOnline) return;

    const currentQueue = await idb.getSyncQueue();
    if (currentQueue.length === 0) {
      setSyncQueue([]);
      setSyncStatus((prev) => ({ ...prev, queueLength: 0 }));
      return;
    }

    setSyncStatus((prev) => ({ ...prev, isSyncing: true, error: undefined }));

    try {
      const session = await offlineSessionService.getSession();
      const results = await syncQueueProcessor.processBatch(
        currentQueue,
        session?.sessionToken
      );

      await Promise.all(
        currentQueue.map((item) =>
          item.status === "completed"
            ? idb.removeFromQueue(item.id)
            : idb.updateQueueItem(item)
        )
      );

      // Recargar queue actualizada
      const updated = await idb.getSyncQueue();
      setSyncQueue(updated);

      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        queueLength: updated.length,
        lastSyncAt: new Date(),
      }));

      return results;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        error: message,
      }));
      throw err;
    }
  }, [idb, syncStatus.isOnline, syncStatus.isSyncing]);

  const retryItem = useCallback(
    async (itemId: string) => {
      const item = syncQueue.find((i) => i.id === itemId);
      if (!item) return;

      item.status = "pending";
      item.retries = 0;
      await idb.updateQueueItem(item);

      // Actualizar UI
      setSyncQueue((prev) =>
        prev.map((i) => (i.id === itemId ? item : i))
      );

      // Procesar inmediatamente
      await triggerSync();
    },
    [syncQueue, idb, triggerSync]
  );

  const discardItem = useCallback(
    async (itemId: string) => {
      await idb.removeFromQueue(itemId);
      setSyncQueue((prev) => prev.filter((i) => i.id !== itemId));
      setSyncStatus((prev) => ({
        ...prev,
        queueLength: Math.max(0, prev.queueLength - 1),
      }));
    },
    [idb]
  );

  const getPendingItems = useCallback(() => {
    return syncQueue.filter((i) => i.status === "pending");
  }, [syncQueue]);

  const getFailedItems = useCallback(() => {
    return syncQueue.filter((i) => i.status === "failed");
  }, [syncQueue]);

  return {
    // Status
    syncStatus,
    syncQueue,

    // Acciones
    addToQueue,
    triggerSync,
    retryItem,
    discardItem,

    // Queries
    getPendingItems,
    getFailedItems,
  };
}
