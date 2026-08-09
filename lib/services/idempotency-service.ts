import { db } from "@/lib/db";

interface IdempotencyRecord {
  key: string;
  method: string;
  endpoint: string;
  statusCode: number;
  responseBody: Record<string, any>;
  createdAt: Date;
}

const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 horas

// Almacenamiento en memoria (producción: usar Redis)
const idempotencyStore = new Map<string, IdempotencyRecord>();

export const idempotencyService = {
  // Generar Idempotency-Key (UUID v4)
  generateKey(): string {
    return crypto.randomUUID();
  },

  // Verificar si request ya fue procesado
  async checkDuplicate(
    key: string,
    method: string,
    endpoint: string
  ): Promise<{ isDuplicate: boolean; response?: Record<string, any> }> {
    const record = idempotencyStore.get(key);

    if (!record) {
      return { isDuplicate: false };
    }

    // Validar que sea el mismo endpoint/método
    if (record.method !== method || record.endpoint !== endpoint) {
      throw new Error("Idempotency key used with different endpoint/method");
    }

    // Validar TTL no expirado
    const age = Date.now() - record.createdAt.getTime();
    if (age > IDEMPOTENCY_TTL) {
      idempotencyStore.delete(key);
      return { isDuplicate: false };
    }

    return {
      isDuplicate: true,
      response: record.responseBody,
    };
  },

  // Guardar resultado de request idempotent
  async storeResponse(
    key: string,
    method: string,
    endpoint: string,
    statusCode: number,
    responseBody: Record<string, any>
  ): Promise<void> {
    idempotencyStore.set(key, {
      key,
      method,
      endpoint,
      statusCode,
      responseBody,
      createdAt: new Date(),
    });

    // Limpiar TTL expirado (cada 1000 requests)
    if (idempotencyStore.size > 10000) {
      const now = Date.now();
      for (const [k, v] of idempotencyStore.entries()) {
        if (now - v.createdAt.getTime() > IDEMPOTENCY_TTL) {
          idempotencyStore.delete(k);
        }
      }
    }
  },

  // Validar header Idempotency-Key
  validateHeader(header: string | undefined): {
    valid: boolean;
    key?: string;
    error?: string;
  } {
    if (!header) {
      return {
        valid: false,
        error: "Idempotency-Key header required for mutations",
      };
    }

    // UUID v4 format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(header)) {
      return {
        valid: false,
        error: "Idempotency-Key must be a valid UUID v4",
      };
    }

    return { valid: true, key: header };
  },

  // Limpiar registros expirados
  async cleanup(): Promise<number> {
    let removed = 0;
    const now = Date.now();

    for (const [key, record] of idempotencyStore.entries()) {
      if (now - record.createdAt.getTime() > IDEMPOTENCY_TTL) {
        idempotencyStore.delete(key);
        removed++;
      }
    }

    return removed;
  },

  // Stats para debugging
  getStats() {
    return {
      totalRecords: idempotencyStore.size,
      ttlHours: IDEMPOTENCY_TTL / (60 * 60 * 1000),
    };
  },
};
