"use client";

import { useEffect, useRef, useState } from "react";
import { X, Wifi, WifiOff } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showOnlineMessage, setShowOnlineMessage] = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const previousOnlineRef = useRef(isOnline);
  const offlineDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce offline banner: wait 3s before showing to prevent flash on page refresh
  useEffect(() => {
    if (!isOnline && !isDismissed) {
      offlineDelayRef.current = setTimeout(() => {
        setShowOfflineBanner(true);
      }, 3000);
    } else {
      if (offlineDelayRef.current) {
        clearTimeout(offlineDelayRef.current);
        offlineDelayRef.current = null;
      }
      setShowOfflineBanner(false);
    }
    return () => {
      if (offlineDelayRef.current) {
        clearTimeout(offlineDelayRef.current);
      }
    };
  }, [isOnline, isDismissed]);

  useEffect(() => {
    const wasOnline = previousOnlineRef.current;

    if (wasOnline !== isOnline) {
      setIsDismissed(false);

      if (isOnline) {
        setShowOnlineMessage(true);
        const timer = window.setTimeout(() => {
          setShowOnlineMessage(false);
        }, 3000);

        previousOnlineRef.current = isOnline;
        return () => window.clearTimeout(timer);
      }

      setShowOnlineMessage(false);
      previousOnlineRef.current = isOnline;
    }
  }, [isOnline]);

  // Show online message
  if (showOnlineMessage && isOnline) {
    return (
      <div className="sticky top-0 left-0 right-0 z-9999 bg-green-500 text-white px-4 py-2 text-sm flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2 flex-1">
          <Wifi className="h-4 w-4 shrink-0" />
          <span>Back online. Syncing data...</span>
        </div>
      </div>
    );
  }

  // Don't show if online, dismissed, or still within grace period
  if (isOnline || isDismissed || !showOfflineBanner) {
    return null;
  }

  return (
    <div className="sticky top-0 left-0 right-0 z-9999 bg-amber-500 text-white px-4 py-2 text-sm flex items-center justify-between shadow-md">
      <div className="flex items-center gap-2 flex-1">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span>You are offline. Changes will sync when reconnected.</span>
      </div>
      <button
        onClick={() => setIsDismissed(true)}
        className="hover:bg-amber-600 p-1 rounded transition-colors shrink-0"
        aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
