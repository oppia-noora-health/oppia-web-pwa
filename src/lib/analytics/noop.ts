import { AnalyticsEngine } from "./types";

/**
 * No-op Analytics Implementation
 * Used when analytics is disabled or not configured
 */
export class NoOpAnalytics implements AnalyticsEngine {
  trackPageView(pageName: string): void {
    if (process.env.NODE_ENV === "development") {}
  }

  setUserId(userId: string): void {
    if (process.env.NODE_ENV === "development") {}
  }

  setUserProperties(props: Record<string, any>): void {
    if (process.env.NODE_ENV === "development") {}
  }

  startSession(): void {
    if (process.env.NODE_ENV === "development") {}
  }

  endSession(): void {
    if (process.env.NODE_ENV === "development") {}
  }

  trackEvent(eventName: string, data?: Record<string, any>): void {
    if (process.env.NODE_ENV === "development") {}
  }
}
