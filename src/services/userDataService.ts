// services/userDataService.ts

import { authenticatedGet, buildAuthenticatedUrl } from "@/utils/apiClient";
import { API_PATHS } from "@/utils/apiPaths";
import { withOfflineFallback } from "@/utils/networkUtils";
import {
  cacheUserProfile,
  getCachedUserProfile,
} from "@/utils/offlineStorageIDB";

export interface UserDownloadData {
  // Define the structure based on actual API response
  [key: string]: any;
}

export const getUserDownloadData = async (): Promise<UserDownloadData> => {
  try {
    const data = await authenticatedGet<UserDownloadData>(
      API_PATHS.DOWNLOAD_ACCOUNT_DATA,
    );
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Get the authenticated download URL
 * Useful for direct downloads or external links
 */
export const getDownloadDataUrl = (): string => {
  return buildAuthenticatedUrl(API_PATHS.DOWNLOAD_ACCOUNT_DATA);
};

/**
 * Get user profile information (network-aware with offline fallback)
 */
export const getUserProfile = async (userId?: number) => {
  try {
    const result = await withOfflineFallback(
      // Online action
      async () => {
        const profile = await authenticatedGet(API_PATHS.USER_PROFILE);
        // Cache the profile for offline access
        if (userId) {
          await cacheUserProfile(userId, profile);
        }
        return profile;
      },
      // Offline fallback
      async () => {
        if (!userId) {
          throw new Error("User ID required for offline access");
        }
        const cachedProfile = await getCachedUserProfile(userId);
        if (!cachedProfile) {
          throw new Error("No cached profile available offline");
        }
        return cachedProfile;
      },
    );

    return result.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Get leaderboard data
 */
export const getLeaderboard = async () => {
  try {
    const leaderboard = await authenticatedGet(API_PATHS.LEADERBOARD);
    return leaderboard;
  } catch (error) {
    throw error;
  }
};

/**
 * Get user cohorts
 */
export const getUserCohorts = async () => {
  try {
    const cohorts = await authenticatedGet(API_PATHS.USER_COHORTS);
    return cohorts;
  } catch (error) {
    throw error;
  }
};

/**
 * Get server info
 */
export const getServerInfo = async () => {
  try {
    const info = await authenticatedGet(API_PATHS.SERVER_INFO);
    return info;
  } catch (error) {
    throw error;
  }
};
