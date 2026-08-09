"use client";

import { useOfflineSync } from "@/lib/hooks/useOfflineSync";
import { useState } from "react";
import type { SyncQueueItem } from "@/lib/services/sync-queue-processor";

export function SyncQueueViewer() {
  const { syncStatus, syncQueue, retryItem, discardItem, triggerSync } =
    useOfflineSync();
  const [isOpen, setIsOpen] = useState(false);

  const failedItems = syncQueue.filter((i) => i.status === "failed");
  const pendingItems = syncQueue.filter((i) => i.status === "pending");

  if (!isOpen && failedItems.length === 0) return null;

  const getStatusColor = (status: SyncQueueItem["status"]) => {
    switch (status) {
      case "completed":
        return "text-green-600 dark:text-green-400";
      case "pending":
        return "text-yellow-600 dark:text-yellow-400";
      case "processing":
        return "text-blue-600 dark:text-blue-400";
      case "failed":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-slate-600 dark:text-slate-400";
    }
  };

  const getStatusBadge = (status: SyncQueueItem["status"]) => {
    const baseClass =
      "px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap";
    switch (status) {
      case "completed":
        return `${baseClass} bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200`;
      case "pending":
        return `${baseClass} bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200`;
      case "processing":
        return `${baseClass} bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200`;
      case "failed":
        return `${baseClass} bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200`;
      default:
        return `${baseClass} bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200`;
    }
  };

  return (
    <>
      {/* Botón flotante si hay items fallidos */}
      {failedItems.length > 0 && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-lg"
        >
          {failedItems.length} Sync Failed
        </button>
      )}

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Sync Queue ({syncQueue.length})
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                ✕
              </button>
            </div>

            {/* Stats */}
            <div className="bg-slate-100 dark:bg-slate-800 p-4 border-b border-slate-200 dark:border-slate-700 flex gap-4">
              <div className="text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  Pending:
                </span>
                <span className="ml-2 font-semibold text-yellow-600 dark:text-yellow-400">
                  {pendingItems.length}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  Failed:
                </span>
                <span className="ml-2 font-semibold text-red-600 dark:text-red-400">
                  {failedItems.length}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  Status:
                </span>
                <span className="ml-2 font-semibold">
                  {syncStatus.isOnline ? "🟢 Online" : "🔴 Offline"}
                </span>
              </div>
            </div>

            {/* Items */}
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {syncQueue.length === 0 ? (
                <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                  Queue is empty
                </div>
              ) : (
                syncQueue.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-700 dark:text-slate-300">
                            {item.method}
                          </code>
                          <span className="text-sm text-slate-700 dark:text-slate-300 font-mono">
                            {item.endpoint}
                          </span>
                          <span className={`text-xs font-medium ${getStatusColor(item.status)}`}>
                            {item.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(item.timestamp).toLocaleString()}
                        </p>
                        {item.error && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            Error: {item.error}
                          </p>
                        )}
                        {item.retries > 0 && (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                            Retries: {item.retries}/3
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      {item.status === "failed" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => retryItem(item.id)}
                            disabled={syncStatus.isSyncing}
                            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            Retry
                          </button>
                          <button
                            onClick={() => discardItem(item.id)}
                            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                          >
                            Discard
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4 flex justify-end gap-2">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300 dark:hover:bg-slate-600"
              >
                Close
              </button>
              {syncStatus.isOnline && (
                <button
                  onClick={() => triggerSync()}
                  disabled={syncStatus.isSyncing}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {syncStatus.isSyncing ? "Syncing..." : "Sync Now"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
