// utils/persistenceErrorHandler.ts
// Error handling and retry logic for offline data persistence

import { accessLogService } from "@/services/accessLogService";
import { useAuthStore } from "@/store/useStore";

export interface PersistenceResult {
  success: boolean;
  error?: string;
  retries: number;
  timestamp: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 100; // Exponential: 100ms, 200ms, 400ms

function logRetryAttempt(
  operationName: string,
  attempt: number,
  maxRetries: number,
  outcome: "retrying" | "success" | "failed",
  error?: unknown,
) {
  if (typeof window === "undefined") {
    return;
  }

  const user = useAuthStore.getState().user;
  void accessLogService.log({
    event: "retry_attempt",
    activityType: "retry",
    activityName: operationName,
    pageName: "/offline",
    user: {
      userId: user?.id ?? null,
      username: user?.username ?? null,
      phoneNumber: user?.phoneNumber ?? null,
    },
    details: {
      operationName,
      attempt,
      maxRetries,
      outcome,
      errorMessage:
        error instanceof Error ? error.message : String(error ?? ""),
    },
  });
}

/**
 * Executes a persistence operation with retry logic
 *
 * Usage:
 * const result = await executeWithRetry(
 *   () => setCompletionData(courseId, map),
 *   'setCompletionData'
 * );
 */
export async function executeWithRetry(
  operation: () => void,
  operationName: string,
  maxRetries: number = MAX_RETRIES,
): Promise<PersistenceResult> {
  let lastError: unknown = null;
  let retryCount = 0;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      operation();

      if (retryCount > 0) {
        logRetryAttempt(operationName, attempt, maxRetries, "success");
      }

      return {
        success: true,
        retries: attempt - 1,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      lastError = error;
      retryCount = attempt - 1;

      logRetryAttempt(operationName, attempt, maxRetries, "retrying", error);

      if (attempt <= maxRetries) {
        if (typeof window !== "undefined") {
          const delayMs = 100 * Math.pow(2, attempt - 2); // Exponential backoff
          console.warn(
            `[OFFLINE_TRACKER] ${operationName} failed (attempt ${attempt}/${maxRetries}). Retrying in ${delayMs}ms...`,
            error,
          );
        }

        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, 100 * Math.pow(2, attempt - 2)),
        );
      } else {
        if (typeof window !== "undefined") {
          console.error(
            `[OFFLINE_TRACKER] ${operationName} failed after ${maxRetries + 1} attempts`,
            error,
          );
        }

        logRetryAttempt(operationName, attempt, maxRetries, "failed", error);
      }
    }
  }

  return {
    success: false,
    error: lastError instanceof Error ? lastError.message : String(lastError),
    retries: retryCount,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validates that data was actually persisted to localStorage
 *
 * Returns true if data found in localStorage matching expected structure
 */
export function validatePersistence(
  storageKey: string,
  expectedCourseId: string,
): boolean {
  try {
    if (typeof window === "undefined" || !localStorage) {
      return false;
    }

    const data = localStorage.getItem(storageKey);
    if (!data) {
      return false;
    }

    const parsed = JSON.parse(data);
    const courseData = parsed[expectedCourseId];

    if (typeof window !== "undefined" && !courseData) {
      console.warn(
        `[OFFLINE_TRACKER] Persistence validation failed - Course ${expectedCourseId} not found in localStorage`,
        { storageKey, availableKeys: Object.keys(parsed) },
      );
    }

    return !!courseData;
  } catch (error) {
    if (typeof window !== "undefined") {
      console.error("[OFFLINE_TRACKER] Persistence validation error", error);
    }
    return false;
  }
}

/**
 * Detects race conditions in rapid persistence calls
 * Returns timing information to identify concurrent writes
 */
export class PersistenceRaceDetector {
  private callStack: Array<{
    name: string;
    timestamp: number;
    duration?: number;
  }> = [];

  logCall(operationName: string): void {
    const now = Date.now();
    this.callStack.push({
      name: operationName,
      timestamp: now,
    });

    // Keep only last 20 calls
    this.callStack = this.callStack.slice(-20);
  }

  logComplete(operationName: string): void {
    const now = Date.now();
    const call = this.callStack.find(
      (c) => c.name === operationName && !c.duration,
    );
    if (call) {
      call.duration = now - call.timestamp;
    }
  }

  detectRaceCondition(): { detected: boolean; info: string } {
    if (this.callStack.length < 2) {
      return { detected: false, info: "" };
    }

    const last = this.callStack[this.callStack.length - 1];
    const secondLast = this.callStack[this.callStack.length - 2];

    // Race condition if: second-to-last call hasn't completed before new call starts
    if (
      secondLast.duration === undefined &&
      last.timestamp - secondLast.timestamp < 50
    ) {
      return {
        detected: true,
        info: `Race detected: ${secondLast.name} (started ${last.timestamp - secondLast.timestamp}ms ago) not yet complete when ${last.name} started`,
      };
    }

    return { detected: false, info: "" };
  }

  getReport(): string {
    const raceCheck = this.detectRaceCondition();
    let report = "[OFFLINE_TRACKER] Persistence call sequence:\n";

    this.callStack.forEach((call, idx) => {
      const duration = call.duration ? `${call.duration}ms` : "PENDING";
      report += `  ${idx + 1}. ${call.name} → ${duration}\n`;
    });

    if (raceCheck.detected) {
      report += `\n⚠️  RACE CONDITION: ${raceCheck.info}`;
    }

    return report;
  }
}

// Global instance for tracking
export const raceDetector = new PersistenceRaceDetector();
