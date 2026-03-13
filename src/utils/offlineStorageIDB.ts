/**
 * IndexedDB Storage for Offline Data
 * Handles caching of API responses for offline access
 */

import { openDB, DBSchema, IDBPDatabase } from "idb";

interface OfflineDataDB extends DBSchema {
  userProfile: {
    key: number; // userId
    value: {
      userId: number;
      data: any; // User profile data
      cachedAt: string;
    };
  };
  coursesList: {
    key: string; // "all" or tagId
    value: {
      key: string;
      courses: any[];
      cachedAt: string;
    };
  };
  tagsList: {
    key: string; // "all"
    value: {
      key: string;
      tags: any[];
      cachedAt: string;
    };
  };
  activityTracking: {
    key: string; // courseShortname
    value: {
      shortname: string;
      trackingData: any;
      cachedAt: string;
    };
  };
}

const DB_NAME = "NooraHealthOfflineData";
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<OfflineDataDB> | null = null;

/**
 * Initialize offline data database
 */
export async function openOfflineDB(): Promise<IDBPDatabase<OfflineDataDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<OfflineDataDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // User profile store
      if (!db.objectStoreNames.contains("userProfile")) {
        db.createObjectStore("userProfile", { keyPath: "userId" });
      }

      // Courses list store
      if (!db.objectStoreNames.contains("coursesList")) {
        db.createObjectStore("coursesList", { keyPath: "key" });
      }

      // Tags list store
      if (!db.objectStoreNames.contains("tagsList")) {
        db.createObjectStore("tagsList", { keyPath: "key" });
      }

      // Activity tracking store
      if (!db.objectStoreNames.contains("activityTracking")) {
        db.createObjectStore("activityTracking", { keyPath: "shortname" });
      }
    },
  });

  return dbInstance;
}

// ==================== USER PROFILE OPERATIONS ====================

export async function cacheUserProfile(
  userId: number,
  data: any,
): Promise<void> {
  const db = await openOfflineDB();
  await db.put("userProfile", {
    userId,
    data,
    cachedAt: new Date().toISOString(),
  });
}

export async function getCachedUserProfile(
  userId: number,
): Promise<any | null> {
  const db = await openOfflineDB();
  const cached = await db.get("userProfile", userId);
  return cached ? cached.data : null;
}

// ==================== COURSES LIST OPERATIONS ====================

export async function cacheCoursesList(
  key: string,
  courses: any[],
): Promise<void> {
  const db = await openOfflineDB();
  await db.put("coursesList", {
    key,
    courses,
    cachedAt: new Date().toISOString(),
  });
}

export async function getCachedCoursesList(key: string): Promise<any[] | null> {
  const db = await openOfflineDB();
  const cached = await db.get("coursesList", key);
  return cached ? cached.courses : null;
}

// ==================== TAGS LIST OPERATIONS ====================

export async function cacheTagsList(tags: any[]): Promise<void> {
  const db = await openOfflineDB();
  await db.put("tagsList", {
    key: "all",
    tags,
    cachedAt: new Date().toISOString(),
  });
}

export async function getCachedTagsList(): Promise<any[] | null> {
  const db = await openOfflineDB();
  const cached = await db.get("tagsList", "all");
  return cached ? cached.tags : null;
}

// ==================== ACTIVITY TRACKING OPERATIONS ====================

export async function cacheActivityTracking(
  shortname: string,
  trackingData: any,
): Promise<void> {
  const db = await openOfflineDB();
  await db.put("activityTracking", {
    shortname,
    trackingData,
    cachedAt: new Date().toISOString(),
  });
}

export async function getCachedActivityTracking(
  shortname: string,
): Promise<any | null> {
  const db = await openOfflineDB();
  const cached = await db.get("activityTracking", shortname);
  return cached ? cached.trackingData : null;
}

/**
 * Clear cached activity tracking for a specific course
 * Called during course reset to ensure fresh data is fetched
 */
export async function clearCachedActivityTracking(
  shortname: string,
): Promise<void> {
  const db = await openOfflineDB();
  const tx = db.transaction("activityTracking", "readwrite");
  await tx.store.delete(shortname);
  await tx.done;
}

// ==================== UTILITY FUNCTIONS ====================

export async function clearOfflineData(): Promise<void> {
  const db = await openOfflineDB();
  const tx = db.transaction(
    ["userProfile", "coursesList", "tagsList", "activityTracking"],
    "readwrite",
  );

  await Promise.all([
    tx.objectStore("userProfile").clear(),
    tx.objectStore("coursesList").clear(),
    tx.objectStore("tagsList").clear(),
    tx.objectStore("activityTracking").clear(),
  ]);

  await tx.done;
}

export async function getOfflineDataStats() {
  const db = await openOfflineDB();

  const [userProfiles, coursesLists, tagsLists, activityTrackings] =
    await Promise.all([
      db.getAll("userProfile"),
      db.getAll("coursesList"),
      db.getAll("tagsList"),
      db.getAll("activityTracking"),
    ]);

  return {
    userProfiles: userProfiles.length,
    coursesLists: coursesLists.length,
    tagsLists: tagsLists.length,
    activityTrackings: activityTrackings.length,
  };
}
