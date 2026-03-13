"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/useStore";
import { getGamificationStats } from "@/utils/gamificationIDB";
import {
  setSyncStatusCallback,
  getSyncStatus,
  triggerManualSync,
  isBackgroundSyncRunning,
  isSyncInProgress,
} from "@/services/gamificationSync";
import type { SubmitResult } from "@/services/trackerSubmission";

export interface SyncState {
  // Basic pending count (backward compatible)
  pendingCount: number;
  loading: boolean;

  // Enhanced status from gamificationSync
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  lastSyncResult: SubmitResult | null;
  retryCount: number;
  nextRetryTime: Date | null;
  pendingTrackers: number;
  pendingQuizAttempts: number;

  // Functions
  refresh: () => Promise<void>;
  sync: () => Promise<SubmitResult | null>;
  canSync: boolean;
  isServiceRunning: boolean;
}

export function useSyncStatus(): SyncState {
  const { user } = useAuthStore();
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Enhanced sync status from gamificationSync service
  const [syncStatus, setSyncStatus] = useState(() => getSyncStatus());

  const getUserId = useCallback((): number | null => {
    if (!user?.id) return null;
    const parsed =
      typeof user.id === "string" ? parseInt(user.id, 10) : user.id;
    return isNaN(parsed) ? null : parsed;
  }, [user?.id]);

  // Subscribe to sync status updates
  useEffect(() => {
    setSyncStatusCallback(setSyncStatus);

    return () => {
      setSyncStatusCallback(null);
    };
  }, []);

  const refreshPendingCount = useCallback(async () => {
    const userId = getUserId();
    if (userId === null) return;

    try {
      setLoading(true);
      const stats = await getGamificationStats(userId);
      // Include both trackers and quiz attempts in pending count
      setPendingCount(
        stats.unsyncedTrackers + (stats.unsyncedQuizAttempts || 0),
      );
    } catch (error) {} finally {
      setLoading(false);
    }
  }, [getUserId]);

  // Manual sync function
  const sync = useCallback(async (): Promise<SubmitResult | null> => {
    const userId = getUserId();
    if (userId === null || !user?.username || !user?.apiKey) {
      return null;
    }

    const result = await triggerManualSync(userId, user.username, user.apiKey);

    // Refresh pending count after sync
    await refreshPendingCount();

    return result;
  }, [getUserId, user?.username, user?.apiKey, refreshPendingCount]);

  // Refresh on mount and when user changes
  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  // Refresh periodically
  useEffect(() => {
    const interval = setInterval(() => {
      refreshPendingCount();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  // Check if we can sync
  const canSync = Boolean(
    getUserId() !== null &&
    user?.username &&
    user?.apiKey &&
    navigator.onLine &&
    !syncStatus.isSyncing &&
    !isSyncInProgress(),
  );

  return {
    // Basic (backward compatible)
    pendingCount,
    loading,
    refresh: refreshPendingCount,

    // Enhanced sync status
    isOnline: syncStatus.isOnline,
    isSyncing: syncStatus.isSyncing,
    lastSyncTime: syncStatus.lastSyncTime,
    lastSyncResult: syncStatus.lastSyncResult,
    retryCount: syncStatus.retryCount,
    nextRetryTime: syncStatus.nextRetryTime,
    pendingTrackers: syncStatus.pendingTrackers,
    pendingQuizAttempts: syncStatus.pendingQuizAttempts,

    // Functions
    sync,
    canSync,
    isServiceRunning: isBackgroundSyncRunning(),
  };
}
