"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      // Register custom service worker
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((registration) => {
          // Check for updates every 5 minutes
          setInterval(
            () => {
              registration.update();
            },
            5 * 60 * 1000,
          );

          // Listen for updates
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (
                  newWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  // New SW is ready - notify user to reload
                  const event = new Event("sw-update-available");
                  window.dispatchEvent(event);
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error("[SW Registration] Error:", error);
        });

      // Handle messages from service worker
      navigator.serviceWorker.addEventListener("message", (event) => {
        // Update available notification from SW
        if (event.data.type === "UPDATE_AVAILABLE") {
          console.log("[SW Message] Update available:", event.data.version);

          // Store update info
          if (typeof window !== "undefined") {
            (window as any).swUpdateInfo = {
              version: event.data.version,
              timestamp: event.data.timestamp,
            };
          }

          // Dispatch event so UI can show update prompt
          const updateEvent = new CustomEvent("sw-update-available", {
            detail: event.data,
          });
          window.dispatchEvent(updateEvent);
        }

        // Gamification sync
        if (event.data.type === "BACKGROUND_SYNC") {
          // Trigger gamification sync
          if (
            typeof window !== "undefined" &&
            (window as any).gamificationSync?.syncNow
          ) {
            (window as any).gamificationSync.syncNow();
          }
        }
      });
    }
  }, []);

  return null;
}
