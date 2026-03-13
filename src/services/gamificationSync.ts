"use client";

import { autoSubmitIfOnline, SubmitResult } from "./trackerSubmission";

/**
 * Background sync service for gamification trackers
 *
 * This service:
 * 1. Runs periodic sync of unsubmitted trackers when user is online
 * 2. Listens to online/offline events for immediate sync
 * 3. Uses native Background Sync API when available
 * 4. Implements exponential backoff for failed syncs
 * 5. Provides sync status callbacks for UI updates
 * 6. Can be started/stopped as needed
 */

// Type definitions for Background Sync API (not in standard TS lib yet)
interface SyncManager {
  register(tag: string): Promise<void>;
  getTags(): Promise<string[]>;
}

interface ServiceWorkerRegistration {
  readonly sync: SyncManager;
}

// Sync state
let syncIntervalId: NodeJS.Timeout | null = null;
let isRunning = false;
let isSyncing = false;
let retryCount = 0;
let retryTimeoutId: NodeJS.Timeout | null = null;

// Sync configuration
const SYNC_INTERVAL = 30 * 1000; // 30 seconds - faster sync when online
const MIN_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 5 * 60 * 1000; // 5 minutes max
const MAX_RETRY_COUNT = 10;

// Status callback for UI updates
type SyncStatusCallback = (status: SyncStatus) => void;
let statusCallback: SyncStatusCallback | null = null;

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  lastSyncResult: SubmitResult | null;
  retryCount: number;
  nextRetryTime: Date | null;
  pendingTrackers: number;
  pendingQuizAttempts: number;
}

let currentStatus: SyncStatus = {
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  isSyncing: false,
  lastSyncTime: null,
  lastSyncResult: null,
  retryCount: 0,
  nextRetryTime: null,
  pendingTrackers: 0,
  pendingQuizAttempts: 0,
};

/**
 * Update and broadcast sync status
 */
function updateStatus(updates: Partial<SyncStatus>) {
  currentStatus = { ...currentStatus, ...updates };
  if (statusCallback) {
    statusCallback(currentStatus);
  }
}

/**
 * Set status callback for UI updates
 */
export function setSyncStatusCallback(callback: SyncStatusCallback | null) {
  statusCallback = callback;
  // Immediately call with current status
  if (callback) {
    callback(currentStatus);
  }
}

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncStatus {
  return { ...currentStatus };
}

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt: number): number {
  const delay = Math.min(
    MIN_RETRY_DELAY * Math.pow(2, attempt),
    MAX_RETRY_DELAY,
  );
  // Add some jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
}

/**
 * Register native Background Sync if available
 */
async function registerBackgroundSync() {
  if (
    "serviceWorker" in navigator &&
    "sync" in ServiceWorkerRegistration.prototype
  ) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register("sync-trackers");
      return true;
    } catch (error) {
      return false;
    }
  }
  return false;
}

/**
 * Listen for messages from service worker
 */
function setupServiceWorkerListener(
  userId: number,
  username: string,
  apiKey: string,
) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "BACKGROUND_SYNC") {
        performSync(userId, username, apiKey);
      }
      if (event.data && event.data.type === "SYNC_TRACKERS") {
        performSync(userId, username, apiKey);
      }
    });
  }
}

/**
 * Setup online/offline event listeners
 */
function setupOnlineListeners(
  userId: number,
  username: string,
  apiKey: string,
) {
  if (typeof window !== "undefined") {
    // Use named functions for proper removal
    const onlineHandler = () => handleOnlineEvent(userId, username, apiKey);
    const offlineHandler = () => handleOfflineEvent();

    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);

    // Store handlers for cleanup
    (window as any).__gamificationSyncHandlers = {
      online: onlineHandler,
      offline: offlineHandler,
    };
  }
}

/**
 * Start background sync service
 */
export function startBackgroundSync(
  userId: number,
  username: string,
  apiKey: string,
) {
  if (isRunning) {
    return;
  }

  isRunning = true;
  retryCount = 0;

  // Update online status
  updateStatus({
    isOnline: navigator.onLine,
    retryCount: 0,
  });

  // Initial sync
  performSync(userId, username, apiKey);

  // Register native Background Sync
  registerBackgroundSync();

  // Setup service worker message listener
  setupServiceWorkerListener(userId, username, apiKey);

  // Setup online/offline listeners
  setupOnlineListeners(userId, username, apiKey);

  // Set up periodic sync as fallback
  syncIntervalId = setInterval(() => {
    if (!isSyncing) {
      performSync(userId, username, apiKey);
    }
  }, SYNC_INTERVAL);
}

/**
 * Stop background sync service
 */
export function stopBackgroundSync() {
  if (!isRunning) {
    return;
  }

  isRunning = false;
  isSyncing = false;
  retryCount = 0;

  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }

  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }

  // Remove event listeners
  if (typeof window !== "undefined") {
    const handlers = (window as any).__gamificationSyncHandlers;
    if (handlers) {
      window.removeEventListener("online", handlers.online);
      window.removeEventListener("offline", handlers.offline);
      delete (window as any).__gamificationSyncHandlers;
    }
  }

  updateStatus({
    isSyncing: false,
    retryCount: 0,
    nextRetryTime: null,
  });
}

/**
 * Perform sync operation with retry logic
 */
async function performSync(userId: number, username: string, apiKey: string) {
  if (!navigator.onLine) {
    updateStatus({ isOnline: false });
    return;
  }

  if (isSyncing) {
    return;
  }

  isSyncing = true;
  updateStatus({ isSyncing: true, isOnline: true });

  try {
    // Get current API points before sync
    const { useAuthStore } = await import("@/store/useStore");
    const oldApiPoints = useAuthStore.getState().user?.points || 0;

    const result = await autoSubmitIfOnline(userId, username, apiKey);

    // Success - reset retry count
    retryCount = 0;

    // After successful sync, refresh from API and reset local points only if API updated
    if (result.trackers.submitted > 0 || result.quizAttempts.submitted > 0) {
      // Fetch fresh points from API
      const { getUserProfile } = await import("@/services/userDataService");
      try {
        const profile = await getUserProfile(userId);
        if (profile) {
          const newApiPoints = profile.points || 0;

          // Update auth store with fresh API points
          const { updateUser } = useAuthStore.getState();
          updateUser({
            points: newApiPoints,
            badges: profile.badges || 0,
          });

          // Only reset local points if API points have increased (sync reflected)
          if (newApiPoints > oldApiPoints) {
            const { resetUserPoints } = await import("@/utils/gamificationIDB");
            await resetUserPoints(userId);

            // Reset gamification points store to 0 since all points now in API
            const { useGamificationPointsStore } =
              await import("@/store/useStore");
            const { setPoints } = useGamificationPointsStore.getState();
            setPoints(0, profile.badges || 0);
          } else {}
        }
      } catch (error) {}
    }

    updateStatus({
      isSyncing: false,
      lastSyncTime: new Date(),
      lastSyncResult: result,
      retryCount: 0,
      nextRetryTime: null,
      pendingTrackers: 0,
      pendingQuizAttempts: 0,
    });

    // If there were partial failures, schedule a retry
    if (result.trackers.failed > 0 || result.quizAttempts.failed > 0) {
      scheduleRetry(userId, username, apiKey);
    }
  } catch (error) {
    updateStatus({
      isSyncing: false,
      lastSyncTime: new Date(),
      lastSyncResult: null,
    });

    // Schedule retry with exponential backoff
    scheduleRetry(userId, username, apiKey);
  } finally {
    isSyncing = false;
  }
}

/**
 * Schedule retry with exponential backoff
 */
function scheduleRetry(userId: number, username: string, apiKey: string) {
  if (retryCount >= MAX_RETRY_COUNT) {
    updateStatus({
      retryCount,
      nextRetryTime: null,
    });
    return;
  }

  retryCount++;
  const delay = getRetryDelay(retryCount);
  const nextRetryTime = new Date(Date.now() + delay);

  updateStatus({
    retryCount,
    nextRetryTime,
  });

  // Clear any existing retry timeout
  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
  }

  retryTimeoutId = setTimeout(() => {
    if (isRunning && navigator.onLine) {
      performSync(userId, username, apiKey);
    }
  }, delay);
}

/**
 * Handle online event - immediate sync with retry reset
 */
function handleOnlineEvent(userId: number, username: string, apiKey: string) {
  // Reset retry count on coming online
  retryCount = 0;
  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }

  updateStatus({
    isOnline: true,
    retryCount: 0,
    nextRetryTime: null,
  });

  // Trigger immediate sync
  performSync(userId, username, apiKey);

  // Also try to register background sync
  registerBackgroundSync();
}

/**
 * Handle offline event
 */
function handleOfflineEvent() {
  updateStatus({ isOnline: false });

  // Clear any pending retry
  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }
}

/**
 * Check if background sync is running
 */
export function isBackgroundSyncRunning(): boolean {
  return isRunning;
}

/**
 * Check if currently syncing
 */
export function isSyncInProgress(): boolean {
  return isSyncing;
}

/**
 * Trigger manual sync (useful for testing or user-initiated sync)
 */
export async function triggerManualSync(
  userId: number,
  username: string,
  apiKey: string,
): Promise<SubmitResult | null> {
  // Reset retry count for manual sync
  retryCount = 0;
  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }

  if (!navigator.onLine) {
    updateStatus({ isOnline: false });
    return null;
  }

  isSyncing = true;
  updateStatus({ isSyncing: true, isOnline: true, retryCount: 0 });

  try {
    // Get current API points before sync
    const { useAuthStore } = await import("@/store/useStore");
    const oldApiPoints = useAuthStore.getState().user?.points || 0;

    const result = await autoSubmitIfOnline(userId, username, apiKey);

    // After successful sync, refresh from API and reset local points only if API updated
    if (result.trackers.submitted > 0 || result.quizAttempts.submitted > 0) {
      // Fetch fresh points from API
      const { getUserProfile } = await import("@/services/userDataService");
      try {
        const profile = await getUserProfile(userId);
        if (profile) {
          const newApiPoints = profile.points || 0;

          // Update auth store with fresh API points
          const { updateUser } = useAuthStore.getState();
          updateUser({
            points: newApiPoints,
            badges: profile.badges || 0,
          });

          // Only reset local points if API points have increased (sync reflected)
          if (newApiPoints > oldApiPoints) {
            const { resetUserPoints } = await import("@/utils/gamificationIDB");
            await resetUserPoints(userId);

            // Reset gamification points store to 0 since all points now in API
            const { useGamificationPointsStore } =
              await import("@/store/useStore");
            const { setPoints } = useGamificationPointsStore.getState();
            setPoints(0, profile.badges || 0);
          } else {}
        }
      } catch (error) {}
    }

    updateStatus({
      isSyncing: false,
      lastSyncTime: new Date(),
      lastSyncResult: result,
      pendingTrackers: 0,
      pendingQuizAttempts: 0,
    });
    return result;
  } catch (error) {
    updateStatus({
      isSyncing: false,
      lastSyncTime: new Date(),
      lastSyncResult: null,
    });
    return null;
  } finally {
    isSyncing = false;
  }
}

/**
 * Force immediate sync attempt (ignores current sync state)
 */
export async function forceSyncNow(
  userId: number,
  username: string,
  apiKey: string,
): Promise<boolean> {
  if (!navigator.onLine) {
    return false;
  }

  try {
    const result = await autoSubmitIfOnline(userId, username, apiKey);
    return true;
  } catch (error) {
    return false;
  }
}
