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
    if (!isOnline) return "bg-[#ed765e]";
    if (isSyncing) return "bg-[#f2b84b]";
    return "bg-[#7bf0b1]";
  };

  const getLabel = () => {
    if (!isOnline) return "Offline";
    if (isSyncing) return `Syncing (${queueLength})`;
    if (queueLength > 0) return `Ready (${queueLength})`;
    return "Online";
  };

  return (
    <div className="flex h-9 items-center gap-2 rounded-full border border-white/14 bg-white/8 px-3">
      <div
        className={`w-2 h-2 rounded-full ${getColor()} ${
          isSyncing ? "animate-pulse" : ""
        }`}
      />
      <span className="text-xs font-semibold text-white/76">
        {getLabel()}
      </span>
      {queueLength > 0 && !isOnline && (
        <span className="text-xs text-white/58">
          ({queueLength} pending)
        </span>
      )}
    </div>
  );
}
