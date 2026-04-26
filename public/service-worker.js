// Noora Academy Custom Service Worker

const CACHE_VERSION = "v1";
const CACHE_NAMES = {
  static: `noora-static-${CACHE_VERSION}`,
  dynamic: `noora-dynamic-${CACHE_VERSION}`,
  api: `noora-api-${CACHE_VERSION}`,
  media: `noora-media-${CACHE_VERSION}`,
};

const ALL_CACHES = Object.values(CACHE_NAMES);

// Comprehensive list of assets to precache for offline support
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

// Install event - cache essential resources
self.addEventListener("install", (event) => {
  // console.log("[SW v7] Installing...");

  event.waitUntil(
    caches
      .open(CACHE_NAMES.static)
      .then(async (cache) => {
        // console.log("[SW v7] Caching essential app shell resources");

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
        // console.log("[SW v7] Install complete, skipping waiting");
        return self.skipWaiting();
      }),
  );
});

// Activate event - clean old caches and take control
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then(async (cacheNames) => {
        // Delete old version caches
        const deletePromises = cacheNames
          .filter((name) => !ALL_CACHES.includes(name))
          .map((name) => {
            // Special logging for course-specific caches
            if (name.startsWith("noora-courses-")) {
            }
            return caches.delete(name);
          });

        await Promise.all(deletePromises);

        // Also clean up redundant page variations with query parameters from dynamic cache
        try {
          const dynamicCache = await caches.open(CACHE_NAMES.dynamic);
          const requests = await dynamicCache.keys();

          const pageCleanupPromises = requests
            .filter((request) => {
              const url = new URL(request.url);
              // Match course view pages with query parameters
              return (
                url.pathname.match(/\/course\/\d+\/view/) &&
                url.search.length > 0
              );
            })
            .map((request) => dynamicCache.delete(request));

          await Promise.all(pageCleanupPromises);
          if (pageCleanupPromises.length > 0) {
          }
        } catch (err) {
          console.warn("[SW v8.1] Error cleaning up page variations:", err);
        }

        return Promise.resolve();
      })
      .then(() => {
        return self.clients.claim();
      }),
  );
});

// Helper function to extract courseId from path
function getCourseIdFromPath(pathname) {
  // Match /course/123 or /course/123/view
  const match = pathname.match(/^\/course\/(\d+)(\/view)?/);
  return match ? match[1] : null;
}

// Helper function to determine cache strategy
function getCacheStrategy(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const extension = path.split(".").pop().toLowerCase();

  // ✅ Course pages - use NetworkFirst with dynamic cache (no separate per-course caches)
  const courseId = getCourseIdFromPath(path);
  if (
    courseId &&
    (path.match(/^\/course\/\d+$/) ||
      (path.includes("/course/") && path.includes("/view")))
  ) {
    // This is /course/[id] or /course/[id]/view
    // NetworkFirst: Try network, cache response, fall back to cache if offline
    // CRITICAL FIX: Reduced timeout from 5s to 2s for faster offline fallback.
    // Course data loads from IndexedDB anyway — the HTML shell just needs to render.
    return {
      strategy: "NetworkFirst",
      cacheName: CACHE_NAMES.dynamic,
      timeout: 2000,
    };
  }

  // Images, icons, media - CacheFirst
  if (
    /\.(png|jpg|jpeg|svg|gif|webp|ico|mp4|mp3|wav|woff|woff2|ttf|otf|eot)$/i.test(
      path,
    )
  ) {
    return { strategy: "CacheFirst", cacheName: CACHE_NAMES.media };
  }

  // Next.js static files - StaleWhileRevalidate for chunks to ensure offline availability
  if (path.startsWith("/_next/static/")) {
    // For chunks, we want to cache aggressively
    return { strategy: "StaleWhileRevalidate", cacheName: CACHE_NAMES.static };
  }

  // API calls - NetworkFirst
  if (path.startsWith("/api/")) {
    return {
      strategy: "NetworkFirst",
      cacheName: CACHE_NAMES.api,
      timeout: 10000,
    };
  }

  // Navigation and HTML - NetworkFirst with fallback to cached home
  if (
    request.mode === "navigate" ||
    path.endsWith(".html") ||
    !extension ||
    extension.length > 4
  ) {
    return {
      strategy: "NetworkFirst",
      cacheName: CACHE_NAMES.dynamic,
      timeout: 3000, // Even faster timeout for navigation
    };
  }

  // Default - NetworkFirst with cache fallback
  return {
    strategy: "NetworkFirst",
    cacheName: CACHE_NAMES.dynamic,
    timeout: 3000,
  };
}

// StaleWhileRevalidate strategy - serve from cache immediately, update in background
async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);

  // Fetch in background regardless
  const fetchPromise = fetch(request)
    .then(async (response) => {
      if (response && response.ok) {
        // Clone BEFORE doing anything else with the response
        const responseToCache = response.clone();
        try {
          const cache = await caches.open(cacheName);
          await cache.put(request, responseToCache);
          // console.log("[SW v7] StaleWhileRevalidate: Updated cache for", request.url);
        } catch (e) {
          // console.warn("[SW v7] Failed to cache response:", e);
        }
      }
      return response;
    })
    .catch((error) => {
      // console.log("[SW v7] StaleWhileRevalidate: Fetch failed", request.url, error.message);
      return null;
    });

  // Return cached immediately if available, otherwise wait for fetch
  if (cached) {
    // console.log("[SW v7] StaleWhileRevalidate: Serving from cache", request.url);
    return cached;
  }

  // console.log("[SW v7] StaleWhileRevalidate: No cache, waiting for network", request.url);
  const response = await fetchPromise;

  if (response) {
    return response;
  }

  // If fetch failed and no cache, return error
  throw new Error("Network failed and no cache available");
}

// ✅ NEW: CacheFirstCourse strategy - optimized for pre-generated course pages
async function cacheFirstCourse(request, cacheName) {
  try {
    // Always check cache first for course pages
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Try network if course page not cached (shouldn't happen for downloaded courses)
    const response = await fetch(request);
    if (response && response.ok && response.status !== 206) {
      const cache = await caches.open(cacheName);
      try {
        cache.put(request, response.clone());
      } catch (e) {
        // Ignore cache.put errors
      }
    }
    return response;
  } catch (error) {
    // Network failed - try to serve any cached version
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Last resort - return 503 error page
    return new Response(
      `<html><body><h1>Page Not Available Offline</h1><p>Course page not found in offline storage.</p><a href="/course">Back to Courses</a></body></html>`,
      {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "Content-Type": "text/html" },
      },
    );
  }
}

// CacheFirst strategy
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    // console.log("[SW v7] CacheFirst HIT:", request.url);
    return cached;
  }

  // console.log("[SW v7] CacheFirst MISS, fetching:", request.url);
  try {
    const response = await fetch(request);

    // Only cache successful responses that are NOT partial (206)
    // Partial responses (video range requests) cannot be cached and will cause errors
    if (response.ok && response.status !== 206) {
      const cache = await caches.open(cacheName);
      try {
        cache.put(request, response.clone());
      } catch (cacheError) {
        // console.warn("[SW v8] Cache.put() failed (non-fatal):", cacheError);
        // Continue without caching - return the response anyway
      }
    }
    return response;
  } catch (error) {
    // console.error("[SW v7] Fetch failed:", error);

    // For Next.js chunks and JS files, check if we have ANY cached version
    const url = new URL(request.url);
    if (url.pathname.includes("/_next/") || url.pathname.endsWith(".js")) {
      // console.log("[SW v7] JS chunk failed, checking all caches for similar resources");

      // Try to find in any cache
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const match = await cache.match(request);
        if (match) {
          // console.log("[SW v7] Found chunk in cache:", name);
          return match;
        }
      }

      // If still not found, try to find the page's main layout chunk as fallback
      // Instead of returning empty JS (which silently breaks the app), return a
      // module that triggers Next.js error boundary so the user sees a useful message
      console.warn("[SW v8.1] Chunk not in any cache:", request.url);
      return new Response(
        '// Offline: chunk unavailable\nconsole.warn("[Offline] JS chunk not cached:", ' +
          JSON.stringify(request.url) +
          ");",
        {
          status: 200,
          headers: { "Content-Type": "application/javascript" },
        },
      );
    }

    // Try to return offline page for navigation requests
    if (request.mode === "navigate") {
      return caches.match("/offline.html");
    }
    throw error;
  }
}

// NetworkFirst strategy with timeout
async function networkFirst(request, cacheName, timeout = 3000) {
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Network timeout")), timeout),
    );

    const response = await Promise.race([fetch(request), timeoutPromise]);

    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // IMPORTANT: For client-side navigation, check dynamic cache first
    let cached = await caches.match(request);

    if (cached) {
      return cached;
    }

    // For course pages with query parameters, try matching the base URL
    // This allows /course/170/view?page=5 to use cached /course/170/view
    const url = new URL(request.url);
    if (url.pathname.startsWith("/course/") && url.search.length > 0) {
      const baseUrl = url.origin + url.pathname;
      const baseRequest = new Request(baseUrl);
      cached = await caches.match(baseRequest);
      if (cached) {
        return cached;
      }
    }

    // For API requests that fail, return a proper JSON error response
    if (request.url.includes("/api/")) {
      return new Response(
        JSON.stringify({
          error: "offline",
          message: "You are currently offline. Please check your connection.",
        }),
        {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // For navigation requests (opening app/pages)
    if (request.mode === "navigate") {
      const url = new URL(request.url);
      // console.log("[SW v7] Navigation offline for path:", url.pathname);

      // Try to get the exact page from dynamic cache first
      const dynamicCache = await caches.open(CACHE_NAMES.dynamic);
      const dynamicCached = await dynamicCache.match(request.url);
      if (dynamicCached) {
        // console.log("[SW v7] Serving exact page from dynamic cache");
        return dynamicCached;
      }

      // CRITICAL FIX: For course view pages (/course/[id]/view), try the base URL
      // without query params before falling back to a different route's HTML.
      // Query params like ?page=5 shouldn't require a separate cache entry.
      const courseViewMatch = url.pathname.match(/^\/course\/(\d+)\/view/);
      if (courseViewMatch) {
        const baseViewUrl = `${url.origin}/course/${courseViewMatch[1]}/view`;
        const baseViewCached = await dynamicCache.match(baseViewUrl);
        if (baseViewCached) {
          return baseViewCached;
        }

        // Also try the course detail page as it shares most chunks
        const detailUrl = `${url.origin}/course/${courseViewMatch[1]}`;
        const detailCached = await dynamicCache.match(detailUrl);
        if (detailCached) {
          return detailCached;
        }

        // Try any other cached course view page - they share the same JS chunks
        const allDynamicKeys = await dynamicCache.keys();
        const anyCourseView = allDynamicKeys.find((req) => {
          const reqUrl = new URL(req.url);
          return reqUrl.pathname.match(/^\/course\/\d+\/view$/);
        });
        if (anyCourseView) {
          const anyCourseViewResponse = await dynamicCache.match(anyCourseView);
          if (anyCourseViewResponse) {
            return anyCourseViewResponse;
          }
        }
      }

      // Try static cache for the exact URL
      const staticCache = await caches.open(CACHE_NAMES.static);
      const staticCached = await staticCache.match(request.url);
      if (staticCached) {
        // console.log("[SW v7] Serving exact page from static cache");
        return staticCached;
      }

      // For app routes, try to serve a cached page that can bootstrap the app
      // Try /course first as it's the main landing page
      const coursePage = await caches.match("/course");
      if (coursePage) {
        // console.log("[SW v7] Serving /course page as app shell for:", url.pathname);
        return coursePage;
      }

      // Try root page
      const rootPage = await caches.match("/");
      if (rootPage) {
        // console.log("[SW v7] Serving root page as fallback");
        return rootPage;
      }

      // Try static cache root
      const staticHome = await staticCache.match("/");
      if (staticHome) {
        // console.log("[SW v7] Serving home from static cache");
        return staticHome;
      }

      // Last resort - offline page
      const offlinePage = await caches.match("/offline.html");
      if (offlinePage) {
        // console.log("[SW v7] Serving offline page");
        return offlinePage;
      }
    }

    // For other requests (images, scripts), return a network error
    // console.log("[SW v7] No cache available, returning network error");
    return new Response("Offline - No cached version available", {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Content-Type": "text/plain" },
    });
  }
}

// Fetch event - handle all network requests
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // Skip chrome extension requests
  if (event.request.url.startsWith("chrome-extension://")) {
    return;
  }

  // Skip service worker for certain requests that should fail silently
  const url = new URL(event.request.url);

  // Let media downloads go directly without caching to avoid fetch failures
  if (url.pathname.startsWith("/media/uploaded/")) {
    return; // Let browser handle it directly
  }

  // Skip external fonts (Google Fonts) - they fail offline and shouldn't block navigation
  if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    return; // Let browser handle it (will fail silently offline)
  }

  // Skip tracker API calls when offline - they should be queued instead
  if (
    !navigator.onLine &&
    (url.pathname.includes("/api/v2/tracker") ||
      url.pathname.includes("/activitylog/"))
  ) {
    // Return empty success response to prevent console errors
    event.respondWith(
      Promise.resolve(
        new Response(JSON.stringify({ success: true, queued: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    return;
  }

  const { strategy, cacheName, timeout } = getCacheStrategy(event.request);

  if (strategy === "CacheFirst") {
    event.respondWith(cacheFirst(event.request, cacheName));
  } else if (strategy === "StaleWhileRevalidate") {
    event.respondWith(staleWhileRevalidate(event.request, cacheName));
  } else {
    // NetworkFirst for everything else (including course pages)
    event.respondWith(networkFirst(event.request, cacheName, timeout));
  }
});

// Background sync for activity tracking
self.addEventListener("sync", (event) => {
  // console.log("[SW v7] Background sync:", event.tag);

  if (event.tag === "sync-trackers") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: "BACKGROUND_SYNC",
            tag: event.tag,
          });
        });
      }),
    );
  }
});

// Handle messages from clients
self.addEventListener("message", (event) => {
  // console.log("[SW v7] Message received:", event.data);

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "CLIENTS_CLAIM") {
    self.clients.claim();
  }

  if (event.data && event.data.type === "CACHE_URLS") {
    // console.log("[SW v7] CACHE_URLS received:", event.data.urls);
    event.waitUntil(
      caches.open(CACHE_NAMES.dynamic).then(async (cache) => {
        // Fetch and cache each URL individually to handle failures gracefully
        const results = await Promise.allSettled(
          event.data.urls.map(async (url) => {
            try {
              const response = await fetch(url, { cache: "reload" });
              if (response.ok) {
                await cache.put(url, response);
                // console.log("[SW v7] Cached URL:", url);
                return { url, success: true };
              } else {
                // console.warn("[SW v7] Failed to cache URL (bad status):", url, response.status);
                return {
                  url,
                  success: false,
                  error: `Status ${response.status}`,
                };
              }
            } catch (err) {
              // console.warn("[SW v7] Failed to cache URL:", url, err.message);
              return { url, success: false, error: err.message };
            }
          }),
        );
        // console.log("[SW v7] CACHE_URLS complete:", results);
      }),
    );
  }

  if (event.data && event.data.type === "GET_CACHE_SIZE") {
    event.waitUntil(
      Promise.all(
        ALL_CACHES.map((cacheName) =>
          caches.open(cacheName).then((cache) =>
            cache.keys().then((keys) => ({
              name: cacheName,
              count: keys.length,
            })),
          ),
        ),
      ).then((results) => {
        event.ports[0].postMessage({
          type: "CACHE_SIZE",
          caches: results,
        });
      }),
    );
  }
});

// console.log("[SW v7] Service worker loaded successfully");
