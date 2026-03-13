// hooks/useAuthenticatedApi.ts

import { useCallback } from "react";
import { useAuthStore } from "@/store/useStore";
import {
  authenticatedGet,
  authenticatedPost,
  authenticatedPut,
  authenticatedDelete,
  buildAuthenticatedUrl,
} from "@/utils/apiClient";

/**
 * Custom hook for making authenticated API calls
 * Provides easy access to API methods with automatic authentication
 */
export const useAuthenticatedApi = () => {
  const { user, isAuthenticated } = useAuthStore();

  /**
   * Make an authenticated GET request
   */
  const get = useCallback(
    async <T = any>(url: string, config?: any): Promise<T> => {
      if (!isAuthenticated) {
        throw new Error("User is not authenticated");
      }
      return authenticatedGet<T>(url, config);
    },
    [isAuthenticated]
  );

  /**
   * Make an authenticated POST request
   */
  const post = useCallback(
    async <T = any>(url: string, data?: any, config?: any): Promise<T> => {
      if (!isAuthenticated) {
        throw new Error("User is not authenticated");
      }
      return authenticatedPost<T>(url, data, config);
    },
    [isAuthenticated]
  );

  /**
   * Make an authenticated PUT request
   */
  const put = useCallback(
    async <T = any>(url: string, data?: any, config?: any): Promise<T> => {
      if (!isAuthenticated) {
        throw new Error("User is not authenticated");
      }
      return authenticatedPut<T>(url, data, config);
    },
    [isAuthenticated]
  );

  /**
   * Make an authenticated DELETE request
   */
  const del = useCallback(
    async <T = any>(url: string, config?: any): Promise<T> => {
      if (!isAuthenticated) {
        throw new Error("User is not authenticated");
      }
      return authenticatedDelete<T>(url, config);
    },
    [isAuthenticated]
  );

  /**
   * Build an authenticated URL with query parameters
   */
  const buildUrl = useCallback(
    (path: string, additionalParams?: Record<string, string>): string => {
      if (!isAuthenticated) {
        throw new Error("User is not authenticated");
      }
      return buildAuthenticatedUrl(path, additionalParams);
    },
    [isAuthenticated]
  );

  /**
   * Get authentication headers for manual requests
   */
  const getAuthParams = useCallback(() => {
    if (!user?.username || !user?.apiKey) {
      throw new Error("User is not authenticated");
    }
    return {
      username: user.username,
      api_key: user.apiKey,
    };
  }, [user]);

  return {
    get,
    post,
    put,
    delete: del,
    buildUrl,
    getAuthParams,
    user,
    isAuthenticated,
  };
};
