/**
 * Utility functions for access logging
 * Handles CSV formatting, validation, sanitization, and timestamp generation
 */

import type { AccessLogEntry, AccessLogInput } from "@/types/accessLog";
import crypto from "crypto";

/**
 * Generate UTC ISO-8601 timestamp (e.g., 2026-05-06T14:32:15.123Z)
 */
export function getUTCTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Parse ISO timestamp or return current time if invalid
 */
export function normalizeTimestamp(ts?: string | null): string {
  if (ts) {
    const parsed = new Date(ts);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return getUTCTimestamp();
}

/**
 * Escape CSV string value per RFC 4180:
 * - Wrap in quotes if contains comma, quote, or newline
 * - Escape internal quotes as double quotes
 */
export function escapeCSVValue(
  value: string | number | boolean | null | undefined,
): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  // Check if escaping needed
  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    // Escape quotes by doubling them, then wrap in quotes
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Escape JSON for CSV details column
 * Converts object to JSON string, then escapes for CSV
 */
export function escapeDetailsJSON(
  details?: Record<string, unknown> | null,
): string {
  if (!details || Object.keys(details).length === 0) {
    return "";
  }

  try {
    const jsonStr = JSON.stringify(details);
    return escapeCSVValue(jsonStr);
  } catch (error) {
    return "";
  }
}

/**
 * Sanitize input string to prevent CSV injection
 * Remove or escape special characters that could break CSV parsing
 */
export function sanitizeCSVInput(value: string | null | undefined): string {
  if (!value) return "";

  // Remove formula injection characters
  const sanitized = value.replace(/^[=+@-]/, "");

  // Remove null bytes and control characters
  return sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, "");
}

/**
 * Calculate MD5 digest for content (used for activity/quiz identification)
 */
export function calculateDigest(content: string): string {
  return crypto.createHash("md5").update(content).digest("hex");
}

/**
 * Generate UUID v4 for batch and session IDs
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Normalize phone number (remove formatting, keep digits only for storage)
 */
export function normalizePhoneNumber(phone?: string | null): string | null {
  if (!phone) return null;

  // Keep original format from API (e.g., "+919999999999")
  // Don't manipulate - just sanitize
  return sanitizeCSVInput(phone) || null;
}

/**
 * Normalize user ID (convert to string, handle null)
 */
export function normalizeUserId(
  userId?: string | number | null,
): string | null {
  if (userId === null || userId === undefined) return null;
  return String(userId);
}

/**
 * Normalize numeric fields (allow null, convert string numbers)
 */
export function normalizeNumber(value?: string | number | null): number | null {
  if (value === null || value === undefined) return null;

  const num = typeof value === "string" ? parseFloat(value) : value;
  return isNaN(num) ? null : num;
}

/**
 * Normalize boolean fields
 */
export function normalizeBoolean(
  value?: string | boolean | null,
): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  return value.toLowerCase() === "true";
}

/**
 * Validate required fields in AccessLogInput
 * Returns { isValid: boolean, errors: string[] }
 */
export function validateAccessLogEntry(entry: AccessLogInput): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!entry.event) {
    errors.push("event_type is required");
  }

  if (!entry.user?.username) {
    errors.push("username is required");
  }

  if (entry.event.includes("quiz") && !entry.details?.quiz_score) {
    // Quiz events should have score in details, but don't hard-fail
    // (quiz_start doesn't have score)
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Convert AccessLogInput to AccessLogEntry with all 30 CSV columns
 */
export function convertToAccessLogEntry(input: AccessLogInput): AccessLogEntry {
  return {
    ...input,
    timestampUtc: normalizeTimestamp(input.timestampUtc),
    courseId: input.courseId ?? null,
    points: normalizeNumber(input.points),
    offlineSynced: input.offlineSynced ?? false,
  };
}

/**
 * Convert AccessLogEntry to CSV row array (30 values)
 * Order matches CSV_HEADERS constant
 */
export function entryToCSVRow(
  entry: AccessLogEntry,
  details: AccessLogDetails = {},
): string[] {
  return [
    entry.timestampUtc || getUTCTimestamp(), // timestamp_utc
    sanitizeCSVInput(entry.user?.username || ""), // username
    entry.event || "", // event_type
    sanitizeCSVInput(entry.pageName || ""), // page_name
    sanitizeCSVInput(entry.activityType || ""), // activity_type
    sanitizeCSVInput(entry.activityName || ""), // activity_name
    sanitizeCSVInput(entry.digest || ""), // digest
    String(entry.courseId || ""), // course_id
    sanitizeCSVInput(entry.courseShortname || ""), // course_shortname
    sanitizeCSVInput(entry.courseTitle || ""), // course_title
    String(entry.points ?? ""), // points
    String(entry.quizScore ?? ""), // quiz_score
    String(entry.quizMaxscore ?? ""), // quiz_maxscore
    String(entry.quizPassed ?? ""), // quiz_passed
    String(entry.quizTimetaken ?? ""), // quiz_timetaken
    sanitizeCSVInput(entry.mediaFilename || ""), // media_filename
    sanitizeCSVInput(entry.apiEndpoint || ""), // api_endpoint
    entry.apiMethod || "", // api_method
    String(entry.errorCode ?? ""), // error_code
    sanitizeCSVInput(entry.errorMessage || ""), // error_message
    String(entry.offlineSynced ? "true" : "false"), // offline_synced
  ];
}

/**
 * Format CSV row with proper escaping
 */
export function formatCSVRow(values: string[]): string {
  return values.map((v) => escapeCSVValue(v)).join(",");
}

/**
 * Generate CSV header row
 */
export function generateCSVHeader(): string {
  const headers = [
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
  ];

  return formatCSVRow(headers);
}

/**
 * Get log filename for given date
 * Format: access-logs-2026-05-06.csv
 */
export function getLogFilename(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `access-logs-${year}-${month}-${day}.csv`;
}

/**
 * Extract date from log filename
 * Parse: access-logs-2026-05-06.csv → Date object
 */
export function extractDateFromLogFilename(filename: string): Date | null {
  const match = filename.match(/access-logs-(\d{4})-(\d{2})-(\d{2})\.csv/);
  if (!match) return null;

  const [, year, month, day] = match;
  return new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
}

/**
 * Calculate days between two dates (UTC)
 */
export function daysBetween(date1: Date, date2: Date): number {
  const ms = Math.abs(date1.getTime() - date2.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * Check if log should be retained based on date
 * Keep logs from last N days
 */
export function shouldRetainLog(
  logDate: Date,
  retentionDays: number = 30,
  referenceDate: Date = new Date(),
): boolean {
  return daysBetween(logDate, referenceDate) <= retentionDays;
}
