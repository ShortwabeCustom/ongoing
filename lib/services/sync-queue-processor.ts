import { nanoid } from "nanoid";

export interface SyncQueueItem {
  id: string;
  endpoint: string;
  method: "POST" | "PATCH" | "DELETE";
  payload: Record<string, any>;
  idempotencyKey: string;
  timestamp: number;
  status: "pending" | "processing" | "completed" | "failed";
  retries: number;
  error?: string;
  createdAt: Date;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

export const syncQueueProcessor = {
  // Crear item para queue
  createQueueItem(
    endpoint: string,
    method: "POST" | "PATCH" | "DELETE",
    payload: Record<string, any>,
    idempotencyKey: string
  ): SyncQueueItem {
    return {
      id: nanoid(),
      endpoint,
      method,
      payload,
      idempotencyKey,
      timestamp: Date.now(),
      status: "pending",
      retries: 0,
      createdAt: new Date(),
    };
  },

  // Procesar item offline
  async processItem(
    item: SyncQueueItem,
    sessionToken?: string
  ): Promise<{
    success: boolean;
    response?: Record<string, any>;
    error?: string;
  }> {
    if (item.status === "processing") {
      return { success: false, error: "Item already processing" };
    }

    item.status = "processing";

    try {
      const response = await fetch(
        `${window.location.origin}${item.endpoint}`,
        {
          method: item.method,
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": item.idempotencyKey,
            ...(sessionToken && { Authorization: `Bearer ${sessionToken}` }),
          },
          body: JSON.stringify(item.payload),
          credentials: "include",
        }
      );

      if (response.ok) {
        item.status = "completed";
        const data = await response.json();
        return { success: true, response: data };
      }

      // 409 Duplicate — usar cached response (éxito)
      if (response.status === 409) {
        item.status = "completed";
        const data = await response.json();
        return {
          success: true,
          response: data.data?.cached_response || data,
        };
      }

      // 401 Unauthorized — logout required
      if (response.status === 401) {
        item.status = "failed";
        item.error = "Session expired";
        return { success: false, error: "Unauthorized" };
      }

      // Error 5xx — retry
      if (response.status >= 500) {
        if (item.retries < MAX_RETRIES) {
          item.status = "pending";
          item.retries++;
          return {
            success: false,
            error: `Server error. Retry ${item.retries}/${MAX_RETRIES}`,
          };
        }
        item.status = "failed";
        item.error = "Max retries exceeded";
        return { success: false, error: "Server error after max retries" };
      }

      // Otros errores
      item.status = "failed";
      const errorData = await response.json().catch(() => ({}));
      item.error = errorData.error || `HTTP ${response.status}`;
      return { success: false, error: item.error };
    } catch (err) {
      // Error de conexión — retry
      if (item.retries < MAX_RETRIES) {
        item.status = "pending";
        item.retries++;
        return {
          success: false,
          error: `Network error. Retry ${item.retries}/${MAX_RETRIES}`,
        };
      }

      item.status = "failed";
      item.error = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: item.error };
    }
  },

  // Procesar cola completa (cuando vuelve online)
  async processBatch(
    items: SyncQueueItem[],
    sessionToken?: string
  ): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    pending: number;
  }> {
    let succeeded = 0;
    let failed = 0;

    for (const item of items) {
      if (item.status === "completed" || item.status === "failed") {
        continue;
      }

      const result = await this.processItem(item, sessionToken);
      if (result.success) {
        succeeded++;
      } else {
        if (item.status === "failed") failed++;
      }

      // Pequeño delay entre requests (no saturar)
      await new Promise((r) => setTimeout(r, 100));
    }

    const processed = succeeded + failed;
    const pending = items.filter((i) => i.status === "pending").length;

    return { processed, succeeded, failed, pending };
  },

  // Calcular delay para retry (exponential backoff)
  getRetryDelay(retryCount: number): number {
    return RETRY_DELAY_MS[Math.min(retryCount, RETRY_DELAY_MS.length - 1)];
  },

  // Filtrar items por estado
  filterByStatus(
    items: SyncQueueItem[],
    status: SyncQueueItem["status"]
  ): SyncQueueItem[] {
    return items.filter((i) => i.status === status);
  },

  // Obtener stats de queue
  getQueueStats(items: SyncQueueItem[]) {
    return {
      total: items.length,
      pending: items.filter((i) => i.status === "pending").length,
      processing: items.filter((i) => i.status === "processing").length,
      completed: items.filter((i) => i.status === "completed").length,
      failed: items.filter((i) => i.status === "failed").length,
    };
  },

  // Limpiar items completados/expirados
  cleanup(items: SyncQueueItem[], ageMs = 7 * 24 * 60 * 60 * 1000): SyncQueueItem[] {
    const now = Date.now();
    return items.filter((item) => {
      // Mantener pending/processing
      if (item.status === "pending" || item.status === "processing") {
        return true;
      }
      // Eliminar completados/fallidos después de 7 días
      return now - item.timestamp < ageMs;
    });
  },
};
