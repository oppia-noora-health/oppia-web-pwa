/**
 * Network Utilities
 * Handles online/offline detection and network-aware operations
 */

/**
 * Check if browser is online
 */
export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

/**
 * Wait for network to be online
 */
export function waitForOnline(): Promise<void> {
  return new Promise((resolve) => {
    if (isOnline()) {
      resolve();
      return;
    }

    const handleOnline = () => {
      window.removeEventListener("online", handleOnline);
      resolve();
    };

    window.addEventListener("online", handleOnline);
  });
}

/**
 * Execute function with offline fallback
 */
export async function withOfflineFallback<T>(
  onlineAction: () => Promise<T>,
  offlineAction: () => Promise<T>
): Promise<{ data: T; fromCache: boolean }> {
  if (!isOnline()) {
    const data = await offlineAction();
    return { data, fromCache: true };
  }

  try {
    const data = await onlineAction();
    return { data, fromCache: false };
  } catch (error) {
    // If online action fails, try offline fallback
    try {
      const data = await offlineAction();
      return { data, fromCache: true };
    } catch (offlineError) {
      throw error; // Throw original error
    }
  }
}

/**
 * Retry mechanism with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if offline
      if (!isOnline()) {
        throw error;
      }

      // Don't retry on auth errors (401, 403)
      if (
        (error as any)?.response?.status === 401 ||
        (error as any)?.response?.status === 403
      ) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Listen to online/offline events
 */
export function onNetworkChange(callback: (isOnline: boolean) => void) {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  if (typeof window !== "undefined") {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  }

  // Return cleanup function
  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    }
  };
}

/**
 * Get network status with additional info
 */
export function getNetworkStatus() {
  const online = isOnline();

  // NetworkInformation API (non-standard)
  const connection =
    (navigator as any).connection ||
    (navigator as any).mozConnection ||
    (navigator as any).webkitConnection;

  return {
    online,
    effectiveType: connection?.effectiveType || "unknown",
    downlink: connection?.downlink || 0,
    rtt: connection?.rtt || 0,
    saveData: connection?.saveData || false,
  };
}
