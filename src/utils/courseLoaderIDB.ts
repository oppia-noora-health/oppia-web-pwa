/**
 * Course Loader from IndexedDB
 * Handles loading and parsing courses from IndexedDB storage
 */

import {
  getCourseFromIDB,
  getFileFromIDB,
  isCourseDownloaded,
  initDB,
} from "./courseStorageIDB";

export interface CourseModule {
  moduleId: string;
  title: string;
  lessons: Lesson[];
}

export interface Lesson {
  lessonNumber: string;
  title: string;
  contents: CourseContent[];
}

export interface CourseContent {
  id: string;
  filename: string;
  htmlContent: string;
}

/**
 * Load course structure from IndexedDB
 */
export async function loadCourseFromIDB(
  courseId: string,
): Promise<{ structure: any; modules: CourseModule[] } | null> {
  const isDownloaded = await isCourseDownloaded(courseId);
  if (!isDownloaded) {
    // For offline scenarios: try to load course anyway if it exists, even if flag is unclear
    // This provides better offline resilience
    const course = await getCourseFromIDB(courseId);
    if (course && course.structure) {
      // Course exists, return it (structure is valid)
      return {
        structure: course.structure,
        modules: [],
      };
    }
    // console.log(`Course ${courseId} not found in IndexedDB`);
    return null;
  }

  const course = await getCourseFromIDB(courseId);
  if (!course) return null;

  // console.log("📚 Course structure from IDB:", course.structure);

  // The structure is already parsed and stored
  // Just return it directly - no need to re-parse
  return {
    structure: course.structure,
    modules: [], // Not used when structure has sections
  };
}

/**
 * Parse course structure from data.xml
 */
async function parseCourseStructure(
  courseId: string,
  structure: any,
): Promise<CourseModule[]> {
  // If structure is already parsed as array, return it
  if (Array.isArray(structure)) {
    return structure;
  }

  // If structure has sections (CourseStructure format from localStorage/download)
  // Just return it as-is since the modules page can handle this format
  if (structure && structure.sections && Array.isArray(structure.sections)) {
    // console.log("Using CourseStructure format with sections");
    return structure as any; // Return the whole structure, not just modules
  }

  // Otherwise, parse from XML
  const dataXml = await getFileFromIDB(courseId, "data.xml");
  if (!dataXml) {
    throw new Error("data.xml not found in course package");
  }

  const xmlText = new TextDecoder().decode(dataXml);
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  const modules: CourseModule[] = [];
  const moduleElements = xmlDoc.querySelectorAll("module");

  for (const moduleEl of Array.from(moduleElements)) {
    const moduleId = moduleEl.getAttribute("id") || "";
    const moduleTitle = moduleEl.querySelector("title")?.textContent || "";

    const lessons: Lesson[] = [];
    const lessonElements = moduleEl.querySelectorAll("lesson");

    for (const lessonEl of Array.from(lessonElements)) {
      const lessonNumber = lessonEl.getAttribute("number") || "";
      const lessonTitle = lessonEl.querySelector("title")?.textContent || "";

      const contents: CourseContent[] = [];
      const contentElements = lessonEl.querySelectorAll("content");

      for (const contentEl of Array.from(contentElements)) {
        const filename = contentEl.getAttribute("file") || "";
        const id = contentEl.getAttribute("id") || "";

        // Load HTML content from IndexedDB
        const htmlFile = await getFileFromIDB(
          courseId,
          `${moduleId}/${filename}`,
        );
        const htmlContent = htmlFile ? new TextDecoder().decode(htmlFile) : "";

        contents.push({
          id,
          filename,
          htmlContent,
        });
      }

      lessons.push({
        lessonNumber,
        title: lessonTitle,
        contents,
      });
    }

    modules.push({
      moduleId,
      title: moduleTitle,
      lessons,
    });
  }

  return modules;
}

// ── Performance: cache of IDB file-keys per course ──
// Built lazily on first miss so the fallback lookup is O(1) amortised
// instead of O(N) scanning ALL keys every time.
const courseFileKeysCache = new Map<string, string[]>();

async function getCourseFileKeys(courseId: string): Promise<string[]> {
  let keys = courseFileKeysCache.get(courseId);
  if (keys) return keys;

  const db = await initDB();
  const allKeys = await db.getAllKeys("files");
  const prefix = `${courseId}_`;
  keys = allKeys.map((k) => String(k)).filter((k) => k.startsWith(prefix));
  courseFileKeysCache.set(courseId, keys);
  return keys;
}

/** Call when a course is deleted or re-downloaded to invalidate the key cache. */
export function invalidateCourseFileKeysCache(courseId?: string): void {
  if (courseId) {
    courseFileKeysCache.delete(courseId);
  } else {
    courseFileKeysCache.clear();
  }
}

// ── Performance: blob-URL cache keyed by courseId_filePath ──
// Prevents re-reading IDB + re-creating Blob objects for the same asset
// across multiple HTML pages that share the same CSS / images.
const blobUrlCache = new Map<string, string>();

/** Revoke all cached blob URLs (call on course switch or cleanup). */
export function revokeBlobUrlCache(courseId?: string): void {
  if (!courseId) {
    blobUrlCache.forEach((url) => URL.revokeObjectURL(url));
    blobUrlCache.clear();
    return;
  }
  const prefix = `${courseId}_`;
  for (const [key, url] of blobUrlCache.entries()) {
    if (key.startsWith(prefix)) {
      URL.revokeObjectURL(url);
      blobUrlCache.delete(key);
    }
  }
}

/**
 * Load a specific file from a downloaded course
 */
export async function loadFileFromCourse(
  courseId: string,
  filePath: string,
): Promise<string | null> {
  // First, try exact match (fast O(1) IDB lookup)
  let fileData = await getFileFromIDB(courseId, filePath);

  if (!fileData) {
    // Fallback: search cached keys for this course (built once, then O(N) filter)
    const keys = await getCourseFileKeys(courseId);
    const match = keys.find(
      (k) => k.includes(filePath) || k.endsWith(filePath),
    );

    if (match) {
      const db = await initDB();
      const file = await db.get("files", match);
      fileData = file ? file.content : null;
    }
  }

  if (!fileData) return null;

  return new TextDecoder().decode(fileData);
}

/**
 * Load file as Blob URL (for images, videos, CSS)
 * Uses a per-session blob-URL cache to avoid redundant IDB reads and Blob creation.
 */
export async function loadFileBlobURL(
  courseId: string,
  filePath: string,
): Promise<string | null> {
  // Check blob cache first
  const cacheKey = `${courseId}_${filePath}`;
  const cachedUrl = blobUrlCache.get(cacheKey);
  if (cachedUrl) return cachedUrl;

  // Exact IDB lookup
  let fileData = await getFileFromIDB(courseId, filePath);

  if (!fileData) {
    // Fallback: search cached keys (built once per course)
    const keys = await getCourseFileKeys(courseId);
    const match = keys.find(
      (k) => k.includes(filePath) || k.endsWith(filePath),
    );

    if (match) {
      const db = await initDB();
      const file = await db.get("files", match);
      fileData = file ? file.content : null;
    }
  }

  if (!fileData) return null;

  const mimeType = getMimeType(filePath);
  const blob = new Blob([fileData as any], { type: mimeType });
  const blobUrl = URL.createObjectURL(blob);

  // Cache for reuse across pages
  blobUrlCache.set(cacheKey, blobUrl);

  return blobUrl;
}

/**
 * Determine MIME type from filename
 */
function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    xml: "application/xml",
    txt: "text/plain",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    mp4: "video/mp4",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
  };

  return mimeTypes[ext || ""] || "application/octet-stream";
}

/**
 * Load tracker.xml from IndexedDB and populate activity completion store
 * Called when opening an offline course to restore completion status.
 *
 * Uses dynamic imports only for circular-dependency-prone modules, but
 * caches the resolved modules so repeat calls are instant.
 */
let _trackerModulesCache: {
  parseActivityTrackingXML: any;
  activityTrackingService: any;
  useActivityCompletionStore: any;
} | null = null;

async function getTrackerModules() {
  if (_trackerModulesCache) return _trackerModulesCache;
  const [trackingMod, serviceMod, storeMod] = await Promise.all([
    import("@/types/activityTracking"),
    import("@/services/activityTrackingService"),
    import("@/store/useStore"),
  ]);
  _trackerModulesCache = {
    parseActivityTrackingXML: trackingMod.parseActivityTrackingXML,
    activityTrackingService: serviceMod.activityTrackingService,
    useActivityCompletionStore: storeMod.useActivityCompletionStore,
  };
  return _trackerModulesCache;
}

export async function loadAndPopulateTrackerData(
  courseId: string,
): Promise<void> {
  try {
    // Start IDB read and module loading in parallel
    const [modulesPromise, trackerXmlDirect] = await Promise.all([
      getTrackerModules(),
      getFileFromIDB(courseId, "tracker.xml"),
    ] as const);

    let trackerXml: Uint8Array | null = trackerXmlDirect;

    // If not found, try fallback with cached key list
    if (!trackerXml) {
      const keys = await getCourseFileKeys(courseId);
      const match = keys.find((k) => k.includes("tracker.xml"));
      if (match) {
        const db = await initDB();
        const file = await db.get("files", match);
        trackerXml = file ? file.content : null;
      }
    }

    if (!trackerXml) {
      return;
    }

    const {
      parseActivityTrackingXML,
      activityTrackingService,
      useActivityCompletionStore,
    } = modulesPromise;

    const trackerXmlString =
      trackerXml instanceof Uint8Array
        ? new TextDecoder().decode(trackerXml)
        : trackerXml;

    const trackingResponse = parseActivityTrackingXML(trackerXmlString);
    const trackerCompletionMap =
      activityTrackingService.createCompletionMap(trackingResponse);

    // Only populate Zustand from tracker.xml if no data exists yet.
    // tracker.xml is a static snapshot baked into the downloaded zip — it becomes
    // stale the moment the user completes or resets activities.  If Zustand
    // already has an entry for this course (even an empty Map from a reset),
    // that data is authoritative and must NOT be overwritten.
    const store = useActivityCompletionStore.getState();
    const existingMap = store.getCompletionData(courseId);

    if (existingMap !== null) {
      return;
    }

    store.setCompletionData(courseId, trackerCompletionMap);
  } catch (error) {
    console.error(
      `[loadAndPopulateTrackerData] ❌ Error loading tracker data:`,
      error,
    );
    // Non-critical error - course can still work without completion data
  }
}
