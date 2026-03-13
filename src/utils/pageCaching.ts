/**
 * Utility functions for caching pages and their dependencies for offline use
 */

/** localStorage key for pages cached on visit (points, scoreboard); cleared on logout */
export const VISIT_CACHED_STORAGE_KEY = "noora-visit-cached-pages";

/** Paths cached on login or when visiting /course (settings, privacy, profile, about/help) */
export const STATIC_PAGES_TO_CACHE_ON_LOGIN = [
  "/course",
  "/settings",
  "/privacy-policy",
  "/profile",
  "/about-help",
];

/** Path prefixes allowed when offline (course pages cached on download; static pages on login) */
const OFFLINE_ALLOWED_PREFIXES = [
  "/course",
  "/offline",
  "/login",
  "/verify-otp",
];
/** Exact paths we cache on login (no sub-paths) */
const OFFLINE_ALLOWED_EXACT = [
  "/",
  "/settings",
  "/privacy-policy",
  "/profile",
  "/about-help",
];

/**
 * Exception handler: Check if pathname is a downloadable course page
 * even if it's not in the standard offline-allowed list
 */
const OFFLINE_DYNAMIC_PATHS = ["/course-management"];

export function isDownloadableCoursePath(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/";
  return OFFLINE_DYNAMIC_PATHS.some(
    (prefix) => normalized === prefix || normalized.startsWith(prefix + "/"),
  );
}

/** Paths that are only available offline if user has visited them (cache on visit) */
export const VISIT_CACHED_PATHS = ["/points", "/scoreboard"];

function getVisitCachedPages(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(VISIT_CACHED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((p) => typeof p === "string")
      : [];
  } catch {
    return [];
  }
}

export function markPageAsVisitCached(pathname: string): void {
  if (typeof window === "undefined") return;
  const normalized = pathname.replace(/\/$/, "") || "/";
  if (!VISIT_CACHED_PATHS.includes(normalized)) return;
  try {
    const list = getVisitCachedPages();
    if (list.includes(normalized)) return;
    list.push(normalized);
    localStorage.setItem(VISIT_CACHED_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {}
}

/**
 * Returns true if the given pathname is available offline (cached on login, on /course visit, or on visiting that page).
 * Points and scoreboard are only available offline if the user has visited them (cached on visit).
 */
export function isPathAvailableOffline(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/";
  if (OFFLINE_ALLOWED_EXACT.includes(normalized)) return true;
  if (VISIT_CACHED_PATHS.includes(normalized)) {
    return getVisitCachedPages().includes(normalized);
  }
  return OFFLINE_ALLOWED_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(prefix + "/"),
  );
}

/**
 * Pre-cache settings, privacy policy, and about/help pages when user logs in
 * so they can access these pages offline.
 */
export async function preCacheStaticPagesOnLogin(
  cacheName: string = "noora-dynamic-v7",
): Promise<void> {
  if (!navigator.onLine) {
    return;
  }
  if (!("caches" in window)) {
    return;
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const start = Date.now();
  await Promise.all(
    STATIC_PAGES_TO_CACHE_ON_LOGIN.map((path) =>
      cachePageWithDependencies(`${baseUrl}${path}`, cacheName),
    ),
  );

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
}

/**
 * Extract all resource URLs from HTML (scripts, stylesheets, etc.)
 */
function extractResourcesFromHtml(html: string, baseUrl: string): string[] {
  const resources: string[] = [];

  // Extract script src
  const scriptMatches = html.matchAll(/<script[^>]+src=["']([^"']+)["']/g);
  for (const match of scriptMatches) {
    resources.push(match[1]);
  }

  // Extract link href (stylesheets, preload, etc.)
  const linkMatches = html.matchAll(/<link[^>]+href=["']([^"']+)["']/g);
  for (const match of linkMatches) {
    const href = match[1];
    // Only include stylesheets and preload resources
    if (href.includes(".css") || href.includes("/_next/")) {
      resources.push(href);
    }
  }

  // Convert relative URLs to absolute
  return resources
    .map((url) => {
      if (url.startsWith("http")) return url;
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      return url;
    })
    .filter((url) => {
      // Filter out external URLs and keep only same-origin resources
      try {
        const urlObj = new URL(url, baseUrl);
        return urlObj.origin === baseUrl;
      } catch {
        return false;
      }
    });
}

/**
 * Cache a page and all its dependencies (JS chunks, CSS) for offline access
 */
export async function cachePageWithDependencies(
  url: string,
  cacheName: string = "noora-dynamic-v7",
): Promise<boolean> {
  if (!("caches" in window)) {
    return false;
  }

  try {
    const cache = await caches.open(cacheName);
    const baseUrl = window.location.origin;

    // Fetch the page
    const response = await fetch(url);
    if (!response.ok) {
      return false;
    }

    // Cache the page itself
    await cache.put(url, response.clone());

    // Get response metadata
    const contentType = response.headers.get("content-type") || "unknown";
    const contentLength = response.headers.get("content-length");
    const responseSize = contentLength ? parseInt(contentLength, 10) : null;

    // Extract and cache all resources
    const html = await response.text();
    const resources = extractResourcesFromHtml(html, baseUrl);

    // Cache all resources
    let successCount = 0;
    const cachedResources: Array<{ url: string; size: string; type: string }> =
      [];
    const failedResources: string[] = [];

    for (const resourceUrl of resources) {
      try {
        const resourceResponse = await fetch(resourceUrl);
        if (resourceResponse.ok) {
          await cache.put(resourceUrl, resourceResponse);
          successCount++;

          const resContentType =
            resourceResponse.headers.get("content-type") || "unknown";
          const resContentLength =
            resourceResponse.headers.get("content-length");
          const resSize = resContentLength
            ? parseInt(resContentLength, 10)
            : null;

          cachedResources.push({
            url: resourceUrl,
            size: resSize ? `${(resSize / 1024).toFixed(2)} KB` : "unknown",
            type: resContentType.split(";")[0], // Just the MIME type
          });
        } else {
          failedResources.push(`${resourceUrl} (${resourceResponse.status})`);
        }
      } catch (error) {
        failedResources.push(
          `${resourceUrl} (${error instanceof Error ? error.message : "unknown error"})`,
        );
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Pre-cache course view page when course detail page loads
 * This ensures the view page works offline even if not visited yet
 */
export async function preCacheCourseViewPage(
  courseId: string,
  shortname?: string,
): Promise<void> {
  if (!navigator.onLine) {
    return;
  }

  try {
    const baseViewUrl = `/course/${courseId}/view`;
    const urls = [baseViewUrl, `${baseViewUrl}?page=0`];

    if (shortname) {
      urls.push(`${baseViewUrl}?shortname=${encodeURIComponent(shortname)}`);
      urls.push(
        `${baseViewUrl}?page=0&shortname=${encodeURIComponent(shortname)}`,
      );
    }

    // Cache all view page variants
    for (const url of urls) {
      await cachePageWithDependencies(url);
    }
  } catch (error) {}
}
