import Countly from "countly-sdk-web";
import { AnalyticsEngine } from "./types";

/**
 * Countly Analytics Implementation
 */
export class CountlyAnalytics implements AnalyticsEngine {
  private isInitialized = false;
  private readonly appKey: string;
  private readonly serverUrl: string;

  constructor() {
    this.appKey = process.env.NEXT_PUBLIC_COUNTLY_APP_KEY || "";
    this.serverUrl = process.env.NEXT_PUBLIC_COUNTLY_SERVER_URL || "";

    if (typeof window !== "undefined") {
      this.initialize();
    }
  }

  private initialize(): void {
    if (this.isInitialized) return;

    if (!this.appKey || !this.serverUrl) {
      return;
    }

    try {
      Countly.init({
        app_key: this.appKey,
        url: this.serverUrl,

        // Enable features
        debug: process.env.NODE_ENV === "development",

        // Use cookies for device ID
        use_session_cookie: true,
        session_cookie_timeout: 30, // minutes
      });

      Countly.track_sessions();
      Countly.track_errors();
      Countly.track_clicks();
      Countly.track_links();
      Countly.track_scrolls();
      Countly.track_forms();

      this.isInitialized = true;
    } catch (error) {}
  }

  trackPageView(pageName: string): void {
    if (!this.isInitialized) return;

    try {
      Countly.track_pageview(pageName);
    } catch (error) {}
  }

  setUserId(userId: string): void {
    if (!this.isInitialized) return;

    try {
      Countly.change_id(userId || "anonymous", true);
    } catch (error) {}
  }

  setUserProperties(props: Record<string, any>): void {
    if (!this.isInitialized) return;

    try {
      Countly.user_details({
        name:
          props.firstName && props.lastName
            ? `${props.firstName} ${props.lastName}`
            : props.username,
        username: props.username,
        email: props.email,
        phone: props.phoneNumber,
        custom: {
          userId: props.userId,
          ...props.custom,
        },
      });
    } catch (error) {}
  }

  startSession(): void {}

  endSession(): void {}

  trackEvent(): void {
    // Intentionally disabled: Countly should only collect SDK automatic data.
  }
}
