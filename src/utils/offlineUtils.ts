/**
 * Utility function for fetch with timeout
 * Prevents hanging requests when network is flaky or unreachable
 */

export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {},
): Promise<Response> {
  const { timeout = 8000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeout}ms: ${url}`);
    }
    throw error;
  }
}

/**
 * Race against timeout promise
 * Useful for Promise.race patterns
 */
export function createTimeoutPromise<T>(timeout: number): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Check if page is truly offline (not just slow network)
 * Uses multiple signals instead of just navigator.onLine
 */
export async function isTrulyOffline(): Promise<boolean> {
  // First check: navigator.onLine (unreliable but fast)
  if (!navigator.onLine) {
    return true;
  }

  // Second check: Try a quick API ping with timeout
  try {
    const response = await fetchWithTimeout("/api/v2/?__ping=1", {
      method: "HEAD",
      timeout: 3000,
    });
    return !response.ok;
  } catch (error) {
    // If ping fails, we're likely offline
    console.warn("[OfflineDetection] API ping failed:", error);
    return true;
  }
}

/**
 * Wait for Service Worker to control the current page
 * Unlike SW.ready, this ensures actual control
 */
export async function waitForServiceWorkerControl(
  timeout: number = 10000,
): Promise<boolean> {
  if (!("serviceWorker" in navigator)) {
    return false;
  }

  // If already controlling, great!
  if (navigator.serviceWorker.controller) {
    return true;
  }

  // Wait for controller to be set
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.warn(
        "[SW Control] Timeout waiting for SW controller after " +
          timeout +
          "ms",
      );
      window.removeEventListener("controllerchange", handler);
      resolve(false);
    }, timeout);

    const handler = () => {
      clearTimeout(timeoutId);
      window.removeEventListener("controllerchange", handler);

      resolve(true);
    };

    window.addEventListener("controllerchange", handler, { once: true });

    // Also check periodically (sometimes event doesn't fire)
    const checkInterval = setInterval(() => {
      if (navigator.serviceWorker.controller) {
        clearTimeout(timeoutId);
        clearInterval(checkInterval);
        window.removeEventListener("controllerchange", handler);

        resolve(true);
      }
    }, 500);
  });
}
