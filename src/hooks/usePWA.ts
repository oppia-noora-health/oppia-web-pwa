"use client";

import { useEffect, useState } from "react";

interface PWAStatus {
  isInstalled: boolean;
  isOnline: boolean;
  isUpdateAvailable: boolean;
}

export function usePWA() {
  const [status, setStatus] = useState<PWAStatus>({
    isInstalled: false,
    isOnline: true,
    isUpdateAvailable: false,
  });

  useEffect(() => {
    // Check if app is installed
    const checkInstalled = () => {
      const isInstalled =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      setStatus((prev) => ({ ...prev, isInstalled }));
    };

    // Check online status
    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, isOnline: false }));
    };

    // Listen for SW update available (from ServiceWorkerRegistration)
    const handleUpdateAvailable = (event: Event) => {
      setStatus((prev) => ({ ...prev, isUpdateAvailable: true }));
    };

    // Check for service worker updates on mount
    const checkForUpdates = async () => {
      if ("serviceWorker" in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;

          // Check for updates immediately
          await registration.update();

          // Also listen for updatefound
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (
                  newWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  // New version is ready
                  setStatus((prev) => ({ ...prev, isUpdateAvailable: true }));
                }
              });
            }
          });
        } catch (error) {
          console.error("[usePWA] Error checking for updates:", error);
        }
      }
    };

    checkInstalled();
    checkForUpdates();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("sw-update-available", handleUpdateAvailable);

    // Set initial online status
    setStatus((prev) => ({ ...prev, isOnline: navigator.onLine }));

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("sw-update-available", handleUpdateAvailable);
    };
  }, []);

  const updateApp = async () => {
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.update();

        // Wait a bit for SW to install, then reload
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } catch (error) {
        console.error("[usePWA] Error updating app:", error);
        window.location.reload();
      }
    }
  };

  return {
    ...status,
    updateApp,
  };
}
