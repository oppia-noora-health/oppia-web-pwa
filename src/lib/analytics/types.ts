/**
 * Analytics Engine Interface
 */
export interface AnalyticsEngine {
  // Session management
  startSession?: () => void;
  endSession?: () => void;

  // Page tracking
  trackPageView: (pageName: string) => void;

  // User identification
  setUserId: (userId: string) => void;
  setUserProperties: (props: Record<string, any>) => void;

  // Event tracking
  trackEvent?: (eventName: string, data?: Record<string, any>) => void;
}

/**
 * User properties for analytics
 */
export interface UserProperties {
  username?: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  [key: string]: any;
}

/**
 * Page view event
 */
export interface PageViewEvent {
  pageName: string;
  path: string;
  timestamp: number;
}

/**
 * Custom event data
 */
export interface CustomEventData {
  [key: string]: string | number | boolean | undefined;
}
