import { mkdir, appendFile, access, readFile } from "fs/promises";
import path from "path";

export interface LogEntry {
  timestamp?: string;
  level?: "error" | "warn" | "info";
  event: string;
  userId?: string | null;
  username?: string | null;
  context?: Record<string, unknown>;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
    cause?: unknown;
    details?: unknown;
  };
}

export interface AccessLogEntry {
  timestampUtc?: string;
  event: string;
  userId?: string | null;
  username?: string | null;
  phoneNumber?: string | null;
  pageName?: string | null;
  activityName?: string | null;
  activityType?: string | null;
  digest?: string | null;
  courseId?: string | number | null;
  courseShortname?: string | null;
  courseTitle?: string | null;
  points?: number | null;
  details?: Record<string, unknown>;
}

const LOG_ROOT = path.join(process.cwd(), "logs");
const USER_LOG_DIR = path.join(LOG_ROOT, "users");
const ACCESS_LOG_DIR = path.join(LOG_ROOT, "access");
const ACCESS_LOG_HEADER = [
  "Timestamp UTC",
  "Event",
  "User ID",
  "Username",
  "Phone Number",
  "Page Name",
  "Activity Name",
  "Activity Type",
  "Digest",
  "Course ID",
  "Course Shortname",
  "Course Title",
  "Points",
  "Details (JSON)",
].join(",");

function sanitizeFilePart(value: string | null | undefined): string {
  if (!value) {
    return "anonymous";
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100) || "anonymous";
}

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = typeof value === "string" ? value : JSON.stringify(value);
  const normalized = text.replace(/\r?\n/g, " ");

  if (/[",]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

async function ensureCsvHeader(filePath: string): Promise<void> {
  try {
    await access(filePath);
    const existing = await readFile(filePath, "utf8");
    if (existing.trim().length > 0) {
      return;
    }
  } catch {
    // File does not exist yet.
  }

  await appendFile(filePath, `${ACCESS_LOG_HEADER}\n`, "utf8");
}

export async function appendUserLog(entry: LogEntry): Promise<string> {
  const safeUserId = sanitizeFilePart(entry.userId);
  const safeUsername = sanitizeFilePart(entry.username);
  const fileName =
    safeUserId !== "anonymous"
      ? `${safeUserId}.log`
      : `${safeUsername || "anonymous"}.log`;
  const filePath = path.join(USER_LOG_DIR, fileName);

  await mkdir(USER_LOG_DIR, { recursive: true });

  const record = {
    timestamp: entry.timestamp ?? new Date().toISOString(),
    level: entry.level ?? "error",
    event: entry.event,
    userId: entry.userId ?? null,
    username: entry.username ?? null,
    context: entry.context ?? {},
    error: entry.error ?? null,
  };

  await appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");

  return filePath;
}

function getUtcAccessLogFilePath(timestamp = new Date()): string {
  const dateKey = timestamp.toISOString().slice(0, 10);
  return path.join(ACCESS_LOG_DIR, `access-${dateKey}.csv`);
}

export async function appendAccessLog(entry: AccessLogEntry): Promise<string> {
  const filePath = getUtcAccessLogFilePath();

  await mkdir(ACCESS_LOG_DIR, { recursive: true });
  await ensureCsvHeader(filePath);

  const row = [
    escapeCsvValue(entry.timestampUtc ?? new Date().toISOString()),
    escapeCsvValue(entry.event),
    escapeCsvValue(entry.userId ?? null),
    escapeCsvValue(entry.username ?? null),
    escapeCsvValue(entry.phoneNumber ?? null),
    escapeCsvValue(entry.pageName ?? null),
    escapeCsvValue(entry.activityName ?? null),
    escapeCsvValue(entry.activityType ?? null),
    escapeCsvValue(entry.digest ?? null),
    escapeCsvValue(entry.courseId ?? null),
    escapeCsvValue(entry.courseShortname ?? null),
    escapeCsvValue(entry.courseTitle ?? null),
    escapeCsvValue(entry.points ?? null),
    escapeCsvValue(entry.details ?? {}),
  ].join(",");

  await appendFile(filePath, `${row}\n`, "utf8");

  return filePath;
}
