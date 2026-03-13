/**
 * IndexedDB Storage for Downloaded Courses
 * Handles storing and retrieving course packages in IndexedDB
 */

import { openDB, DBSchema, IDBPDatabase } from "idb";

/**
 * Lazily import cache-invalidation helpers to avoid circular dependency
 * (courseLoaderIDB imports from courseStorageIDB).
 */
async function invalidatePerfCaches(courseId?: string): Promise<void> {
  try {
    const { invalidateCourseFileKeysCache, revokeBlobUrlCache } =
      await import("@/utils/courseLoaderIDB");
    const { clearProcessedHtmlCache } = await import("@/hooks/useCourseData");
    invalidateCourseFileKeysCache(courseId);
    revokeBlobUrlCache(courseId);
    clearProcessedHtmlCache(courseId);
  } catch {
    // Non-fatal — caches will go stale but self-correct on next course switch
  }
}

/**
 * Storage statistics interface
 */
export interface StorageStats {
  usage: number;
  quota: number;
  usagePercent: number;
  usageMB: number;
  quotaMB: number;
  availableMB: number;
}

/**
 * Storage statistics interface
 */
export interface StorageStats {
  usage: number;
  quota: number;
  usagePercent: number;
  usageMB: number;
  quotaMB: number;
  availableMB: number;
}

interface NooraHealthDB extends DBSchema {
  courses: {
    key: string;
    value: {
      courseId: string;
      shortname: string;
      version: string | number; // Can be versionid string (e.g., "20260122172021") or legacy number
      downloadedAt: string;
      structure: any; // Course structure from data.xml
      isDownloaded?: boolean; // Flag to distinguish downloaded vs viewed courses
    };
  };
  files: {
    key: string; // Format: "courseId_filepath"
    value: {
      courseId: string;
      filePath: string;
      content: Uint8Array;
      mimeType: string;
    };
  };
}

const DB_NAME = "NooraHealthCourses";
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<NooraHealthDB> | null = null;
let dbPromise: Promise<IDBPDatabase<NooraHealthDB>> | null = null;

/**
 * Initialize IndexedDB
 */
export async function initDB(): Promise<IDBPDatabase<NooraHealthDB>> {
  // Return existing instance if available and open
  if (dbInstance && dbInstance.objectStoreNames.length > 0) {
    try {
      // Try to access the database to check if it's still open
      dbInstance.objectStoreNames.contains("courses");
      return dbInstance;
    } catch (e) {
      // Database is closed, need to reopen
      dbInstance = null;
    }
  }

  // Return existing promise if database is being opened
  if (dbPromise) {
    return dbPromise;
  }

  // Create new database connection
  dbPromise = openDB<NooraHealthDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create courses store
      if (!db.objectStoreNames.contains("courses")) {
        db.createObjectStore("courses", { keyPath: "courseId" });
      }

      // Create files store
      if (!db.objectStoreNames.contains("files")) {
        db.createObjectStore("files");
      }
    },
    blocked() {},
    blocking() {
      if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
      }
    },
    terminated() {
      dbInstance = null;
      dbPromise = null;
    },
  });

  try {
    dbInstance = await dbPromise;
    return dbInstance;
  } catch (error) {
    dbPromise = null;
    throw error;
  }
}

/**
 * Store a course in IndexedDB
 */
export async function storeCourse(
  courseId: string,
  shortname: string,
  version: string | number,
  zipArrayBuffer: ArrayBuffer,
  structure: any,
  isDownloaded: boolean = false,
): Promise<void> {
  const db = await initDB();
  const JSZip = (await import("jszip")).default;

  // Invalidate any stale in-memory caches for this course (re-download scenario)
  await invalidatePerfCaches(courseId);

  try {
    // Load ZIP file
    const zip = await JSZip.loadAsync(zipArrayBuffer);

    // Store course metadata in a separate transaction
    const courseTx = db.transaction("courses", "readwrite");
    await courseTx.objectStore("courses").put({
      courseId,
      shortname,
      version,
      downloadedAt: new Date().toISOString(),
      structure,
      isDownloaded,
    });
    await courseTx.done;

    // Extract all file contents first (outside of transaction)
    const filenames = Object.keys(zip.files).filter(
      (filename) => !zip.files[filename].dir,
    );

    const fileContents = await Promise.all(
      filenames.map(async (filename) => {
        const file = zip.files[filename];
        const content = await file.async("uint8array");
        const mimeType = getMimeType(filename);
        return {
          filename,
          content,
          mimeType,
        };
      }),
    );

    // Store all files in batches to avoid transaction timeout
    const batchSize = 50; // Process 50 files at a time

    for (let i = 0; i < fileContents.length; i += batchSize) {
      const batch = fileContents.slice(i, i + batchSize);
      const filesTx = db.transaction("files", "readwrite");
      const store = filesTx.objectStore("files");

      // Put all files in batch synchronously (no await inside loop)
      for (const { filename, content, mimeType } of batch) {
        const key = `${courseId}_${filename}`;
        store.put(
          {
            courseId,
            filePath: filename,
            content,
            mimeType,
          },
          key,
        );
      }

      // Wait for transaction to complete
      await filesTx.done;
    }
  } catch (error) {
    // Enhanced error handling for quota exceeded
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      const stats = await getStorageStats();

      // Re-throw with user-friendly message
      const enhancedError = new Error(
        `Not enough storage space. You have ${stats.availableMB.toFixed(0)} MB available. ` +
          `Please delete some downloaded courses to free up space.`,
      );
      (enhancedError as any).name = "QuotaExceededError";
      (enhancedError as any).stats = stats;
      throw enhancedError;
    }

    throw error;
  }
}

/**
 * Get course metadata from IndexedDB
 */
export async function getCourseFromIDB(courseId: string): Promise<any | null> {
  const db = await initDB();
  const course = await db.get("courses", courseId);
  return course || null;
}

/**
 * Get file content from IndexedDB
 */
export async function getFileFromIDB(
  courseId: string,
  filePath: string,
): Promise<Uint8Array | null> {
  const db = await initDB();
  const key = `${courseId}_${filePath}`;
  const file = await db.get("files", key);
  return file ? file.content : null;
}

/**
 * Check if course is downloaded (explicitly by user, not just cached for viewing)
 */
export async function isCourseDownloaded(courseId: string): Promise<boolean> {
  try {
    const db = await initDB();
    const tx = db.transaction("courses", "readonly");
    const store = tx.objectStore("courses");
    const course = await store.get(courseId);
    await tx.done;
    // Only return true if course exists AND isDownloaded flag is true
    return !!course && course.isDownloaded === true;
  } catch (error) {
    return false;
  }
}

/**
 * Get all downloaded courses (only courses explicitly downloaded by user)
 */
export async function getAllDownloadedCourses(): Promise<any[]> {
  try {
    const db = await initDB();
    const tx = db.transaction("courses", "readonly");
    const store = tx.objectStore("courses");
    const allCourses = await store.getAll();
    await tx.done;
    // Filter to only return courses that were explicitly downloaded
    return allCourses.filter((course) => course.isDownloaded === true);
  } catch (error) {
    return [];
  }
}

/**
 * Mark a course as downloaded (make it appear in Downloaded Courses list)
 */
export async function markCourseAsDownloaded(courseId: string): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction("courses", "readwrite");
    const store = tx.objectStore("courses");
    const course = await store.get(courseId);

    if (course) {
      course.isDownloaded = true;
      await store.put(course);
    } else {
    }

    await tx.done;
  } catch (error) {
    throw error;
  }
}

/**
 * Delete a course from IndexedDB
 * Note: Media files and cached pages are stored in Cache Storage, delete them separately
 */
export async function deleteCourseFromIDB(courseId: string): Promise<void> {
  try {
    const db = await initDB();

    // Delete course metadata
    const courseTx = db.transaction("courses", "readwrite");
    await courseTx.objectStore("courses").delete(courseId);
    await courseTx.done;

    // Delete all non-media files for this course (HTML, CSS, JS, XML)
    const filesTx = db.transaction("files", "readwrite");
    const store = filesTx.objectStore("files");
    const keys = await store.getAllKeys();

    for (const key of keys) {
      if (key.toString().startsWith(`${courseId}_`)) {
        await store.delete(key);
      }
    }

    await filesTx.done;

    // ✅ NEW: Delete course page cache
    if (typeof window !== "undefined" && "caches" in window) {
      try {
        const courseCacheName = `noora-courses-${courseId}`;
        const deleted = await caches.delete(courseCacheName);
        if (deleted) {
          console.log(
            `[courseStorageIDB] ✅ Deleted page cache: ${courseCacheName}`,
          );
        }
      } catch (cacheError) {
        console.warn(
          "[courseStorageIDB] Failed to delete course page cache:",
          cacheError,
        );
        // Non-fatal - continue with other cleanup
      }
    }
    // Invalidate in-memory caches for this course
    await invalidatePerfCaches(courseId);
  } catch (error) {
    throw error;
  }
}

/**
 * Delete ALL courses from IndexedDB (for logout/complete cleanup)
 * Note: Media files and cached pages are stored in Cache Storage, delete them separately
 */
export async function deleteAllCoursesFromIDB(): Promise<void> {
  try {
    const db = await initDB();

    // Delete all course metadata
    const courseTx = db.transaction("courses", "readwrite");
    await courseTx.objectStore("courses").clear();
    await courseTx.done;

    // Delete all files
    const filesTx = db.transaction("files", "readwrite");
    await filesTx.objectStore("files").clear();
    await filesTx.done;

    // Invalidate all in-memory caches
    await invalidatePerfCaches();
  } catch (error) {
    throw error;
  }
}

/**
 * Determine MIME type from filename
 */
export function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    xml: "application/xml",
    txt: "text/plain",
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    mp4: "video/mp4",
    m4v: "video/mp4",
    m4a: "audio/mp4",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    mpeg: "video/mpeg",
    "3gp": "video/3gpp",
    "3gpp": "video/3gpp",
  };

  return mimeTypes[ext || ""] || "application/octet-stream";
}

/**
 * Get storage quota and usage statistics
 */
export async function getStorageStats(): Promise<StorageStats> {
  try {
    if ("storage" in navigator && "estimate" in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const usagePercent = quota > 0 ? (usage / quota) * 100 : 0;
      const available = quota - usage;

      return {
        usage,
        quota,
        usagePercent,
        usageMB: usage / 1024 / 1024,
        quotaMB: quota / 1024 / 1024,
        availableMB: available / 1024 / 1024,
      };
    }
  } catch (error) {}

  return {
    usage: 0,
    quota: 0,
    usagePercent: 0,
    usageMB: 0,
    quotaMB: 0,
    availableMB: 0,
  };
}

/**
 * Check if there's enough storage space for a download
 * @param estimatedSizeMB Estimated size of the download in MB
 * @returns true if there's enough space, false otherwise
 */
export async function hasEnoughStorage(
  estimatedSizeMB: number,
): Promise<{ hasSpace: boolean; stats: StorageStats }> {
  const stats = await getStorageStats();
  const hasSpace = stats.availableMB >= estimatedSizeMB;

  return { hasSpace, stats };
}
