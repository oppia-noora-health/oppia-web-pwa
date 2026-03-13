import { CountlyAnalytics } from "./countly";
import { NoOpAnalytics } from "./noop";
import { AnalyticsEngine, UserProperties } from "./types";

/**
 * Analytics Facade
 * Single entry point for all analytics calls
 */
class Analytics {
  private static instance: Analytics;
  private engine: AnalyticsEngine;
  private isEnabled: boolean = false;

  private constructor() {
    // Determine which analytics engine to use
    const analyticsEnabled =
      process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true";
    const hasCountlyConfig = !!(
      process.env.NEXT_PUBLIC_COUNTLY_APP_KEY &&
      process.env.NEXT_PUBLIC_COUNTLY_SERVER_URL
    );

    if (analyticsEnabled && hasCountlyConfig) {
      this.engine = new CountlyAnalytics();
      this.isEnabled = true;
    } else {
      this.engine = new NoOpAnalytics();
      this.isEnabled = false;
    }
  }

  static getInstance(): Analytics {
    if (!Analytics.instance) {
      Analytics.instance = new Analytics();
    }
    return Analytics.instance;
  }

  /**
   * Track page view
   */
  trackPageView(pageName: string): void {
    if (!this.isEnabled) return;
    this.engine.trackPageView(pageName);
  }

  /**
   * Set user identifier
   */
  setUserId(userId: string): void {
    if (!this.isEnabled) return;
    this.engine.setUserId(userId);
  }

  /**
   * Set user properties
   */
  setUserProperties(props: UserProperties): void {
    if (!this.isEnabled) return;
    this.engine.setUserProperties(props);
  }

  /**
   * Track custom event
   */
  trackEvent(eventName: string, data?: Record<string, any>): void {
    if (!this.isEnabled) return;
    this.engine.trackEvent?.(eventName, data);
  }

  /**
   * Start analytics session
   */
  startSession(): void {
    if (!this.isEnabled) return;
    this.engine.startSession?.();
  }

  /**
   * End analytics session
   */
  endSession(): void {
    if (!this.isEnabled) return;
    this.engine.endSession?.();
  }

  /**
   * Check if analytics is enabled
   */
  getIsEnabled(): boolean {
    return this.isEnabled;
  }
}

// Export singleton instance
export const analytics = Analytics.getInstance();

// Export class for testing
export { Analytics };

// Export types
export type { AnalyticsEngine, UserProperties } from "./types";
