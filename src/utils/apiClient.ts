// utils/apiClient.ts

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { useAuthStore } from "@/store/useStore";
import { getApiUrl } from "@/config/constants";
import { getSetting } from "@/utils/settingsStorage";

const getStoredApiUrl = (): string | null => {
  if (typeof window === "undefined") return null;
  return getSetting("custom_api_url", undefined);
};

const getBaseApiUrl = (): string => {
  // Priority: stored custom URL > default (staging)
  const storedUrl = getStoredApiUrl();
  if (storedUrl) return storedUrl;

  // Always use absolute URL from constants (same as localhost)
  return getApiUrl();
};

const BASE_API_URL = getBaseApiUrl();

/**
 * Create an axios instance with default configuration
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_API_URL,
  timeout: 60000, // Increased to 60 seconds for slow networks
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Request interceptor to add authentication parameters
 */
apiClient.interceptors.request.use(
  (config) => {
    // Get auth data from store
    const authState = useAuthStore.getState();
    const { user } = authState;

    // Add username and api_key as query parameters for authenticated requests
    if (user?.username && user?.apiKey) {
      config.params = {
        ...config.params,
        username: user.username,
        api_key: user.apiKey,
      };
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

/**
 * Response interceptor to handle common errors
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    // Handle network errors (offline)
    if (!error.response && error.code === "ERR_NETWORK") {
      error.isOffline = true;
    }

    // Handle 503 from service worker (offline mode)
    if (error.response?.status === 503) {
      error.isOffline = true;
    }

    // Handle 401 Unauthorized - clear auth and redirect to login
    if (error.response?.status === 401 || error.response?.status === 403) {
      const authState = useAuthStore.getState();
      authState.logout();

      // Redirect to login page
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);

/**
 * Helper function to make authenticated GET requests
 */
export const authenticatedGet = async <T = any>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> => {
  const response = await apiClient.get<T>(url, config);
  return response.data;
};

/**
 * Helper function to make authenticated POST requests
 */
export const authenticatedPost = async <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<T> => {
  const response = await apiClient.post<T>(url, data, config);
  return response.data;
};

/**
 * Helper function to make authenticated PUT requests
 */
export const authenticatedPut = async <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<T> => {
  const response = await apiClient.put<T>(url, data, config);
  return response.data;
};

/**
 * Helper function to make authenticated DELETE requests
 */
export const authenticatedDelete = async <T = any>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> => {
  const response = await apiClient.delete<T>(url, config);
  return response.data;
};

/**
 * Build authenticated URL with username and api_key
 * Useful for direct URL access (e.g., download links)
 */
export const buildAuthenticatedUrl = (
  path: string,
  additionalParams?: Record<string, string>,
): string => {
  const authState = useAuthStore.getState();
  const { user } = authState;

  if (!user?.username || !user?.apiKey) {
    throw new Error("User not authenticated");
  }

  // Check if path is already a full URL
  let url: URL;
  try {
    url = new URL(path);
  } catch {
    // Path is relative, construct with base URL
    // Remove leading slash from path if BASE_API_URL ends with slash
    const cleanPath =
      path.startsWith("/") && BASE_API_URL.endsWith("/") ? path.slice(1) : path;
    url = new URL(cleanPath, BASE_API_URL);
  }

  url.searchParams.set("username", user.username);
  url.searchParams.set("api_key", user.apiKey);

  // Add any additional parameters
  if (additionalParams) {
    Object.entries(additionalParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return url.toString();
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  const authState = useAuthStore.getState();
  return !!(
    authState.isAuthenticated &&
    authState.user?.apiKey &&
    authState.user?.username
  );
};

export default apiClient;
