/**
 * CSV Logger Service
 * Handles writing access logs to daily CSV files with RFC 4180 compliance
 *
 * Files stored in: process.cwd()/logs/access-logs-YYYY-MM-DD.csv
 */

import fs from "fs/promises";
import path from "path";
import type { AccessLogEntry, AccessLogInput } from "@/types/accessLog";
import {
  getLogFilename,
  generateCSVHeader,
  entryToCSVRow,
  formatCSVRow,
  normalizeTimestamp,
} from "@/lib/logUtils";

const WRITE_RETRY_ATTEMPTS = 3;
const WRITE_RETRY_DELAY_MS = 150;

function isLockError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { code?: string }).code;
  return code === "EBUSY" || code === "EPERM" || code === "EACCES";
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeWithRetry(
  writer: () => Promise<void>,
  description: string,
): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= WRITE_RETRY_ATTEMPTS; attempt++) {
    try {
      await writer();
      return;
    } catch (error) {
      lastError = error;
      if (!isLockError(error) || attempt === WRITE_RETRY_ATTEMPTS) {
        throw error;
      }

      await delay(WRITE_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError;
}

/**
 * Initialize logs directory if it doesn't exist
 */
async function ensureLogsDirectory(): Promise<string> {
  const logsDir = path.join(process.cwd(), "logs");

  try {
    await fs.access(logsDir);
  } catch {
    // Directory doesn't exist, create it
    await fs.mkdir(logsDir, { recursive: true });
  }

  return logsDir;
}

/**
 * Get full path to log file for given date
 */
function getLogFilePath(date: Date = new Date()): string {
  const logsDir = path.join(process.cwd(), "logs");
  const filename = getLogFilename(date);
  return path.join(logsDir, filename);
}

/**
 * Check if log file exists and has content
 */
async function logFileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size > 0;
  } catch {
    return false;
  }
}

/**
 * Append entry to log file
 * Creates file with header if doesn't exist
 * Appends CSV row if exists
 */
async function appendToLogFile(
  logPath: string,
  entry: AccessLogEntry,
  details?: Record<string, unknown>,
): Promise<void> {
  const exists = await logFileExists(logPath);

  // Ensure timestamp is set
  const normalizedEntry: AccessLogEntry = {
    ...entry,
    timestampUtc: entry.timestampUtc || normalizeTimestamp(),
  };

  // Generate CSV row (30 columns)
  const rowValues = entryToCSVRow(normalizedEntry, details);
  const rowLine = formatCSVRow(rowValues);

  if (!exists) {
    // Create new file with header + first row
    const header = generateCSVHeader();
    const content = header + "\r\n" + rowLine + "\r\n";
    await writeWithRetry(
      () => fs.writeFile(logPath, content, "utf-8"),
      `write ${logPath}`,
    );
  } else {
    // Append row to existing file
    await writeWithRetry(
      () => fs.appendFile(logPath, rowLine + "\r\n", "utf-8"),
      `append ${logPath}`,
    );
  }
}

/**
 * Main logging function - handles batches of entries
 */
export async function logAccessEntries(entries: AccessLogInput[]): Promise<{
  success: boolean;
  entriesLogged: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let entriesLogged = 0;

  try {
    await ensureLogsDirectory();

    // Group entries by date for daily rotation
    const entriesByDate: Map<string, AccessLogEntry[]> = new Map();

    for (const entry of entries) {
      // Validate entry
      if (!entry.event) {
        errors.push("Skipped entry: missing event_type");
        continue;
      }

      // Normalize timestamp and convert to entry
      const timestamp = normalizeTimestamp(entry.timestampUtc);
      const date = new Date(timestamp);

      const accessEntry: AccessLogEntry = {
        ...entry,
        timestampUtc: timestamp,
        offlineSynced: entry.offlineSynced ?? false,
      };

      // Get date key (YYYY-MM-DD)
      const dateKey = date.toISOString().split("T")[0];

      if (!entriesByDate.has(dateKey)) {
        entriesByDate.set(dateKey, []);
      }
      entriesByDate.get(dateKey)!.push(accessEntry);
    }

    // Write entries grouped by date
    for (const [dateKey, dateEntries] of entriesByDate) {
      const [year, month, day] = dateKey.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      const logPath = getLogFilePath(date);

      for (const entry of dateEntries) {
        try {
          await appendToLogFile(logPath, entry);
          entriesLogged++;
        } catch (error) {
          errors.push(`Failed to log entry at ${logPath}: ${String(error)}`);
        }
      }
    }
  } catch (error) {
    errors.push(`CSV Logger error: ${String(error)}`);
  }

  return {
    success: errors.length === 0,
    entriesLogged,
    errors,
  };
}

/**
 * Read CSV file as string
 */
export async function readLogFile(
  date: Date = new Date(),
): Promise<string | null> {
  const logPath = getLogFilePath(date);

  try {
    const exists = await logFileExists(logPath);
    if (!exists) {
      return null;
    }
    return await fs.readFile(logPath, "utf-8");
  } catch (error) {
    console.error(`Failed to read log file ${logPath}:`, error);
    return null;
  }
}

/**
 * Get all log files in directory
 */
export async function getLogFiles(): Promise<string[]> {
  try {
    const logsDir = await ensureLogsDirectory();
    const files = await fs.readdir(logsDir);
    return files
      .filter((f) => f.startsWith("access-logs-") && f.endsWith(".csv"))
      .sort()
      .reverse(); // newest first
  } catch (error) {
    console.error("Failed to list log files:", error);
    return [];
  }
}

/**
 * Delete specific log file
 */
export async function deleteLogFile(filename: string): Promise<boolean> {
  try {
    const logsDir = path.join(process.cwd(), "logs");
    const filePath = path.join(logsDir, filename);

    // Security: ensure file is in logs directory
    if (!filePath.startsWith(logsDir)) {
      console.error("Invalid file path:", filePath);
      return false;
    }

    await fs.unlink(filePath);
    return true;
  } catch (error) {
    console.error(`Failed to delete log file ${filename}:`, error);
    return false;
  }
}

/**
 * Get total size of all log files in MB
 */
export async function getTotalLogSize(): Promise<number> {
  try {
    const logsDir = await ensureLogsDirectory();
    const files = await fs.readdir(logsDir);

    let totalBytes = 0;

    for (const file of files) {
      if (file.startsWith("access-logs-") && file.endsWith(".csv")) {
        try {
          const filePath = path.join(logsDir, file);
          const stats = await fs.stat(filePath);
          totalBytes += stats.size;
        } catch {
          // Skip files that can't be stat'd
        }
      }
    }

    return totalBytes / (1024 * 1024); // Convert to MB
  } catch (error) {
    console.error("Failed to calculate total log size:", error);
    return 0;
  }
}

/**
 * Get specific log file size in MB
 */
export async function getLogFileSize(filename: string): Promise<number> {
  try {
    const logsDir = path.join(process.cwd(), "logs");
    const filePath = path.join(logsDir, filename);

    // Security check
    if (!filePath.startsWith(logsDir)) {
      return 0;
    }

    const stats = await fs.stat(filePath);
    return stats.size / (1024 * 1024);
  } catch {
    return 0;
  }
}

/**
 * Export logs for date range as CSV string
 */
export async function exportLogsForDateRange(
  startDate: Date,
  endDate: Date,
): Promise<string> {
  const lines: string[] = [];

  // Add header once
  lines.push(generateCSVHeader());

  // Iterate through each date in range
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const csv = await readLogFile(currentDate);
    if (csv) {
      // Skip header in each file, take only data rows
      const rows = csv
        .split("\n")
        .slice(1)
        .filter((r) => r.trim());
      lines.push(...rows);
    }

    // Move to next day
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return lines.join("\r\n");
}

/**
 * Get statistics about log files
 */
export async function getLogStatistics(): Promise<{
  totalFiles: number;
  totalSizeMB: number;
  oldestLog: string | null;
  newestLog: string | null;
  totalEntries: number;
}> {
  try {
    const files = await getLogFiles();
    const totalSizeMB = await getTotalLogSize();

    let totalEntries = 0;

    for (const file of files) {
      const csv = await readLogFile(
        new Date(file.match(/(\d{4})-(\d{2})-(\d{2})/)![0]),
      );
      if (csv) {
        // Count lines minus header
        const lineCount = csv.split("\n").filter((l) => l.trim()).length - 1;
        totalEntries += lineCount;
      }
    }

    return {
      totalFiles: files.length,
      totalSizeMB,
      oldestLog: files[files.length - 1] || null,
      newestLog: files[0] || null,
      totalEntries,
    };
  } catch (error) {
    console.error("Failed to get log statistics:", error);
    return {
      totalFiles: 0,
      totalSizeMB: 0,
      oldestLog: null,
      newestLog: null,
      totalEntries: 0,
    };
  }
}
