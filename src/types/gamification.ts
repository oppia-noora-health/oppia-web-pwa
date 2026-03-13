/**
 * OppiaMobile Gamification Types
 * Based on Android app implementation
 * Enhanced for offline-first PWA with background sync
 */

import {
  PAGE_COMPLETED_METHOD_DEFAULT as METHOD_DEFAULT,
  PAGE_COMPLETED_TIME_SPENT_DEFAULT as TIME_DEFAULT,
  PAGE_COMPLETED_WPM_DEFAULT as WPM_DEFAULT,
  MEDIA_COMPLETION_METHOD_DEFAULT as MEDIA_METHOD_DEFAULT,
  MEDIA_THRESHOLD_PERCENTAGE_DEFAULT as MEDIA_THRESHOLD_DEFAULT,
  MEDIA_INTERVAL_DURATION_DEFAULT as MEDIA_INTERVAL_DEFAULT,
  MEDIA_MAX_POINTS_DEFAULT as MEDIA_MAX_DEFAULT,
} from "@/config/constants";

export interface GamificationEvent {
  event: string;
  points: number;
  description?: string;
}

/**
 * Tracker metadata collected with each activity
 * Matches Android app MetaDataUtils
 */
export interface TrackerMetadata {
  uuid: string; // Unique tracker ID (UUID v4)
  lang?: string; // Content language code (e.g., 'en', 'es')
  timetaken: number; // Seconds spent on activity
  readaloud?: boolean; // Text-to-speech was used
  appInstanceId?: string; // App installation UUID
  netconnected?: boolean; // Internet available
  wifion?: boolean; // WiFi connected
  battery?: number | string; // Battery percentage (0-100) or empty string
  network?: string; // Network type (WiFi/Cellular) or empty string
  manufacturermodel?: string; // Device model or empty string
  platform?: string; // 'web'
  app_version?: string; // App version
  // Quiz specific
  quiz_id?: number;
  instance_id?: string;
  score?: number;
  // Media specific
  mediafile?: string;
  media?: string;
  media_end_reached?: boolean;
  // Search specific
  query?: string;
  results_count?: number;
  // Additional custom data
  [key: string]: unknown;
}

/**
 * Quiz response data for quiz attempt submission
 */
export interface QuizResponseData {
  question_id: number;
  score: number;
  text: string;
}

export const GAMIFICATION_EVENTS = {
  // User Registration
  REGISTER: {
    event: "register",
    points: 100,
    description: "User creates an account (one-time)",
  },

  // Quiz Events - First Attempt Ever
  QUIZ_FIRST_ATTEMPT: {
    event: "quiz_first_attempt",
    points: 20,
    description: "Base points for first quiz attempt ever (lifetime once)",
  },
  QUIZ_FIRST_ATTEMPT_THRESHOLD: {
    event: "quiz_first_attempt_threshold",
    points: 99,
    description:
      "Threshold VALUE for bonus check (default 100 = perfect score needed). NOT bonus points.",
  },
  QUIZ_FIRST_BONUS_100: {
    event: "quiz_first_attempt_bonus",
    points: 50,
    description:
      "Bonus points awarded if Math.round(scorePercent) >= threshold on first attempt",
  },

  // Quiz Events - Subsequent Attempts
  QUIZ_FIRST_ATTEMPT_TODAY: {
    event: "quiz_attempt",
    points: 0,
    description:
      "Points for first quiz attempt today (not first ever) — 0 points",
  },
  QUIZ_ATTEMPT: {
    event: "quiz_attempt",
    points: 0,
    description: "Repeat same day - 0 points",
  },

  // Page/Activity Completion
  ACTIVITY_COMPLETED: {
    event: "activity_completed",
    points: 10,
    description: "First completion of activity today (based on time/WPM)",
  },

  // Media Events - Video/Audio Threshold
  MEDIA_THRESHOLD_PASSED: {
    event: "media_threshold_passed",
    points: 150,
    description:
      "Watching/listening ≥80% of media (lifetime once per activity) [LEGACY]",
  },

  // Media Played - uses the media FILE digest (not activity digest)
  MEDIA_PLAYED: {
    event: "media_played",
    points: 150,
    description:
      "Media playback completed ≥80% (once per lifetime per media file, tracked with file digest)",
  },

  // Media Events - Video/Audio Intervals
  MEDIA_STARTED: {
    event: "media_started",
    points: 20,
    description: "Base points for starting media (interval mode, once per day)",
  },
  MEDIA_PLAYING_INTERVAL: {
    event: "media_playing_interval",
    points: 30,
    description: "Interval duration in seconds (default 30s)",
  },
  MEDIA_PLAYING_POINTS_PER_INTERVAL: {
    event: "media_playing_points_per_interval",
    points: 10,
    description:
      "Points per interval within same session (not multiple same day)",
  },
  MEDIA_MAX_POINTS: {
    event: "media_max_points",
    points: 200,
    description: "Maximum points from intervals (20 + 10×intervals)",
  },

  // Other Events
  RESOURCE_DOWNLOADED: {
    event: "resource_downloaded",
    points: 0,
    description: "Downloading a unique resource (DISABLED - 0 points)",
  },
  COURSE_DOWNLOADED: {
    event: "course_downloaded",
    points: 50,
    description: "Downloading a course (multiple times per day allowed)",
  },
  FEEDBACK_COMPLETED: {
    event: "feedback_completed",
    points: 50,
    description: "Completing a feedback form",
  },
  SEARCH_PERFORMED: {
    event: "search_performed",
    points: 0,
    description: "Performing a search (tracked but no points)",
  },
  MEDIA_MISSING: {
    event: "media_missing",
    points: 0,
    description: "Attempting to play missing media (tracked but no points)",
  },
} as const;

export type TrackerType =
  | "login"
  | "download"
  | "page"
  | "media"
  | "quiz"
  | "feedback"
  | ""; // Empty string allowed for backward compatibility, but will be validated in trackerSubmission

export interface Tracker {
  // Core fields
  id: string; // uuid in our DB, maps to 'uuid' in XML
  userId: number;
  courseId: number;

  // Course information (required for API submission)
  courseShortname: string; // course shortname for API
  courseVersion: number; // course version for API

  // Tracker details
  digest: string; // activity/quiz/media digest
  submittedDate: string; // maps to 'submitteddate' in XML (ISO format)
  type: TrackerType;
  event: string;
  points: number;
  completed?: boolean; // For quiz/feedback, maps to 'completed' attribute

  // Tracker metadata (JSON string in XML 'data' attribute)
  data?: TrackerMetadata;

  // Sync status
  synced: boolean;

  // Optional quiz data (if type === "quiz")
  quiz?: QuizData;
}

export interface QuizData {
  score: number;
  maxScore: number; // maps to 'maxscore' in XML
  passed: boolean;
  timetaken: number; // seconds
  course: string; // course shortname
  responses?: QuizResponseData[]; // Quiz responses for API submission
}

export interface QuizAttempt {
  id: string; // uuid
  userId: number;
  courseId: number;
  courseShortname: string; // Added for API submission
  courseVersion: number; // Added for API submission
  quizDigest: string;
  quizId?: number; // Quiz ID from course structure
  instanceId: string; // Unique instance ID for this attempt
  score: number;
  maxScore: number;
  submittedDate: string;
  points: number;
  timetaken: number; // Time taken in seconds
  passed: boolean;
  responses: QuizResponseData[]; // Individual question responses
  synced: boolean;
}

export interface MediaTracker {
  userId: number;
  mediaDigest: string;
  timeViewed: number; // seconds
  event: string;
  points: number;
  lastUpdated: string;
  intervalsCompleted?: number; // number of intervals already scored (interval mode)
}

export interface ActivityMetadata {
  platform: string;
  app_version: string;
  device_id: string;
  network: string;
  user_agent: string;
  timestamp: string;
  battery_level?: number;
  screen_width: number;
  screen_height: number;
}

export interface GamificationConfig {
  // Display Settings
  SHOW_GAMIFICATION_EVENTS: boolean;
  GAMIFICATION_POINTS_ANIMATION: 1 | 2 | 3; // 1=simple, 2=full, 3=full+sound
  DURATION_GAMIFICATION_POINTS_VIEW: number; // seconds

  // Media Completion Criteria
  GAMIFICATION_MEDIA_CRITERIA: "threshold" | "intervals";
  GAMIFICATION_DEFAULT_MEDIA_THRESHOLD: number; // percentage of media for threshold mode
  GAMIFICATION_MEDIA_INTERVAL_DURATION: number; // seconds per scoring interval
  GAMIFICATION_MEDIA_MAX_POINTS: number; // maximum total points for media intervals
  GAMIFICATION_MEDIA_SHOULD_REACH_END: boolean;

  // Page Completion Method
  PAGE_COMPLETED_METHOD: "TIME_SPENT" | "WPM";
  PAGE_COMPLETED_TIME_SPENT: number; // seconds
  PAGE_COMPLETED_WPM: number; // words per minute
  PAGE_COMPLETION_VIEW_FILE: boolean;

  // Resource Settings
  RESOURCE_READ_TIME: number; // minimum seconds

  // Quiz Settings
  QUIZ_DEFAULT_PASS_THRESHOLD: number; // percentage

  // Tracker Settings
  MAX_TRACKER_SUBMIT: number; // trackers per batch
}

export const DEFAULT_GAMIFICATION_CONFIG: GamificationConfig = {
  SHOW_GAMIFICATION_EVENTS: true,
  GAMIFICATION_POINTS_ANIMATION: 3,
  DURATION_GAMIFICATION_POINTS_VIEW: 2,
  GAMIFICATION_MEDIA_CRITERIA: MEDIA_METHOD_DEFAULT,
  GAMIFICATION_DEFAULT_MEDIA_THRESHOLD: MEDIA_THRESHOLD_DEFAULT,
  GAMIFICATION_MEDIA_INTERVAL_DURATION: MEDIA_INTERVAL_DEFAULT,
  GAMIFICATION_MEDIA_MAX_POINTS: MEDIA_MAX_DEFAULT,
  GAMIFICATION_MEDIA_SHOULD_REACH_END: false,
  PAGE_COMPLETED_METHOD: METHOD_DEFAULT,
  PAGE_COMPLETED_TIME_SPENT: TIME_DEFAULT,
  PAGE_COMPLETED_WPM: WPM_DEFAULT,
  PAGE_COMPLETION_VIEW_FILE: true,
  RESOURCE_READ_TIME: 3,
  QUIZ_DEFAULT_PASS_THRESHOLD: 80,
  MAX_TRACKER_SUBMIT: 10,
};

export interface UserPoints {
  userId: number;
  totalPoints: number;
  badges: number;
}

export interface TrackerSubmissionResponse {
  badges: number;
  scoring: boolean;
  badging: boolean;
  metadata?: Record<string, any>;
}

/**
 * TrackerData - Used by useGamification hook for creating trackers
 */
export interface TrackerData {
  uuid: string;
  userId: number;
  courseId: number;
  activityDigest: string;
  type: string;
  event: string;
  points: number;
  completed: boolean;
  data: Record<string, any>;
  datetime: string;
  submitted: boolean;
  exported: boolean;
}

/**
 * QuizAttemptData - Used by useGamification hook for quiz tracking
 */
export interface QuizAttemptData {
  id?: number;
  userId: number;
  courseId: number;
  activityDigest: string;
  type: string;
  quizId: string;
  instanceId: string;
  score: number;
  maxScore: number;
  passed: boolean;
  timetaken: number;
  event: string;
  points: number;
  data: string;
  sent: boolean;
  datetime: string;
}

/**
 * Course interface for gamification tracking
 */
export interface Course {
  id: number;
  shortname: string;
  title?: string;
  version?: number;
}

/**
 * Activity interface for gamification tracking
 */
export interface Activity {
  digest: string;
  title?: string;
  type?: string;
}
