/**
 * Application-wide constants
 */

// API Base URLs
export const API_BASE_URL = "https://academy-indonesia.noorahealth.org";
export const API_V2_URL = `${API_BASE_URL}/api/v2`;
export const MEDIA_URL = `${API_BASE_URL}/media`;

export const getApiUrl = (): string => {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("custom_api_url");
      if (stored) return stored;
    } catch {
      // localStorage not available (SSR, private browsing, etc.)
    }
  }
  return `${API_V2_URL}/`;
};

// Gamification Page Completion Settings
// Controls how page completion is determined: by time spent or reading speed (WPM)
export const PAGE_COMPLETED_METHOD_DEFAULT: "TIME_SPENT" | "WPM" = "TIME_SPENT";
export const PAGE_COMPLETED_TIME_SPENT_DEFAULT = 3; // seconds (fallback if WPM has no content)
export const PAGE_COMPLETED_WPM_DEFAULT = 125; // words per minute for reading speed threshold

export const MEDIA_COMPLETION_METHOD_DEFAULT: "threshold" | "intervals" =
  "threshold";
export const MEDIA_THRESHOLD_PERCENTAGE_DEFAULT = 80; // % of media required for threshold mode
export const MEDIA_INTERVAL_DURATION_DEFAULT = 30; // seconds per scoring interval
export const MEDIA_MAX_POINTS_DEFAULT = 200; // maximum total points for media intervals
