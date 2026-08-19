const CACHE_NAME = "pruebas-maria-shell-v6";
const ASSET_CACHE_NAME = "pruebas-maria-assets-v6";
const DB_NAME = "pruebas-maria-offline";
const DB_VERSION = 2;
const OFFLINE_URL = "/offline.html";

const URLS_TO_CACHE = [
  "/",
  "/app.html",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

const CURRENT_CACHES = new Set([CACHE_NAME, ASSET_CACHE_NAME]);
const NETWORK_TIMEOUT_MS = 5000;

// Install: Cache críticos
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await Promise.allSettled(
          URLS_TO_CACHE.map((url) =>
            cache.add(new Request(url, { cache: "reload" }))
          )
        );
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
          .filter(
            (name) =>
              name.startsWith("pruebas-maria") && !CURRENT_CACHES.has(name)
          )
          .map((name) => caches.delete(name))
      );
      self.clients.claim();
    })()
  );
});

// Validar que el esquema sea cacheable
function isCacheableScheme(url) {
  return url.protocol === "http:" || url.protocol === "https:";
}

// Fetch: Estrategia de cache híbrida
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo cachear GET
  if (request.method !== "GET") {
    event.respondWith(fetch(request));
    return;
  }

  // Ignorar requests con esquemas no-cacheable (chrome-extension, etc)
  if (!isCacheableScheme(url)) {
    event.respondWith(fetch(request).catch(() =>
      new Response("Unavailable offline", { status: 503 })
    ));
    return;
  }

  // API: Network-first con timeout
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(apiNetworkStrategy(request));
    return;
  }

  // Navigation: Network-first with HTML fallback
  if (request.mode === "navigate") {
    event.respondWith(navigationStrategy(request));
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
    event.waitUntil(
      processSyncQueue(event.ports[0]).catch((err) => {
        console.error("Sync processing error:", err);
      })
    );
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

    // Guardar en cache si está OK y el esquema es cacheable
    if (response.ok && isCacheableScheme(new URL(request.url))) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch((err) => {
        console.warn("Cache put error:", err);
      });
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

async function apiNetworkStrategy(request) {
  try {
    return await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Offline - API request requires connectivity",
        code: "OFFLINE",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function navigationStrategy(request) {
  try {
    const response = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);

    if (response.ok && isCacheableScheme(new URL(request.url))) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch((err) => {
        console.warn("Navigation cache put error:", err);
      });
    }

    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;

    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;

    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    if (response.ok && isCacheableScheme(new URL(request.url))) {
      const cache = await caches.open(ASSET_CACHE_NAME);
      cache.put(request, response.clone()).catch((err) => {
        console.warn("Cache put error:", err);
      });
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
    let failed = 0;

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
          failed++;
        } else if (response.status >= 500) {
          if (item.retries < 3) {
            item.retries++;
            item.status = "pending";
            await updateIndexedDBItem(item);
          } else {
            item.status = "failed";
            item.error = `HTTP ${response.status}`;
            await updateIndexedDBItem(item);
            failed++;
          }
        } else {
          item.status = "failed";
          item.error = `HTTP ${response.status}`;
          await updateIndexedDBItem(item);
          failed++;
        }
      } catch (err) {
        if (item.retries < 3) {
          item.retries++;
          item.status = "pending";
          await updateIndexedDBItem(item);
        } else {
          item.status = "failed";
          item.error = err instanceof Error ? err.message : "Unknown error";
          await updateIndexedDBItem(item);
          failed++;
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
              failed,
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
            failed,
          });
        });
      });
    }

    if (port) {
      port.postMessage({
        type: "sync-complete",
        processed,
        succeeded,
        failed,
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
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const request = e.target;
      const db = request.result;
      const transaction = request.transaction;

      if (!db.objectStoreNames.contains("findings_cache")) {
        const store = db.createObjectStore("findings_cache", { keyPath: "id" });
        ensureIndex(store, "status", "status");
        ensureIndex(store, "createdAt", "createdAt");
      } else {
        const store = transaction.objectStore("findings_cache");
        ensureIndex(store, "status", "status");
        ensureIndex(store, "createdAt", "createdAt");
      }

      if (!db.objectStoreNames.contains("sync_queue")) {
        const store = db.createObjectStore("sync_queue", { keyPath: "id" });
        ensureIndex(store, "timestamp", "timestamp");
        ensureIndex(store, "status", "status");
      } else {
        const store = transaction.objectStore("sync_queue");
        ensureIndex(store, "timestamp", "timestamp");
        ensureIndex(store, "status", "status");
      }

      if (!db.objectStoreNames.contains("metadata")) {
        db.createObjectStore("metadata", { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function ensureIndex(store, name, keyPath) {
  if (!store.indexNames.contains(name)) {
    store.createIndex(name, keyPath, { unique: false });
  }
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

// --- Push Notification Handlers (FASE 9) ---

self.addEventListener("push", (event) => {
  if (!event.data) {
    console.log("Push event received but has no data");
    return;
  }

  try {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || "/icons/app-icon-192.png",
      badge: data.badge || "/icons/badge-96.png",
      tag: data.tag || "notification",
      data: data.data || {},
      requireInteraction: false,
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (err) {
    console.error("Error processing push event:", err);
    // Fallback: show generic notification
    event.waitUntil(
      self.registration.showNotification("Nueva notificación", {
        body: "Tienes una nueva notificación",
        icon: "/icons/app-icon-192.png",
      })
    );
  }
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = data.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (new URL(client.url).pathname === new URL(targetUrl, self.location.origin).pathname) {
          return client.focus();
        }
      }
      // If not, open a new window/tab with the target URL
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Notification close handler (for logging)
self.addEventListener("notificationclose", (event) => {
  console.log("Notification closed:", event.notification.tag);
});
