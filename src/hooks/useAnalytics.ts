"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { analytics } from "@/lib/analytics";
import type { UserProperties } from "@/lib/analytics";

/**
 * Hook for automatic page view tracking
 */
export function usePageTracking() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) {
      analytics.trackPageView(pathname);
    }
  }, [pathname]);
}

/**
 * Hook for analytics functionality
 */
export function useAnalytics() {
  return {
    /**
     * Track a page view manually
     */
    trackPageView: (page: string) => {
      analytics.trackPageView(page);
    },

    /**
     * Set user identifier
     */
    setUserId: (userId: string) => {
      analytics.setUserId(userId);
    },

    /**
     * Set user properties
     */
    setUserProperties: (props: UserProperties) => {
      analytics.setUserProperties(props);
    },

    /**
     * Track custom event
     */
    trackEvent: (eventName: string, data?: Record<string, any>) => {
      analytics.trackEvent(eventName, data);
    },

    /**
     * Start analytics session
     */
    startSession: () => {
      analytics.startSession();
    },

    /**
     * End analytics session
     */
    endSession: () => {
      analytics.endSession();
    },

    /**
     * Check if analytics is enabled
     */
    isEnabled: () => {
      return analytics.getIsEnabled();
    },
  };
}
