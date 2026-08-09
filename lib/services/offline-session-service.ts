export interface OfflineSessionData {
  userId: string;
  email: string;
  role: string;
  sessionToken: string;
  sessionStartedAt: number;
  lastValidatedAt: number;
}

const SESSION_VALIDATION_INTERVAL = 60 * 60 * 1000; // Validar cada 1 hora
const SESSION_STORAGE_KEY = "offline_session_data";

export const offlineSessionService = {
  // Guardar sesión en IndexedDB
  async saveSession(data: OfflineSessionData): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(["metadata"], "readwrite");
      const store = transaction.objectStore("metadata");

      await store.put({
        key: SESSION_STORAGE_KEY,
        value: data,
        savedAt: new Date(),
      });
    } catch (err) {
      console.error("Failed to save offline session:", err);
    }
  },

  // Obtener sesión guardada
  async getSession(): Promise<OfflineSessionData | null> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(["metadata"], "readonly");
      const store = transaction.objectStore("metadata");

      const result = await new Promise<OfflineSessionData | null>((resolve) => {
        const request = store.get(SESSION_STORAGE_KEY);
        request.onsuccess = () => {
          const data = request.result;
          resolve(data?.value || null);
        };
        request.onerror = () => resolve(null);
      });

      return result;
    } catch (err) {
      console.error("Failed to get offline session:", err);
      return null;
    }
  },

  // Validar sesión en servidor
  async validateSession(sessionData: OfflineSessionData): Promise<{
    valid: boolean;
    message?: string;
  }> {
    try {
      const response = await fetch("/api/auth/validate", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${sessionData.sessionToken}`,
        },
      });

      if (response.ok) {
        // Actualizar lastValidatedAt
        sessionData.lastValidatedAt = Date.now();
        await this.saveSession(sessionData);
        return { valid: true };
      }

      if (response.status === 401) {
        await this.clearSession();
        return {
          valid: false,
          message: "Session expired. Please login again.",
        };
      }

      return { valid: false, message: "Validation failed" };
    } catch (err) {
      // Sin conexión — confiar en validación local
      return { valid: true, message: "Offline (cached)" };
    }
  },

  // Revalidar si es necesario
  async revalidateIfNeeded(sessionData: OfflineSessionData): Promise<{
    valid: boolean;
    message?: string;
  }> {
    const now = Date.now();
    const timeSinceValidation = now - sessionData.lastValidatedAt;

    // Validar cada 1 hora
    if (timeSinceValidation > SESSION_VALIDATION_INTERVAL) {
      return await this.validateSession(sessionData);
    }

    return { valid: true };
  },

  // Detectar conexión
  isOnline(): boolean {
    return navigator.onLine;
  },

  // Escuchar cambios de conexión
  onConnectionChange(callback: (online: boolean) => void): () => void {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  },

  // Limpiar sesión
  async clearSession(): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(["metadata"], "readwrite");
      const store = transaction.objectStore("metadata");
      await new Promise<void>((resolve) => {
        const request = store.delete(SESSION_STORAGE_KEY);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      });
    } catch (err) {
      console.error("Failed to clear session:", err);
    }
  },

  // Helper: Obtener IndexedDB
  private getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("pruebas-maria-offline", 1);

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains("metadata")) {
          db.createObjectStore("metadata", { keyPath: "key" });
        }
      };

      request.onsuccess = () => resolve((request as IDBOpenDBRequest).result);
      request.onerror = () => reject(request.error);
    });
  },
};
