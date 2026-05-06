export type AccessLogEventType =
  | "page_visit"
  | "login"
  | "logout"
  | "api_failure"
  | "retry_attempt"
  | "course_download"
  | "streaming_session_start"
  | "streaming_page_view"
  | "activity_complete"
  | "activity_update"
  | "quiz_complete"
  | "quiz_start"
  | "quiz_attempt"
  | "resource_download"
  | "media_playback"
  | "playback_start"
  | "playback_stop"
  | "badge_awarded"
  | "course_completed"
  | "settings_update"
  | "settings_reset";

export interface AccessLogUser {
  userId?: string | number | null;
  username?: string | null;
  phoneNumber?: string | null;
}

export interface AccessLogDetails {
  [key: string]: unknown;
}

export interface AccessLogInput {
  event: AccessLogEventType;
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
  user?: AccessLogUser;
  details?: AccessLogDetails;
  timestampUtc?: string;
  offlineSynced?: boolean;
}

/**
 * Extended log entry with all CSV fields
 * Used internally for CSV file writing
 */
export interface AccessLogEntry extends AccessLogInput {}

/**
 * CSV header row - 21 columns in strict order
 */
export const CSV_HEADERS = [
  "timestamp_utc",
  "username",
  "event_type",
  "page_name",
  "activity_type",
  "activity_name",
  "digest",
  "course_id",
  "course_shortname",
  "course_title",
  "points",
  "quiz_score",
  "quiz_maxscore",
  "quiz_passed",
  "quiz_timetaken",
  "media_filename",
  "api_endpoint",
  "api_method",
  "error_code",
  "error_message",
  "offline_synced",
] as const;

export type CSVHeader = (typeof CSV_HEADERS)[number];
