"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuthStore, useGamificationPointsStore } from "@/store/useStore";
import {
  processQuizAttempt as processQuizAttemptFn,
  processActivityCompleted as processActivityCompletedFn,
  processMediaPlayback as processMediaPlaybackFn,
  processCourseDownload as processCourseDownloadFn,
  processResourceDownload as processResourceDownloadFn,
  processFeedback as processFeedbackFn,
} from "@/services/gamificationEngine";
import { getUserPoints } from "@/utils/gamificationIDB";
import { triggerManualSync } from "@/services/gamificationSync";
import type { Course, Activity } from "@/types/gamification";

export function useGamification() {
  const { user } = useAuthStore();
  const { userPoints, userBadges, setPoints } = useGamificationPointsStore();

  // Helper to safely get numeric userId
  const getUserId = useCallback((): number | null => {
    if (!user?.id) return null;
    const parsed =
      typeof user.id === "string" ? parseInt(user.id, 10) : user.id;
    return isNaN(parsed) ? null : parsed;
  }, [user?.id]);

  // Load user points on mount only if not already loaded
  useEffect(() => {
    const userId = getUserId();
    if (userId !== null && userPoints === 0) {
      // Only load if points are 0 (not yet loaded or cleared)
      loadUserPoints(userId);
    }
  }, [getUserId, userPoints]);

  const loadUserPoints = async (userId: number) => {
    const points = await getUserPoints(userId);
    setPoints(points.totalPoints, points.badges);

    // console.log("📊 [useGamification] Loaded user points:", {
    //   points: points.totalPoints,
    //   badges: points.badges,
    // });
  };

  // Helper to refresh points after gamification action
  const refreshPointsAfterAction = async (userId: number) => {
    const points = await getUserPoints(userId);
    setPoints(points.totalPoints, points.badges);
  };

  // Public function to refresh points from external components
  const refreshPoints = useCallback(async () => {
    const userId = getUserId();
    if (userId !== null) {
      await refreshPointsAfterAction(userId);
    }
  }, [getUserId]);

  // Helper to try immediate sync if online
  const tryAutoSubmit = useCallback(
    async (userId: number) => {
      if (user?.username && user?.apiKey && navigator.onLine) {
        await triggerManualSync(userId, user.username, user.apiKey);
      }
    },
    [user?.username, user?.apiKey],
  );

  /**
   * Track quiz attempt
   */
  const trackQuizAttempt = useCallback(
    async (
      course: Course,
      activity: Activity,
      score: number,
      timeTaken: number,
      quizData: {
        maxScore?: number;
        passThreshold?: number; // From quiz props.passthreshold (percentage)
        quizId?: string | number;
        instanceId?: string;
        responses?: Array<{ question_id: number; score: number; text: string }>;
      },
    ) => {
      const userId = getUserId();
      if (userId === null) {
        // console.warn("⚠️ [useGamification] User not initialized");
        return { points: 0, message: "" };
      }

      // console.log("\n🎯 [useGamification] Tracking quiz attempt");

      try {
        // Process quiz attempt - this saves tracker, quiz attempt, and updates points
        const result = await processQuizAttemptFn(
          userId,
          course.id,
          activity.digest,
          score,
          quizData.maxScore || 100,
          course.shortname,
          timeTaken,
          course.version || 1,
          typeof quizData.quizId === "string"
            ? parseInt(quizData.quizId, 10)
            : quizData.quizId,
          quizData.responses || [],
          quizData.passThreshold ?? 80, // Use quiz's passthreshold; default 80%
        );

        // Refresh local points state
        await refreshPointsAfterAction(userId);

        // Auto-submit if online
        tryAutoSubmit(userId);

        return {
          points: result.tracker.points,
          passed: result.tracker.completed,
          message:
            result.tracker.points > 0
              ? `Quiz completed! Earned ${result.tracker.points} points.`
              : "Quiz completed!",
        };
      } catch (error) {
        // console.error("❌ [useGamification] Error tracking quiz:", error);
        return { points: 0, passed: false, message: "Error tracking quiz" };
      }
    },
    [getUserId, tryAutoSubmit],
  );

  /**
   * Track activity completion
   */
  const trackActivityCompleted = useCallback(
    async (
      course: Course,
      activity: Activity,
      timeTaken: number,
      extraData?: Record<string, unknown>,
    ) => {
      const userId = getUserId();
      if (userId === null) {
        return { points: 0, message: "User not initialized" };
      }

      try {
        // Process activity - this saves tracker and updates points
        const result = await processActivityCompletedFn(
          userId,
          course.id,
          activity.digest,
          course.shortname,
          course.version || 1,
          timeTaken,
        );

        // Refresh local points state
        await refreshPointsAfterAction(userId);

        // Auto-submit if online
        tryAutoSubmit(userId);

        return {
          points: result.points,
          message:
            result.points > 0
              ? `Activity completed! Earned ${result.points} points.`
              : "Activity completed!",
        };
      } catch (error) {
        console.error(`[🔴 ERROR] Activity tracking failed`, {
          activity: activity.digest.slice(0, 8),
          error: (error as Error).message,
        });
        return { points: 0, message: "Error tracking activity" };
      }
    },
    [getUserId, tryAutoSubmit, user],
  );

  /**
   * Track media playback (Video or Audio)
   *
   * Video/Audio: 150 points when ≥80% watched/listened, 0 otherwise
   */
  const trackMediaPlayback = useCallback(
    async (
      course: Course,
      activity: Activity,
      mediaFileName: string,
      timeTaken: number,
      mediaLength: number,
      mediaType: "video" | "audio" = "video",
      mediaFileDigest?: string,
    ) => {
      const userId = getUserId();
      if (userId === null) {
        // console.warn("⚠️ [useGamification] User not initialized");
        return { points: 0, message: "" };
      }

      // console.log(`\n🎯 [useGamification] Tracking ${mediaType} playback`);

      try {
        // Process media playback - this saves tracker and updates points
        // Use media FILE digest (from module.xml <file digest="...">) for media_played tracking
        // Fall back to activity digest if file digest not available
        const result = await processMediaPlaybackFn(
          userId,
          course.id,
          mediaFileDigest || activity.digest,
          mediaLength,
          timeTaken,
          mediaType, // Pass media type for threshold tracking
          course.shortname,
          course.version || 1,
          mediaFileName,
        );

        // Refresh local points state
        await refreshPointsAfterAction(userId);

        // Auto-submit if online (syncs tracker to server)
        tryAutoSubmit(userId);

        const mediaLabel = mediaType === "video" ? "Video" : "Audio";
        return {
          points: result.points,
          message:
            result.points > 0
              ? `${mediaLabel} played! Earned ${result.points} points.`
              : `${mediaLabel} played!`,
        };
      } catch (error) {
        // console.error("❌ [useGamification] Error tracking media:", error);
        return { points: 0, message: "Error tracking media" };
      }
    },
    [getUserId, tryAutoSubmit],
  );

  /**
   * Track course download
   */
  const trackCourseDownload = useCallback(
    async (course: Course) => {
      const userId = getUserId();
      if (userId === null) {
        // console.warn("⚠️ [useGamification] User not initialized");
        return { points: 0, message: "" };
      }

      // console.log("\n🎯 [useGamification] Tracking course download");

      try {
        // Process course download - this saves tracker and updates points
        const result = await processCourseDownloadFn(
          userId,
          course.id,
          course.shortname,
          course.version || 1,
        );

        // Refresh local points state
        await refreshPointsAfterAction(userId);

        // Auto-submit if online
        tryAutoSubmit(userId);

        return {
          points: result.points,
          message:
            result.points > 0
              ? `Course downloaded! Earned ${result.points} points.`
              : "Course downloaded!",
        };
      } catch (error) {
        // console.error("❌ [useGamification] Error tracking download:", error);
        return { points: 0, message: "Error tracking download" };
      }
    },
    [getUserId, tryAutoSubmit],
  );

  /**
   * Track resource download
   */
  const trackResourceDownload = useCallback(
    async (course: Course, activity: Activity, resourceName: string) => {
      const userId = getUserId();
      if (userId === null) {
        // console.warn("⚠️ [useGamification] User not initialized");
        return { points: 0, message: "" };
      }

      // console.log("\n🎯 [useGamification] Tracking resource download");

      try {
        // Process resource download - this saves tracker and updates points
        const result = await processResourceDownloadFn(
          userId,
          course.id,
          activity.digest,
          course.shortname,
          course.version || 1,
        );

        if (!result) {
          return { points: 0, message: "Resource already downloaded" };
        }

        // Refresh local points state
        await refreshPointsAfterAction(userId);

        // Auto-submit if online
        tryAutoSubmit(userId);

        return {
          points: result.points,
          message:
            result.points > 0
              ? `Resource downloaded! Earned ${result.points} points.`
              : "Resource downloaded!",
        };
      } catch (error) {
        // console.error("❌ [useGamification] Error tracking resource:", error);
        return { points: 0, message: "Error tracking resource" };
      }
    },
    [getUserId, tryAutoSubmit],
  );

  /**
   * Track feedback submission (50 points)
   */
  const trackFeedback = useCallback(
    async (course: Course, activity: Activity, timeTaken: number = 0) => {
      const userId = getUserId();
      if (userId === null) {
        // console.warn("⚠️ [useGamification] User not initialized");
        return { points: 0, message: "" };
      }

      // console.log("\n🎯 [useGamification] Tracking feedback submission");

      try {
        // Process feedback - this saves tracker and updates points (50 points)
        const result = await processFeedbackFn(
          userId,
          course.id,
          activity.digest,
          course.shortname,
          course.version || 1,
          timeTaken,
        );

        // Refresh local points state
        await refreshPointsAfterAction(userId);

        // Auto-submit if online
        tryAutoSubmit(userId);

        return {
          points: result.points,
          message:
            result.points > 0
              ? `Feedback submitted! Earned ${result.points} points.`
              : "Feedback submitted!",
        };
      } catch (error) {
        // console.error("❌ [useGamification] Error tracking feedback:", error);
        return { points: 0, message: "Error tracking feedback" };
      }
    },
    [getUserId, tryAutoSubmit],
  );

  return {
    trackQuizAttempt,
    trackActivityCompleted,
    trackMediaPlayback,
    trackCourseDownload,
    trackResourceDownload,
    trackFeedback,
    userPoints,
    userBadges,
    refreshPoints,
  };
}
