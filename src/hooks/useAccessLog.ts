"use client";

import { useCallback } from "react";
import { useAuthStore } from "@/store/useStore";
import { accessLogService } from "@/services/accessLogService";
import type { AccessLogDetails, AccessLogEventType } from "@/types/accessLog";

interface LogOptions {
  pageName?: string | null;
  activityName?: string | null;
  activityType?: string | null;
  digest?: string | null;
  courseId?: string | number | null;
  courseShortname?: string | null;
  courseTitle?: string | null;
  points?: number | null;
  quizScore?: number | null;
  quizMaxscore?: number | null;
  quizPassed?: boolean | null;
  quizTimetaken?: number | null;
  mediaFilename?: string | null;
  apiEndpoint?: string | null;
  apiMethod?: string | null;
  errorCode?: string | number | null;
  errorMessage?: string | null;
  retryCount?: number | null;
  details?: AccessLogDetails;
  flushNow?: boolean;
}

function normalizeUserId(
  value: string | number | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

export function useAccessLog() {
  const user = useAuthStore((state) => state.user);

  const logEvent = useCallback(
    async (event: AccessLogEventType, options: LogOptions = {}) => {
      await accessLogService.log(
        {
          event,
          user: {
            userId: normalizeUserId(user?.id ?? null),
            username: user?.username ?? null,
            phoneNumber: user?.phoneNumber ?? null,
          },
          pageName: options.pageName ?? null,
          activityName: options.activityName ?? null,
          activityType: options.activityType ?? null,
          digest: options.digest ?? null,
          courseId: options.courseId ?? null,
          courseShortname: options.courseShortname ?? null,
          courseTitle: options.courseTitle ?? null,
          points: options.points ?? null,
          quizScore: options.quizScore ?? null,
          quizMaxscore: options.quizMaxscore ?? null,
          quizPassed: options.quizPassed ?? null,
          quizTimetaken: options.quizTimetaken ?? null,
          mediaFilename: options.mediaFilename ?? null,
          apiEndpoint: options.apiEndpoint ?? null,
          apiMethod: options.apiMethod ?? null,
          errorCode: options.errorCode ?? null,
          errorMessage: options.errorMessage ?? null,
          retryCount: options.retryCount ?? null,
          details: options.details ?? {},
        },
        options.flushNow ?? false,
      );
    },
    [user?.id, user?.phoneNumber, user?.username],
  );

  const logPageVisit = useCallback(
    async (pageName: string, details: AccessLogDetails = {}) => {
      await logEvent("page_visit", {
        pageName,
        activityType: "page",
        details,
      });
    },
    [logEvent],
  );

  const logLogin = useCallback(
    async (details: AccessLogDetails = {}) => {
      await logEvent("login", {
        pageName: "/login",
        activityType: "auth",
        details,
        flushNow: true,
      });
    },
    [logEvent],
  );

  const logLogout = useCallback(
    async (details: AccessLogDetails = {}) => {
      await logEvent("logout", {
        pageName: "/logout",
        activityType: "auth",
        details,
        flushNow: true,
      });
    },
    [logEvent],
  );

  const logApiFailure = useCallback(
    async (options: LogOptions = {}) => {
      await logEvent("api_failure", {
        activityType: options.activityType ?? "api",
        ...options,
      });
    },
    [logEvent],
  );

  const logRetryAttempt = useCallback(
    async (options: LogOptions = {}) => {
      await logEvent("retry_attempt", {
        activityType: options.activityType ?? "retry",
        ...options,
      });
    },
    [logEvent],
  );

  const logActivityComplete = useCallback(
    async (options: LogOptions = {}) => {
      await logEvent("activity_complete", {
        activityType: options.activityType ?? "activity",
        ...options,
      });
    },
    [logEvent],
  );

  const logActivityUpdate = useCallback(
    async (options: LogOptions = {}) => {
      await logEvent("activity_update", {
        activityType: options.activityType ?? "activity",
        ...options,
      });
    },
    [logEvent],
  );

  const logQuizComplete = useCallback(
    async (options: LogOptions = {}) => {
      await logEvent("quiz_complete", {
        activityType: options.activityType ?? "quiz",
        ...options,
      });
    },
    [logEvent],
  );

  const logQuizStart = useCallback(
    async (options: LogOptions = {}) => {
      await logEvent("quiz_start", {
        activityType: options.activityType ?? "quiz",
        ...options,
      });
    },
    [logEvent],
  );

  const logQuizAttempt = useCallback(
    async (options: LogOptions = {}) => {
      await logEvent("quiz_attempt", {
        activityType: options.activityType ?? "quiz",
        ...options,
      });
    },
    [logEvent],
  );

  const logCourseDownload = useCallback(
    async (options: LogOptions = {}) => {
      await logEvent("course_download", {
        activityType: options.activityType ?? "course",
        ...options,
      });
    },
    [logEvent],
  );

  const logStreamingSession = useCallback(
    async (options: LogOptions = {}) => {
      await logEvent("streaming_session_start", {
        activityType: options.activityType ?? "streaming",
        ...options,
      });
    },
    [logEvent],
  );

  const logStreamingPageView = useCallback(
    async (options: LogOptions = {}) => {
      await logEvent("streaming_page_view", {
        activityType: options.activityType ?? "streaming",
        ...options,
      });
    },
    [logEvent],
  );

  const logBadgeAwarded = useCallback(
    async (options: LogOptions = {}) => {
      await logEvent("badge_awarded", {
        activityType: options.activityType ?? "badge",
        ...options,
      });
    },
    [logEvent],
  );

  const logCourseCompleted = useCallback(
    async (options: LogOptions = {}) => {
      await logEvent("course_completed", {
        activityType: options.activityType ?? "course",
        ...options,
      });
    },
    [logEvent],
  );

  const logSettingsUpdate = useCallback(
    async (options: LogOptions = {}) => {
      await logEvent("settings_update", {
        activityType: options.activityType ?? "settings",
        ...options,
      });
    },
    [logEvent],
  );

  const logSettingsReset = useCallback(
    async (options: LogOptions = {}) => {
      await logEvent("settings_reset", {
        activityType: options.activityType ?? "settings",
        ...options,
      });
    },
    [logEvent],
  );

  const logMediaPlayback = useCallback(
    async (options: LogOptions = {}) => {
      await logEvent("media_playback", {
        activityType: options.activityType ?? "media",
        ...options,
      });
    },
    [logEvent],
  );

  const logPlaybackStart = useCallback(
    async (options: LogOptions = {}) => {
      await logEvent("playback_start", {
        activityType: options.activityType ?? "media",
        ...options,
      });
    },
    [logEvent],
  );

  const logPlaybackStop = useCallback(
    async (options: LogOptions = {}) => {
      await logEvent("playback_stop", {
        activityType: options.activityType ?? "media",
        ...options,
      });
    },
    [logEvent],
  );

  const logResourceDownload = useCallback(
    async (options: LogOptions = {}) => {
      await logEvent("resource_download", {
        activityType: options.activityType ?? "resource",
        ...options,
      });
    },
    [logEvent],
  );

  return {
    logEvent,
    logPageVisit,
    logLogin,
    logLogout,
    logApiFailure,
    logRetryAttempt,
    logActivityComplete,
    logActivityUpdate,
    logQuizComplete,
    logQuizStart,
    logQuizAttempt,
    logCourseDownload,
    logStreamingSession,
    logStreamingPageView,
    logBadgeAwarded,
    logCourseCompleted,
    logSettingsUpdate,
    logSettingsReset,
    logMediaPlayback,
    logPlaybackStart,
    logPlaybackStop,
    logResourceDownload,
  };
}
