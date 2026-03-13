/**
 * IndexedDB Storage for Gamification & Tracking
 * Handles offline storage and syncing of trackers, quiz attempts, and user points
 * Enhanced to support full offline-first tracking with background sync
 */

import { openDB, DBSchema, IDBPDatabase } from "idb";
import type {
  Tracker,
  QuizAttempt,
  UserPoints,
  MediaTracker,
} from "@/types/gamification";

interface GamificationDB extends DBSchema {
  trackers: {
    key: string; // id (uuid)
    value: Tracker;
    indexes: {
      "by-user": number;
      "by-synced": number;
      "by-digest": string;
      "by-date": string;
      "by-course": number;
    };
  };
  quizAttempts: {
    key: string; // id (uuid)
    value: QuizAttempt;
    indexes: {
      "by-user": number;
      "by-synced": number;
      "by-user-quiz": [number, string];
      "by-course": number;
    };
  };
  mediaTrackers: {
    key: [number, string]; // [userId, mediaDigest]
    value: MediaTracker;
    indexes: {
      "by-user": number;
    };
  };
  resourceDownloads: {
    key: [number, string]; // [userId, resourceDigest]
    value: {
      userId: number;
      resourceDigest: string;
      downloadedAt: string;
    };
  };
  userPoints: {
    key: number; // userId
    value: UserPoints;
  };
}

const DB_NAME = "NooraHealthGamification";
const DB_VERSION = 3; // Incremented for schema changes (added course indexes)

let dbInstance: IDBPDatabase<GamificationDB> | null = null;

export async function openGamificationDB(): Promise<
  IDBPDatabase<GamificationDB>
> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<GamificationDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion) {
      // Trackers store
      if (!db.objectStoreNames.contains("trackers")) {
        const trackerStore = db.createObjectStore("trackers", {
          keyPath: "id",
        });
        trackerStore.createIndex("by-user", "userId");
        trackerStore.createIndex("by-synced", "synced");
        trackerStore.createIndex("by-digest", "digest");
        trackerStore.createIndex("by-date", "submittedDate");
        trackerStore.createIndex("by-course", "courseId");
      } else if (oldVersion < 3) {
        // Add course index if upgrading from older version
        const tx = db.transaction as any;
        if (tx && tx.objectStore) {
          try {
            const store = tx.objectStore("trackers");
            if (!store.indexNames.contains("by-course")) {
              store.createIndex("by-course", "courseId");
            }
          } catch (e) {}
        }
      }

      // Quiz attempts store
      if (!db.objectStoreNames.contains("quizAttempts")) {
        const quizStore = db.createObjectStore("quizAttempts", {
          keyPath: "id",
        });
        quizStore.createIndex("by-user", "userId");
        quizStore.createIndex("by-synced", "synced");
        quizStore.createIndex("by-user-quiz", ["userId", "quizDigest"]);
        quizStore.createIndex("by-course", "courseId");
      } else if (oldVersion < 3) {
        // Add course index if upgrading from older version
        const tx = db.transaction as any;
        if (tx && tx.objectStore) {
          try {
            const store = tx.objectStore("quizAttempts");
            if (!store.indexNames.contains("by-course")) {
              store.createIndex("by-course", "courseId");
            }
          } catch (e) {}
        }
      }

      // Media trackers store
      if (!db.objectStoreNames.contains("mediaTrackers")) {
        const mediaStore = db.createObjectStore("mediaTrackers", {
          keyPath: ["userId", "mediaDigest"],
        });
        mediaStore.createIndex("by-user", "userId");
      }

      // Resource downloads store
      if (!db.objectStoreNames.contains("resourceDownloads")) {
        db.createObjectStore("resourceDownloads", {
          keyPath: ["userId", "resourceDigest"],
        });
      }

      // User points store
      if (!db.objectStoreNames.contains("userPoints")) {
        db.createObjectStore("userPoints", { keyPath: "userId" });
      }
    },
  });

  return dbInstance;
}

// ==================== TRACKER OPERATIONS ====================

export async function saveTracker(tracker: Tracker): Promise<void> {
  // console.log("💾 [GamificationIDB] Saving tracker:", {
  //   id: tracker.id,
  //   event: tracker.event,
  //   points: tracker.points,
  //   type: tracker.type,
  // });

  const db = await openGamificationDB();
  await db.put("trackers", tracker);

  // console.log("✅ [GamificationIDB] Tracker saved successfully");
}

export async function getUnsubmittedTrackers(
  userId: number,
): Promise<Tracker[]> {
  const db = await openGamificationDB();
  const allTrackers = await db.getAllFromIndex("trackers", "by-user", userId);
  const unsynced = allTrackers.filter((t) => !t.synced);

  if (unsynced.length > 0) {
    unsynced.forEach((t, i) => {});
  }

  return unsynced;
}

export async function markTrackersAsSubmitted(ids: string[]): Promise<void> {
  // console.log("✔️ [GamificationIDB] Marking trackers as synced:", ids);

  const db = await openGamificationDB();
  const tx = db.transaction("trackers", "readwrite");

  await Promise.all(
    ids.map(async (id) => {
      const tracker = await tx.store.get(id);
      if (tracker) {
        tracker.synced = true;
        await tx.store.put(tracker);
      }
    }),
  );

  await tx.done;
  // console.log("✅ [GamificationIDB] Trackers marked as synced");
}

// ==================== QUIZ OPERATIONS ====================

export async function isQuizFirstAttempt(
  userId: number,
  quizDigest: string,
): Promise<boolean> {
  const db = await openGamificationDB();
  const attempts = await db.getAllFromIndex("quizAttempts", "by-user-quiz", [
    userId,
    quizDigest,
  ]);

  const isFirst = attempts.length === 0;

  // console.log("🔍 [GamificationIDB] First quiz attempt check:", {
  //   userId,
  //   quizDigest,
  //   isFirst,
  //   existingAttempts: attempts.length,
  // });

  return isFirst;
}

/**
 * Check if this is the first quiz attempt TODAY (but not necessarily first ever)
 */
export async function isQuizFirstAttemptToday(
  userId: number,
  quizDigest: string,
): Promise<boolean> {
  const db = await openGamificationDB();
  const attempts = await db.getAllFromIndex("quizAttempts", "by-user-quiz", [
    userId,
    quizDigest,
  ]);

  const today = new Date().toDateString();
  const todayAttempts = attempts.filter((attempt) => {
    const attemptDate = new Date(attempt.submittedDate).toDateString();
    return attemptDate === today;
  });

  const isFirstToday = todayAttempts.length === 0;

  // console.log("🔍 [GamificationIDB] First quiz attempt today check:", {
  //   userId,
  //   quizDigest,
  //   isFirstToday,
  //   todayAttempts: todayAttempts.length,
  //   totalAttempts: attempts.length,
  // });

  return isFirstToday;
}

export async function getQuizAttempts(): Promise<QuizAttempt[]> {
  const db = await openGamificationDB();
  return await db.getAll("quizAttempts");
}

/**
 * Get quiz attempts by user and digest (for showing attempt history)
 */
export async function getQuizAttemptsByDigest(
  userId: number,
  quizDigest: string,
): Promise<QuizAttempt[]> {
  const db = await openGamificationDB();
  const attempts = await db.getAllFromIndex("quizAttempts", "by-user-quiz", [
    userId,
    quizDigest,
  ]);

  // Sort by date (newest first)
  attempts.sort(
    (a, b) =>
      new Date(b.submittedDate).getTime() - new Date(a.submittedDate).getTime(),
  );

  return attempts;
}

/**
 * Get all unsubmitted quiz attempts for a user
 * Used by background sync to submit pending quiz attempts
 */
export async function getUnsubmittedQuizAttempts(
  userId: number,
): Promise<QuizAttempt[]> {
  const db = await openGamificationDB();
  const allAttempts = await db.getAllFromIndex(
    "quizAttempts",
    "by-user",
    userId,
  );
  const unsynced = allAttempts.filter((a) => !a.synced);

  return unsynced;
}

/**
 * Mark quiz attempts as submitted (synced)
 */
export async function markQuizAttemptsAsSubmitted(
  ids: string[],
): Promise<void> {
  const db = await openGamificationDB();
  const tx = db.transaction("quizAttempts", "readwrite");

  await Promise.all(
    ids.map(async (id) => {
      const attempt = await tx.store.get(id);
      if (attempt) {
        attempt.synced = true;
        await tx.store.put(attempt);
      }
    }),
  );

  await tx.done;
}

export async function saveQuizAttempt(attempt: QuizAttempt): Promise<void> {
  // console.log("💾 [GamificationIDB] Saving quiz attempt:", {
  //   id: attempt.id,
  //   score: attempt.score,
  //   maxScore: attempt.maxScore,
  //   points: attempt.points,
  // });

  const db = await openGamificationDB();
  await db.put("quizAttempts", attempt);

  // console.log("✅ [GamificationIDB] Quiz attempt saved");
}

// ==================== ACTIVITY OPERATIONS ====================

export async function isActivityFirstAttemptToday(
  userId: number,
  activityDigest: string,
): Promise<boolean> {
  const db = await openGamificationDB();
  const allTrackers = await db.getAllFromIndex("trackers", "by-user", userId);

  const today = new Date().toDateString();
  const todayAttempts = allTrackers.filter((t) => {
    const trackerDate = new Date(t.submittedDate).toDateString();
    return (
      t.digest === activityDigest && t.type === "page" && trackerDate === today
    );
  });

  const isFirstToday = todayAttempts.length === 0;

  // console.log("🔍 [GamificationIDB] First activity today check:", {
  //   userId,
  //   activityDigest,
  //   isFirstToday,
  //   todayAttempts: todayAttempts.length,
  // });

  return isFirstToday;
}

// ==================== MEDIA OPERATIONS ====================

export async function getMediaTracker(
  userId: number,
  mediaDigest: string,
): Promise<MediaTracker | undefined> {
  const db = await openGamificationDB();
  return await db.get("mediaTrackers", [userId, mediaDigest]);
}

export async function saveMediaTracker(tracker: MediaTracker): Promise<void> {
  // console.log("💾 [GamificationIDB] Saving media tracker:", {
  //   userId: tracker.userId,
  //   mediaDigest: tracker.mediaDigest,
  //   timeViewed: tracker.timeViewed,
  //   points: tracker.points,
  // });

  const db = await openGamificationDB();
  await db.put("mediaTrackers", tracker);

  // console.log("✅ [GamificationIDB] Media tracker saved");
}

/**
 * Check if this is the first feedback submission ever for this digest (lifetime once)
 */
export async function isFeedbackFirstAttempt(
  userId: number,
  feedbackDigest: string,
): Promise<boolean> {
  const db = await openGamificationDB();
  const allTrackers = await db.getAllFromIndex("trackers", "by-user", userId);
  const feedbackTrackers = allTrackers.filter(
    (t) => t.digest === feedbackDigest && t.type === "feedback",
  );
  return feedbackTrackers.length === 0;
}

/**
 * Check if media was already started (scored) today for a specific digest
 * Used by interval mode to award media_started points once per day
 */
export async function isMediaStartedToday(
  userId: number,
  mediaDigest: string,
): Promise<boolean> {
  const db = await openGamificationDB();
  const allTrackers = await db.getAllFromIndex(
    "trackers",
    "by-digest",
    mediaDigest,
  );
  const today = new Date().toDateString();
  return allTrackers.some(
    (t) =>
      t.userId === userId &&
      t.type === "media" &&
      new Date(t.submittedDate).toDateString() === today,
  );
}

// ==================== RESOURCE OPERATIONS ====================

export async function isResourceDownloaded(
  userId: number,
  resourceDigest: string,
): Promise<boolean> {
  const db = await openGamificationDB();
  const resource = await db.get("resourceDownloads", [userId, resourceDigest]);

  const isDownloaded = resource !== undefined;

  // console.log("🔍 [GamificationIDB] Resource download check:", {
  //   userId,
  //   resourceDigest,
  //   isDownloaded,
  // });

  return isDownloaded;
}

export async function markResourceDownloaded(
  userId: number,
  resourceDigest: string,
): Promise<void> {
  // console.log("✔️ [GamificationIDB] Marking resource as downloaded:", {
  //   userId,
  //   resourceDigest,
  // });

  const db = await openGamificationDB();
  const key = `${userId}_${resourceDigest}`;
  await db.put("resourceDownloads", {
    userId,
    resourceDigest,
    downloadedAt: new Date().toISOString(),
  });

  // console.log("✅ [GamificationIDB] Resource marked as downloaded");
}

// ==================== USER POINTS OPERATIONS ====================

export async function getUserPoints(userId: number): Promise<UserPoints> {
  const db = await openGamificationDB();
  const points = await db.get("userPoints", userId);

  if (!points) {
    const defaultPoints: UserPoints = {
      userId,
      totalPoints: 0,
      badges: 0,
    };
    await db.put("userPoints", defaultPoints);
    return defaultPoints;
  }

  return points;
}

export async function updateUserPoints(
  userId: number,
  pointsToAdd: number,
): Promise<UserPoints> {
  // console.log("➕ [GamificationIDB] Updating points:", {
  //   userId,
  //   pointsToAdd,
  // });

  const db = await openGamificationDB();
  const current = await getUserPoints(userId);

  const updated: UserPoints = {
    ...current,
    totalPoints: current.totalPoints + pointsToAdd,
  };

  await db.put("userPoints", updated);

  // console.log("✅ [GamificationIDB] Points updated:", {
  //   old: current.totalPoints,
  //   new: updated.totalPoints,
  // });

  return updated;
}

export async function updateUserBadges(
  userId: number,
  badges: number,
): Promise<void> {
  // console.log("🏅 [GamificationIDB] Updating badges:", {
  //   userId,
  //   badges,
  // });

  const db = await openGamificationDB();
  const current = await getUserPoints(userId);

  const updated: UserPoints = {
    ...current,
    badges,
  };

  await db.put("userPoints", updated);

  // console.log("✅ [GamificationIDB] Badges updated");
}

/**
 * Reset user points to 0 after successful sync
 * This prevents double-counting when points are synced to the server
 * The API user.points becomes the source of truth for synced points
 */
export async function resetUserPoints(userId: number): Promise<void> {
  const db = await openGamificationDB();
  const current = await getUserPoints(userId);

  const reset: UserPoints = {
    ...current,
    totalPoints: 0, // Reset to 0, API points are the source of truth
  };

  await db.put("userPoints", reset);
}

// ==================== UTILITY FUNCTIONS ====================

export async function clearAllGamificationData(): Promise<void> {
  // console.log("🗑️ [GamificationIDB] Clearing all gamification data");

  const db = await openGamificationDB();
  const tx = db.transaction(
    [
      "trackers",
      "quizAttempts",
      "mediaTrackers",
      "resourceDownloads",
      "userPoints",
    ],
    "readwrite",
  );

  await Promise.all([
    tx.objectStore("trackers").clear(),
    tx.objectStore("quizAttempts").clear(),
    tx.objectStore("mediaTrackers").clear(),
    tx.objectStore("resourceDownloads").clear(),
    tx.objectStore("userPoints").clear(),
  ]);

  await tx.done;
  // console.log("✅ [GamificationIDB] All data cleared");
}

/**
 * Clear all gamification data (trackers, quiz attempts, media trackers) for a specific course.
 * Used when resetting a course so that points can be re-earned.
 */
export async function clearCourseGamificationData(
  courseId: number,
): Promise<void> {
  const db = await openGamificationDB();

  // Delete trackers for this course using a cursor (single transaction, batch operation)
  const trackerTx = db.transaction("trackers", "readwrite");
  let cursor = await trackerTx.store.index("by-course").openCursor(courseId);

  while (cursor) {
    cursor.delete();
    cursor = await (cursor as any).continue();
  }

  await trackerTx.done;

  // Delete quiz attempts for this course using a cursor (single transaction, batch operation)
  const quizTx = db.transaction("quizAttempts", "readwrite");
  let quizCursor = await quizTx.store.index("by-course").openCursor(courseId);

  while (quizCursor) {
    quizCursor.delete();
    quizCursor = await (quizCursor as any).continue();
  }

  await quizTx.done;
}

export async function getGamificationStats(userId: number) {
  const db = await openGamificationDB();

  const [trackers, quizAttempts, userPoints] = await Promise.all([
    db.getAllFromIndex("trackers", "by-user", userId),
    db.getAllFromIndex("quizAttempts", "by-user", userId),
    getUserPoints(userId),
  ]);

  const stats = {
    totalTrackers: trackers.length,
    syncedTrackers: trackers.filter((t) => t.synced).length,
    unsyncedTrackers: trackers.filter((t) => !t.synced).length,
    totalQuizAttempts: quizAttempts.length,
    unsyncedQuizAttempts: quizAttempts.filter((a) => !a.synced).length,
    totalPoints: userPoints.totalPoints,
    badges: userPoints.badges,
  };

  // console.log("📊 [GamificationIDB] Stats:", stats);

  return stats;
}
