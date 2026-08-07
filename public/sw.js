/* Pruebas María 2.0 — service worker (PWA offline) */
const VERSION = "pm2-v3"
const SHELL_CACHE = `shell-${VERSION}`
const ASSET_CACHE = `assets-${VERSION}`
const MEDIA_CACHE = `media-${VERSION}`
const MEDIA_LIMIT = 260

const SHELL_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/contenido/componentes/fonts/Poppins-Regular.ttf",
  "/contenido/componentes/fonts/Poppins-Medium.ttf",
  "/contenido/componentes/fonts/Poppins-SemiBold.ttf",
  "/contenido/componentes/fonts/Poppins-Bold.ttf",
  "/images/portada-editorial.jpg",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE)
      // Add individually so one failure cannot abort the whole install.
      await Promise.all(
        SHELL_ASSETS.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: "reload" }))
          } catch (error) {
            console.log("[v0][sw] shell asset skipped:", url, String(error))
          }
        }),
      )
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, ASSET_CACHE, MEDIA_CACHE])
      const names = await caches.keys()
      await Promise.all(names.filter((name) => !keep.has(name)).map((name) => caches.delete(name)))
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.disable()
        } catch {}
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting()
})

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length <= maxEntries) return
  for (const key of keys.slice(0, keys.length - maxEntries)) {
    await cache.delete(key)
  }
}

/*
 * Network first, fall back to the cached copy — used for the document itself.
 * A failed request is not only a thrown fetch: a captive portal or a gateway
 * error answers with a real response, so any 5xx also falls back to the cache.
 */
async function networkFirstDocument(request) {
  const cache = await caches.open(SHELL_CACHE)
  const cached = async () => (await cache.match("/")) || (await cache.match(request))

  try {
    // Always revalidate so a new deploy is picked up as soon as the device is online.
    const response = await fetch(request, { cache: "no-cache" })

    if (response && response.ok) {
      cache.put("/", response.clone())
      return response
    }

    if (response && response.status >= 500) {
      const fallback = await cached()
      if (fallback) {
        console.log("[v0][sw] respuesta", response.status, "\u2014 usando la copia guardada")
        return fallback
      }
    }

    return response
  } catch {
    return (await cached()) || Response.error()
  }
}

/* Cache first — used for immutable evidence images and fonts. */
async function cacheFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  // Only store real successes: an error page must never replace an evidence file.
  if (response && response.ok) {
    await cache.put(request, response.clone())
    if (limit) trimCache(cacheName, limit)
  }
  return response
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === "navigate") {
    event.respondWith(networkFirstDocument(request))
    return
  }

  if (url.pathname.startsWith("/images/")) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE, MEDIA_LIMIT).catch(() => Response.error()))
    return
  }

  if (url.pathname.startsWith("/contenido/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request, ASSET_CACHE).catch(() => Response.error()))
    return
  }

  if (url.pathname === "/manifest.webmanifest") {
    event.respondWith(cacheFirst(request, SHELL_CACHE).catch(() => Response.error()))
  }
})
