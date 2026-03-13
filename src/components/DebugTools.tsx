"use client";

import { useEffect } from "react";

/**
 * Development-only debug tools component
 * Loads auth debug utilities in browser console
 */
export function DebugTools() {
  useEffect(() => {
    // Only load in development
    if (process.env.NODE_ENV === "development") {
      import("@/utils/authDebug");
    }
  }, []);

  // This component doesn't render anything
  return null;
}
