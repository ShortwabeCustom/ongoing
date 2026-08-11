"use client";

import { useServiceWorker } from "@/lib/hooks/useServiceWorker";

export function ServiceWorkerRegister() {
  useServiceWorker();
  return null;
}
