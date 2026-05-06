/**
 * Log Rotation Service
 * Handles:
 * - Daily log rotation
 * - 30-day retention policy
 * - 100MB size limit pruning
 */

import path from "path";
import fs from "fs/promises";
import {
  extractDateFromLogFilename,
  shouldRetainLog,
  daysBetween,
} from "@/lib/logUtils";
import {
  deleteLogFile,
  getTotalLogSize,
  getLogFiles,
  getLogFileSize,
} from "@/lib/csvLogger";

const RETENTION_DAYS = 30;
const MAX_SIZE_MB = 100;

/**
 * Run cleanup routine
 * - Delete logs older than retention period
 * - Delete logs if total size exceeds limit
 */
export async function runLogCleanup(): Promise<{
  success: boolean;
  deletedCount: number;
  totalSizeMB: number;
  details: string[];
}> {
  const details: string[] = [];
  let deletedCount = 0;

  try {
    // Step 1: Remove logs older than retention period
    const files = await getLogFiles();

    for (const filename of files) {
      const logDate = extractDateFromLogFilename(filename);
      if (!logDate) {
        details.push(`Skipped: unable to parse date from ${filename}`);
        continue;
      }

      const retain = shouldRetainLog(logDate, RETENTION_DAYS);

      if (!retain) {
        const deleted = await deleteLogFile(filename);
        if (deleted) {
          deletedCount++;
          details.push(
            `Deleted old log: ${filename} (${daysBetween(logDate, new Date())} days old)`,
          );
        } else {
          details.push(`Failed to delete: ${filename}`);
        }
      }
    }

    // Step 2: If still over size limit, remove oldest logs
    let totalSizeMB = await getTotalLogSize();
    details.push(`Current total size: ${totalSizeMB.toFixed(2)}MB`);

    if (totalSizeMB > MAX_SIZE_MB) {
      details.push(
        `Total size (${totalSizeMB.toFixed(2)}MB) exceeds limit (${MAX_SIZE_MB}MB)`,
      );

      // Get remaining files sorted by date (oldest first)
      const remainingFiles = await getLogFiles();
      const sortedByDate = remainingFiles
        .map((f) => ({
          filename: f,
          date: extractDateFromLogFilename(f),
        }))
        .filter((f) => f.date !== null)
        .sort((a, b) => (a.date! > b.date! ? 1 : -1)); // oldest first

      // Delete oldest files until under limit
      for (const { filename } of sortedByDate) {
        if (totalSizeMB <= MAX_SIZE_MB) break;

        const fileSizeMB = await getLogFileSize(filename);
        const deleted = await deleteLogFile(filename);

        if (deleted) {
          deletedCount++;
          totalSizeMB -= fileSizeMB;
          details.push(
            `Deleted to reduce size: ${filename} (freed ${fileSizeMB.toFixed(2)}MB)`,
          );
        }
      }

      details.push(`Final total size: ${totalSizeMB.toFixed(2)}MB`);
    }

    return {
      success: true,
      deletedCount,
      totalSizeMB,
      details,
    };
  } catch (error) {
    details.push(`Cleanup error: ${String(error)}`);
    return {
      success: false,
      deletedCount,
      totalSizeMB: 0,
      details,
    };
  }
}

/**
 * Check if cleanup is needed
 */
export async function shouldCleanup(): Promise<boolean> {
  try {
    const totalSizeMB = await getTotalLogSize();

    // Cleanup if over 90MB (before hard limit of 100MB)
    if (totalSizeMB > MAX_SIZE_MB * 0.9) {
      return true;
    }

    // Cleanup if any file is older than retention period
    const files = await getLogFiles();
    for (const filename of files) {
      const logDate = extractDateFromLogFilename(filename);
      if (logDate && !shouldRetainLog(logDate, RETENTION_DAYS)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Error checking cleanup status:", error);
    return false;
  }
}

/**
 * Async cleanup runner - doesn't block request
 * Call this from API after logging entries
 */
let cleanupScheduled = false;

export function scheduleCleanupIfNeeded(): void {
  if (cleanupScheduled) return;

  cleanupScheduled = true;

  // Schedule for next tick to not block current request
  setImmediate(async () => {
    try {
      const needsCleanup = await shouldCleanup();
      if (needsCleanup) {
        const result = await runLogCleanup();
        if (!result.success) {
          console.error("Log cleanup failed:", result.details);
        } else if (result.deletedCount > 0) {
          console.log(`Log cleanup: deleted ${result.deletedCount} files`);
        }
      }
    } catch (error) {
      console.error("Unexpected error in cleanup scheduler:", error);
    } finally {
      cleanupScheduled = false;
    }
  });
}

/**
 * Initialize log directory and perform cleanup on startup
 */
export async function initializeLogRotation(): Promise<void> {
  try {
    const logsDir = path.join(process.cwd(), "logs");

    // Ensure directory exists
    try {
      await fs.access(logsDir);
    } catch {
      await fs.mkdir(logsDir, { recursive: true });
      console.log("Created logs directory:", logsDir);
    }

    // Run cleanup
    const result = await runLogCleanup();
    if (result.deletedCount > 0) {
      console.log(
        `Log rotation initialized: deleted ${result.deletedCount} old files`,
      );
    }
  } catch (error) {
    console.error("Failed to initialize log rotation:", error);
  }
}
