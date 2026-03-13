/**
 * Activity Tracking Service
 * Fetches and manages user's activity completion data
 */

import apiClient from "@/utils/apiClient";
import {
  ActivityTrackingResponse,
  parseActivityTrackingXML,
  ActivityTracker,
} from "@/types/activityTracking";
import { withOfflineFallback } from "@/utils/networkUtils";
import {
  cacheActivityTracking,
  getCachedActivityTracking,
} from "@/utils/offlineStorageIDB";

class ActivityTrackingService {
  /**
   * Get quiz attempts by digest from Activity API
   * Returns all historical attempts for a specific quiz
   * Falls back to local IndexedDB if offline
   */
  async getQuizAttemptsByDigest(
    courseShortname: string,
    quizDigest: string,
  ): Promise<ActivityTracker[]> {
    try {
      const trackingData =
        await this.getCourseActivityTracking(courseShortname);

      // Filter for quiz attempts with matching digest
      const quizAttempts = trackingData.trackers.filter(
        (tracker) => tracker.type === "quiz" && tracker.digest === quizDigest,
      );

      return quizAttempts;
    } catch (error) {
      return [];
    }
  }

  async getCourseActivityTracking(
    shortname: string,
  ): Promise<ActivityTrackingResponse> {
    try {
      const result = await withOfflineFallback(
        // Online action
        async () => {
          const response = await apiClient.get(
            `/course/${shortname}/activity`,
            {
              headers: {
                Accept: "application/xml",
              },
            },
          );

          // Parse XML response
          const xmlString =
            typeof response.data === "string"
              ? response.data
              : new XMLSerializer().serializeToString(response.data);

          const trackingData = parseActivityTrackingXML(xmlString);

          // Cache for offline access
          await cacheActivityTracking(shortname, trackingData);

          return trackingData;
        },
        // Offline fallback
        async () => {
          const cachedData = await getCachedActivityTracking(shortname);
          if (!cachedData) {
            // Return empty instead of throwing
            return { trackers: [] };
          }
          return cachedData;
        },
      );

      return result.data;
    } catch (error) {
      // Return empty response instead of throwing
      return { trackers: [] };
    }
  }

  /**
   * Fetch activity tracking data for multiple courses in parallel
   * @param shortnames Array of course shortnames
   * @returns Combined array of all activity trackers from all courses
   */
  async getAllCoursesActivityTracking(
    shortnames: string[],
  ): Promise<ActivityTracker[]> {
    try {
      // Fetch all courses in parallel
      const promises = shortnames.map((shortname) =>
        this.getCourseActivityTracking(shortname),
      );

      const responses = await Promise.all(promises);

      // Combine all trackers from all courses
      const allTrackers: ActivityTracker[] = [];
      responses.forEach((response) => {
        allTrackers.push(...response.trackers);
      });

      return allTrackers;
    } catch (error) {
      return [];
    }
  }

  /**
   * Filter trackers to only include completed activities
   * @param trackers Array of activity trackers
   * @returns Filtered array with only completed activities
   */
  filterCompletedActivities(trackers: ActivityTracker[]): ActivityTracker[] {
    return trackers.filter((tracker) => tracker.completed === "True");
  }

  /**
   * Create a map of digest -> completion status for easy lookup
   */
  createCompletionMap(
    trackingResponse: ActivityTrackingResponse,
  ): Map<string, boolean> {
    const map = new Map<string, boolean>();

    trackingResponse.trackers.forEach((tracker) => {
      // For regular activities
      if (tracker.type !== "quiz") {
        const isCompleted = tracker.completed === "True";
        map.set(
          tracker.digest,
          (map.get(tracker.digest) ?? false) || isCompleted,
        );
      } else {
        // For quizzes (including pretest), check both completed and passed
        const isCompleted =
          tracker.completed === "True" &&
          (!tracker.quiz || tracker.quiz.passed === "True");
        map.set(
          tracker.digest,
          (map.get(tracker.digest) ?? false) || isCompleted,
        );
      }
    });

    return map;
  }
}

export const activityTrackingService = new ActivityTrackingService();
