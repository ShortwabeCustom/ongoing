"use client";

import { useOfflineSync } from "@/lib/hooks/useOfflineSync";
import { useEffect, useState } from "react";

export function OfflineIndicator() {
  const { syncStatus } = useOfflineSync();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const { isOnline, isSyncing, queueLength } = syncStatus;

  const getColor = () => {
    if (!isOnline) return "bg-red-500";
    if (isSyncing) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getLabel = () => {
    if (!isOnline) return "Offline";
    if (isSyncing) return `Syncing (${queueLength})`;
    if (queueLength > 0) return `Ready (${queueLength})`;
    return "Online";
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800">
      <div
        className={`w-2 h-2 rounded-full ${getColor()} ${
          isSyncing ? "animate-pulse" : ""
        }`}
      />
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
        {getLabel()}
      </span>
      {queueLength > 0 && !isOnline && (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          ({queueLength} pending)
        </span>
      )}
    </div>
  );
}
