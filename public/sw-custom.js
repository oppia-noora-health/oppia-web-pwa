// Custom Service Worker for Noora Academy PWA
// Automatic cache management - no manual version updates needed

// Get build timestamp from environment or use current time
// This forces cache invalidation on every deployment
const BUILD_TIME =
  typeof __NEXT_DATA__ !== "undefined"
    ? __NEXT_DATA__.buildTime
    : new Date().getTime();
const CACHE_VERSION = `v${Math.floor(BUILD_TIME / 1000)}`;
const CACHE_NAME = `noora-cache-${CACHE_VERSION}`;
const API_CACHE = `noora-api-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `noora-dynamic-${CACHE_VERSION}`;

// Background sync tags
const SYNC_TRACKERS_TAG = "sync-trackers";
const SYNC_QUIZ_TAG = "sync-quiz";

// Resources to precache on install - ALL essential assets for offline
const PRECACHE_ASSETS = [
  // Core pages
  "/",
  "/offline.html",
  "/manifest.json",
  "/favicon.ico",

  // App routes (for offline navigation)
  "/course",
  "/scoreboard",
  "/points",
  "/login",

  // Logo assets
  "/logo/icon-192x192.png",
  "/logo/icon-512x512.png",
  "/logo/apple-touch-icon.png",
  "/logo/logo.svg",
  "/logo/logo-icon.svg",

  // Login assets
  "/login/bg.png",
  "/login/login-illustration.png",

  // Home/Course assets
  "/home/calander.svg",

  // Navbar icons
  "/navbar/home.svg",
  "/navbar/points.svg",
  "/navbar/scoreboard.svg",
  "/navbar/hover/home.svg",
  "/navbar/hover/points.svg",
  "/navbar/hover/scoreboard.svg",

  // Points/Gamification assets
  "/points/badges/course-completed.svg",
  "/points/badges/daimond.svg",
  "/points/badges/gold.svg",
  "/points/badges/platinum.svg",
  "/points/badges/silver.svg",
  "/points/leaderboard/position.svg",
  "/points/leaderboard/position.png",

  // Course notification assets
  "/course/notification/earned.svg",

  // Other/Error state assets
  "/other/0ffline.webp",
  "/other/404.webp",
  "/other/coming-soon.webp",
];

// Install event - precache essential resources
self.addEventListener("install", (event) => {
  // console.log("[SW v7] Installing service worker");

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        // console.log("[SW v7] Precaching app shell and assets");

        // Cache assets one by one to handle failures gracefully
        const cachePromises = PRECACHE_ASSETS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: "reload" });
            if (response.ok) {
              await cache.put(url, response);
              // console.log("[SW v7] Cached:", url);
            } else {
              // console.warn("[SW v7] Failed to fetch for cache:", url, response.status);
            }
          } catch (error) {
            // console.warn("[SW v7] Error caching:", url, error.message);
          }
        });

        await Promise.all(cachePromises);
        // console.log("[SW v7] Precaching complete");
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker
        return self.skipWaiting();
      }),
  );
});

// Activate event - clean up old caches and notify clients of updates
self.addEventListener("activate", (event) => {
  console.log(`[SW] Activating new version: ${CACHE_VERSION}`);

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        // Aggressively delete ALL old Noora caches to prevent stale data
        const deletePromises = cacheNames
          .filter((name) => {
            const isOldNoora =
              name.startsWith("noora-") &&
              name !== CACHE_NAME &&
              name !== API_CACHE &&
              name !== DYNAMIC_CACHE;

            if (isOldNoora) {
              console.log(`[SW] Deleting old cache: ${name}`);
            }
            return isOldNoora;
          })
          .map((name) => caches.delete(name));

        return Promise.all(deletePromises);
      })
      .then(async () => {
        // Clean up any course ZIP downloads from the API cache
        // These were incorrectly cached before the fix
        try {
          const apiCache = await caches.open(API_CACHE);
          const apiRequests = await apiCache.keys();

          const cleanupPromises = apiRequests
            .filter((request) => {
              const url = new URL(request.url);
              return url.pathname.match(/\/api\/v2\/course\/\d+\/download\//);
            })
            .map((request) => {
              console.log(`[SW] Removing cached course ZIP: ${request.url}`);
              return apiCache.delete(request);
            });

          await Promise.all(cleanupPromises);
          if (cleanupPromises.length > 0) {
            console.log(
              `[SW] Cleaned up ${cleanupPromises.length} cached course ZIP files`,
            );
          }
        } catch (err) {
          console.warn("[SW] Error cleaning up cached ZIPs:", err);
        }

        // Clean up redundant page variations with query parameters
        // e.g., /course/170/view?page=0, /course/170/view?page=1, etc.
        // These are now handled by base URL matching (without query params)
        try {
          const dynamicCache = await caches.open(DYNAMIC_CACHE);
          const dynamicRequests = await dynamicCache.keys();

          const pageCleanupPromises = dynamicRequests
            .filter((request) => {
              const url = new URL(request.url);
              // Match course pages with query parameters
              return (
                url.pathname.match(/\/course\/\d+\/view/) &&
                url.search.length > 0
              );
            })
            .map((request) => {
              return dynamicCache.delete(request);
            });

          await Promise.all(pageCleanupPromises);
          if (pageCleanupPromises.length > 0) {
            console.log(
              `[SW] Cleaned up ${pageCleanupPromises.length} redundant cached page variations`,
            );
          }
        } catch (err) {
          console.warn("[SW] Error cleaning up page variations:", err);
        }
      })
      .then(() => {
        // Claim all clients and notify them of update
        return self.clients.claim();
      })
      .then(() => {
        // Notify all open clients that update is available
        return self.clients.matchAll();
      })
      .then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: "UPDATE_AVAILABLE",
            version: CACHE_VERSION,
            timestamp: BUILD_TIME,
          });
        });
      }),
  );
});

/**
 * Stale-While-Revalidate caching strategy
 * Returns cached response immediately while fetching fresh version in background
 */
async function staleWhileRevalidate(request, cacheName, pathname) {
  const cache = await caches.open(cacheName);

  // Try to get from cache first
  const cachedResponse = await cache.match(request);

  // Start fetching fresh version (don't await - let it run in background)
  const fetchPromise = fetch(request)
    .then((response) => {
      // Update cache with fresh response
      if (response.ok) {
        cache.put(request, response.clone());
        // console.log("[SW v7] StaleWhileRevalidate: Updated cache", pathname);
      }
      return response;
    })
    .catch((error) => {
      // console.log("[SW v7] StaleWhileRevalidate: Fetch failed", pathname, error.message);
      return null;
    });

  // Return cached response immediately if available
  if (cachedResponse) {
    // console.log("[SW v7] StaleWhileRevalidate: Serving from cache", pathname);
    return cachedResponse;
  }

  // Try dynamic cache (pages cached by app: settings, privacy, profile, points, scoreboard)
  const dynamicCache = await caches.open(DYNAMIC_CACHE);
  const dynamicCached = await dynamicCache.match(request);
  if (dynamicCached) {
    return dynamicCached;
  }

  // No cache available, wait for fetch
  // console.log("[SW v7] StaleWhileRevalidate: No cache, waiting for network", pathname);
  const networkResponse = await fetchPromise;

  if (networkResponse && networkResponse.ok) {
    return networkResponse;
  }

  // Network failed and no cache available
  // console.error("[SW v7] StaleWhileRevalidate: Network failed and no cache available for", pathname);

  // Return empty response to prevent errors
  if (request.destination === "image") {
    return new Response("", {
      status: 200,
      headers: { "Content-Type": "image/svg+xml" },
    });
  }

  // For scripts and styles, return empty but valid response
  if (request.destination === "script") {
    return new Response("", {
      status: 200,
      headers: { "Content-Type": "application/javascript" },
    });
  }

  if (request.destination === "style") {
    return new Response("", {
      status: 200,
      headers: { "Content-Type": "text/css" },
    });
  }

  return new Response("", { status: 200 });
}

// Fetch event - smart caching strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // Skip service worker for media downloads (large files)
  // Let them go directly to the server/proxy to avoid size limits
  if (url.pathname.startsWith("/media/uploaded/")) {
    return;
  }

  // Skip service worker for course ZIP downloads (already stored in IndexedDB)
  // Pattern: /api/v2/course/{id}/download/
  // This prevents duplicate storage and cache size bloat (ZIPs are 10-50MB each)
  if (url.pathname.match(/\/api\/v2\/course\/\d+\/download\//)) {
    console.log("[SW] Skipping cache for course download:", url.pathname);
    return;
  }

  // Handle navigation requests (page loads) with Network-First + Cache Fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache successful navigation responses
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(async () => {
          // Try exact match first from dynamic cache
          const dynamicCache = await caches.open(DYNAMIC_CACHE);
          const dynamicCached = await dynamicCache.match(request);
          if (dynamicCached) {
            return dynamicCached;
          }

          // Try exact match from main cache
          let cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }

          // For course pages with query params, try matching without query string
          // This allows /course/170/view?page=5 to use cached /course/170/view
          const url = new URL(request.url);
          if (url.pathname.startsWith("/course/")) {
            const baseUrl = url.origin + url.pathname;
            const baseRequest = new Request(baseUrl);

            // Try dynamic cache with base URL
            cachedResponse = await dynamicCache.match(baseRequest);
            if (cachedResponse) {
              console.log(
                `[SW] Serving ${url.pathname} with query params from base cache`,
              );
              return cachedResponse;
            }

            // Try main cache with base URL
            cachedResponse = await caches.match(baseRequest);
            if (cachedResponse) {
              console.log(
                `[SW] Serving ${url.pathname} with query params from base cache`,
              );
              return cachedResponse;
            }
          }

          // For app routes, try to serve a cached page that can bootstrap the app
          const coursePage = await caches.match("/course");
          if (coursePage) {
            return coursePage;
          }

          // Try to serve root page for app routes
          const rootResponse = await caches.match("/");
          if (rootResponse) {
            return rootResponse;
          }

          // Special handling for course pages when offline
          // If user tries to access /course/[id]/view offline, return a loading page
          if (url.pathname.match(/^\/course\/\d+/)) {
            // Extract course ID from URL
            const courseIdMatch = url.pathname.match(/\/course\/(\d+)/);
            const courseId = courseIdMatch ? courseIdMatch[1] : "unknown";

            // Return a loading page that doesn't require JavaScript chunks
            // This allows the app to eventually load and fetch content from IndexedDB
            const offlineLoadingHtml = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Loading Course - Offline</title>
                <style>
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    background: #f5f5f5;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                  }
                  .loader {
                    text-align: center;
                    padding: 40px 20px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    max-width: 400px;
                  }
                  h1 {
                    font-size: 20px;
                    margin-bottom: 8px;
                    color: #333;
                  }
                  p {
                    color: #666;
                    font-size: 14px;
                    margin-bottom: 20px;
                  }
                  .spinner {
                    width: 40px;
                    height: 40px;
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #667eea;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 20px;
                  }
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                  .status {
                    font-size: 12px;
                    color: #999;
                    margin-top: 16px;
                  }
                </style>
              </head>
              <body>
                <div class="loader">
                  <div class="spinner"></div>
                  <h1>Loading Course</h1>
                  <p>Course content is being loaded from offline storage...</p>
                  <div class="status">
                    You are offline. Course content is available offline.
                  </div>
                </div>
                <script>
                  // Mark that this is offline fallback
                  window.__OFFLINE_COURSE_FALLBACK__ = true;
                  
                  // Try to reload the page if chunks become available (user comes back online)
                  // This gives the page a chance to load normally
                  if (navigator.onLine === false) {
                    window.addEventListener('online', function() {
                      // Wait a moment for service worker to sync
                      setTimeout(() => window.location.reload(), 1000);
                    });
                  } else {
                    // If somehow online, try to reload
                    setTimeout(() => window.location.reload(), 2000);
                  }
                </script>
              </body>
              </html>
            `;
            return new Response(offlineLoadingHtml, {
              headers: { "Content-Type": "text/html; charset=utf-8" },
              status: 200,
            });
          }

          // Last resort: offline page
          const offlineRes = await caches.match("/offline.html");
          return offlineRes || new Response("Offline", { status: 503 });
        }),
    );
    return;
  }

  // Handle API requests with Network-First strategy
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        }),
    );
  }

  // Handle static assets with Stale-While-Revalidate strategy
  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font" ||
    url.pathname.startsWith("/_next/") ||
    url.pathname.match(
      /\.(svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|css|js)$/,
    )
  ) {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAME, url.pathname));
    return;
  }

  // Default: Network-First for everything else
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const responseToCache = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      }),
  );
});

// Background Sync for activity tracking
self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TRACKERS_TAG || event.tag === SYNC_QUIZ_TAG) {
    event.waitUntil(notifyClientsToSync(event.tag));
  }
});

/**
 * Notify all clients to sync their data
 */
async function notifyClientsToSync(tag) {
  const clients = await self.clients.matchAll({ type: "window" });

  if (clients.length === 0) {
    return;
  }

  clients.forEach((client) => {
    client.postMessage({
      type: "BACKGROUND_SYNC",
      tag: tag,
    });
  });
}

// Periodic background sync (if supported)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "sync-trackers-periodic") {
    event.waitUntil(notifyClientsToSync(SYNC_TRACKERS_TAG));
  }
});

// Handle messages from clients
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "CLIENTS_CLAIM") {
    self.clients.claim();
  }

  if (event.data && event.data.type === "CACHE_URLS") {
    // Cache specific URLs on demand
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.addAll(event.data.urls);
      }),
    );
  }

  // Allow clients to register for background sync
  if (event.data && event.data.type === "REGISTER_SYNC") {
    const tag = event.data.tag || SYNC_TRACKERS_TAG;
    event.waitUntil(
      self.registration.sync
        .register(tag)
        .then(() => {
          // Notify client of successful registration
          if (event.source) {
            event.source.postMessage({
              type: "SYNC_REGISTERED",
              tag: tag,
            });
          }
        })
        .catch(() => {
          // Sync registration failed
        }),
    );
  }

  // Handle sync request from clients
  if (event.data && event.data.type === "SYNC_NOW") {
    event.waitUntil(notifyClientsToSync(SYNC_TRACKERS_TAG));
  }
});

// Handle push notifications
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Noora Academy";
  const options = {
    body: data.body || "New update available",
    icon: "/logo/icon-192x192.png",
    badge: "/logo/icon-192x192.png",
    data: data,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      // Focus existing window or open new one
      if (clients.length > 0) {
        return clients[0].focus();
      }
      return self.clients.openWindow("/");
    }),
  );
});
