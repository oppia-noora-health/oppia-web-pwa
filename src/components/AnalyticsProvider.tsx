"use client";

import { usePageTracking } from "@/hooks/useAnalytics";

/**
 * Analytics Provider Component
 * Wraps the app to enable automatic page view tracking
 */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  // Auto page view tracking
  usePageTracking();

  return <>{children}</>;
}
