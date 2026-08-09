const CACHE_NAME = "pruebas-maria-v1";
const API_CACHE_NAME = "pruebas-maria-api-v1";
const ASSET_CACHE_NAME = "pruebas-maria-assets-v1";

const URLS_TO_CACHE = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/api/findings?limit=100",
];

const NETWORK_TIMEOUT_MS = 5000;

// Install: Cache críticos
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(URLS_TO_CACHE);
        self.skipWaiting();
      } catch (err) {
        console.error("Install error:", err);
      }
    })()
  );
});

// Activate: Limpiar caches antiguos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => !name.startsWith("pruebas-maria"))
          .map((name) => caches.delete(name))
      );
      self.clients.claim();
    })()
  );
});

// Fetch: Estrategia de cache híbrida
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo cachear GET
  if (request.method !== "GET") {
    event.respondWith(fetch(request));
    return;
  }

  // API: Network-first con timeout
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Assets: Cache-first
  if (
    url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf)$/i)
  ) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Default: Network-first
  event.respondWith(networkFirstStrategy(request));
});

// Escuchar mensajes (trigger sync manual)
self.addEventListener("message", (event) => {
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data.type === "TRIGGER_SYNC") {
    processSyncQueue(event.ports[0]);
  }
});

// Background Sync: Procesar queue cuando online
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-queue") {
    event.waitUntil(processSyncQueue());
  }
});

// --- Estrategias de Cache ---

async function networkFirstStrategy(request) {
  try {
    const response = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);

    // Guardar en cache si está OK
    if (response.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (err) {
    // Fallback a cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Última opción: respuesta offline
    return new Response(
      JSON.stringify({
        error: "Offline - cached data not available",
        code: "OFFLINE",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(ASSET_CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (err) {
    return new Response("Asset not found", { status: 404 });
  }
}

// Fetch con timeout
function fetchWithTimeout(request, timeout) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Network timeout")), timeout)
    ),
  ]);
}

// --- Sync Queue Processing ---

async function processSyncQueue(port = null) {
  try {
    // Obtener queue de IndexedDB
    const queue = await getIndexedDBQueue();
    if (queue.length === 0) {
      if (port) port.postMessage({ type: "sync-complete", processed: 0 });
      return;
    }

    let processed = 0;
    let succeeded = 0;

    for (const item of queue) {
      if (item.status === "completed" || item.status === "failed") {
        continue;
      }

      try {
        const response = await fetch(
          `${self.location.origin}${item.endpoint}`,
          {
            method: item.method,
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": item.idempotencyKey,
            },
            body: JSON.stringify(item.payload),
            credentials: "include",
          }
        );

        if (response.ok || response.status === 409) {
          item.status = "completed";
          await updateIndexedDBItem(item);
          succeeded++;
        } else if (response.status === 401) {
          item.status = "failed";
          item.error = "Session expired";
          await updateIndexedDBItem(item);
        } else if (response.status >= 500) {
          if (item.retries < 3) {
            item.retries++;
            await updateIndexedDBItem(item);
          }
        }
      } catch (err) {
        if (item.retries < 3) {
          item.retries++;
          await updateIndexedDBItem(item);
        } else {
          item.status = "failed";
          item.error = err instanceof Error ? err.message : "Unknown error";
          await updateIndexedDBItem(item);
        }
      }

      processed++;

      // Notificar clientes cada 5 items
      if (processed % 5 === 0 && self.clients) {
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: "sync-progress",
              processed,
              succeeded,
            });
          });
        });
      }
    }

    // Notificar finalización
    if (self.clients) {
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: "sync-complete",
            processed,
            succeeded,
          });
        });
      });
    }

    if (port) {
      port.postMessage({
        type: "sync-complete",
        processed,
        succeeded,
      });
    }
  } catch (err) {
    console.error("Sync queue processing error:", err);
    if (port) {
      port.postMessage({
        type: "sync-error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
}

// --- IndexedDB Helpers ---

function getIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("pruebas-maria-offline", 1);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("sync_queue")) {
        const store = db.createObjectStore("sync_queue", { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getIndexedDBQueue() {
  const db = await getIndexedDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(["sync_queue"], "readonly");
    const store = transaction.objectStore("sync_queue");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

async function updateIndexedDBItem(item) {
  const db = await getIndexedDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(["sync_queue"], "readwrite");
    const store = transaction.objectStore("sync_queue");
    store.put(item);
    transaction.oncomplete = () => resolve(null);
  });
}
