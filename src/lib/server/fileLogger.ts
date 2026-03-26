import { mkdir, appendFile } from "fs/promises";
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

const LOG_ROOT = path.join(process.cwd(), "logs");
const USER_LOG_DIR = path.join(LOG_ROOT, "users");

function sanitizeFilePart(value: string | null | undefined): string {
  if (!value) {
    return "anonymous";
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100) || "anonymous";
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
