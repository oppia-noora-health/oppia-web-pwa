// utils/authDebug.ts

/**
 * Debugging utilities for authentication
 * Use these in development to verify auth state
 */

import { useAuthStore } from "@/store/useStore";
import { getApiUrl } from "@/config/constants";

/**
 * Log current authentication status to console
 */
export const debugAuthStatus = () => {
  const state = useAuthStore.getState();

  console.group("🔐 Authentication Debug Info");
  console.groupEnd();
};

/**
 * Get current auth parameters for debugging
 */
export const getAuthParams = (): {
  username: string;
  api_key: string;
} | null => {
  const state = useAuthStore.getState();

  if (!state.user?.username || !state.user?.apiKey) {
    return null;
  }

  return {
    username: state.user.username,
    api_key: state.user.apiKey,
  };
};

/**
 * Build a test URL with current auth
 */
export const buildTestUrl = (endpoint: string): string | null => {
  const params = getAuthParams();

  if (!params) {
    return null;
  }

  const baseUrl = getApiUrl();

  const url = new URL(endpoint, baseUrl);
  url.searchParams.set("username", params.username);
  url.searchParams.set("api_key", params.api_key);

  return url.toString();
};

/**
 * Test authentication by making a simple API call
 */
export const testAuth = async (): Promise<boolean> => {
  const params = getAuthParams();

  if (!params) {
    return false;
  }

  try {
    const testUrl = buildTestUrl("/course/");
    if (!testUrl) return false;

    const response = await fetch(testUrl);

    if (response.ok) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
};

/**
 * Clear all authentication data (for testing)
 */
export const clearAuth = () => {
  const { logout } = useAuthStore.getState();
  logout();
  // console.log("🔓 Authentication data cleared");
};

// Development-only exports
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  // @ts-ignore - Adding to window for debugging
  window.authDebug = {
    status: debugAuthStatus,
    params: getAuthParams,
    buildUrl: buildTestUrl,
    test: testAuth,
    clear: clearAuth,
  };

  // console.log(
  //   "💡 Auth debug tools available:\n" +
  //     "  - authDebug.status() - Show current auth state\n" +
  //     "  - authDebug.params() - Get auth parameters\n" +
  //     "  - authDebug.buildUrl('/endpoint/') - Build test URL\n" +
  //     "  - authDebug.test() - Test authentication\n" +
  //     "  - authDebug.clear() - Clear all auth data"
  // );
}
