import {
  getUnsubmittedTrackers,
  markTrackersAsSubmitted,
  updateUserBadges,
  getUnsubmittedQuizAttempts,
  markQuizAttemptsAsSubmitted,
  resetUserPoints,
} from "@/utils/gamificationIDB";
import type {
  Tracker,
  TrackerSubmissionResponse,
  QuizAttempt,
  TrackerType,
} from "@/types/gamification";
import { getApiUrl } from "@/config/constants";

// API Base URL - uses getApiUrl() which respects stored custom URL
// Normalize to remove trailing slashes to prevent double slashes in URLs
const getApiBaseUrl = (): string => {
  const url = getApiUrl();
  return url.replace(/\/+$/, ""); // Remove trailing slashes
};
const API_BASE_URL = getApiBaseUrl();

const MAX_TRACKERS_PER_BATCH = 10;

/**
 * Format date for API (DD-MM-YYYY HH:MM:SS AM/PM) in UTC
 * Used for submitted_date field
 * Format: "17-12-2024 10:10:10 AM"
 */
function formatAPIDate(isoDate: string): string {
  const date = new Date(isoDate);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();

  let hours = date.getUTCHours();
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const hoursStr = String(hours).padStart(2, "0");

  return `${day}-${month}-${year}  ${hoursStr}:${minutes}:${seconds} ${ampm}`;
}

/**
 * Format date for API (DD-MM-YYYY HH:MM:SS AM/PM) in IST (UTC+5:30)
 * Used for tracker_date and attempt_date fields
 * Format: "17-12-2024 10:10:10 AM"
 */
function formatISTDate(isoDate: string): string {
  const date = new Date(isoDate);
  // IST is UTC+5:30, so add 5 hours and 30 minutes
  const istDate = new Date(date.getTime() + (5 * 60 + 30) * 60 * 1000);

  const day = String(istDate.getUTCDate()).padStart(2, "0");
  const month = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const year = istDate.getUTCFullYear();

  let hours = istDate.getUTCHours();
  const minutes = String(istDate.getUTCMinutes()).padStart(2, "0");
  const seconds = String(istDate.getUTCSeconds()).padStart(2, "0");

  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const hoursStr = String(hours).padStart(2, "0");

  return `${day}-${month}-${year}  ${hoursStr}:${minutes}:${seconds} ${ampm}`;
}

/**
 * Get client IP address (client-side, returns empty string or tries to fetch)
 * In production, IP should be obtained server-side from request headers
 */
async function getClientIP(): Promise<string> {
  try {
    // Try to get IP from a public service (client-side only)
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip || "";
  } catch {
    // If fails, return empty string (server should provide IP)
    return "";
  }
}

/**
 * Get browser name from user agent
 */
function getBrowserName(): string {
  if (typeof navigator === "undefined") return "unknown";

  const ua = navigator.userAgent;
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
  return "Unknown";
}

/**
 * Get activity title from course structure
 * Returns format: {"en": "Activity Title"} or empty object if not found
 */
async function getActivityTitle(
  tracker: Tracker,
): Promise<Record<string, string>> {
  // Try to get from tracker data if stored (already in correct format)
  if ((tracker.data as any)?.activity_title) {
    const title = (tracker.data as any).activity_title;
    // If already an object, return as-is
    if (typeof title === "object" && title !== null) {
      return title;
    }
    // If string, convert to object format
    if (typeof title === "string") {
      const lang = tracker.data?.lang || "en";
      return { [lang]: title };
    }
  }

  // Try to load course structure and find by digest
  try {
    const { loadCourseFromIDB } = await import("@/utils/courseLoaderIDB");
    const { useCourseStore } = await import("@/store/useStore");
    const { fetchCourseStructure } =
      await import("@/services/courseStreamingService");

    let courseStructure: any = null;
    const courseId = tracker.courseId.toString();
    const shortname = tracker.courseShortname;

    // Method 1: Try IndexedDB (downloaded courses)
    if (courseId) {
      const idbCourse = await loadCourseFromIDB(courseId);
      courseStructure = idbCourse?.structure;
    }

    // Method 2: Try Zustand cache by courseId
    if (!courseStructure && courseId) {
      const cachedCourse = useCourseStore.getState().getCachedCourse(courseId);
      courseStructure = cachedCourse?.structure;
    }

    // Method 3: Try Zustand cache by shortname (search all cached courses)
    if (!courseStructure && shortname) {
      const cache = useCourseStore.getState().cachedCourses;
      for (const [id, cached] of cache.entries()) {
        if (cached.structure?.shortname === shortname) {
          courseStructure = cached.structure;
          break;
        }
      }
    }

    // Method 4: Try fetching from API by shortname (for streaming courses)
    if (
      !courseStructure &&
      shortname &&
      typeof window !== "undefined" &&
      navigator.onLine
    ) {
      try {
        const streamedStructure = await fetchCourseStructure(shortname);
        // Convert to CourseStructure format
        courseStructure = {
          sections: streamedStructure.sections.map((section: any) => ({
            id: section.id,
            title: section.title,
            sectionTitle: section.sectionTitle,
            digest: section.digest,
            type: section.type,
          })),
        };
      } catch (apiError) {}
    }

    if (courseStructure && courseStructure.sections && tracker.digest) {
      // Find activity by digest
      const section = courseStructure.sections.find(
        (s: any) => s.digest === tracker.digest,
      );

      if (section && section.title) {
        const lang = tracker.data?.lang || "en";
        // If title is already an object, return as-is, otherwise wrap it
        if (typeof section.title === "object" && section.title !== null) {
          return section.title;
        }
        return { [lang]: section.title };
      } else {
      }
    } else {
    }
  } catch (error) {}

  // Return empty object if not found
  return {};
}

/**
 * Get section title from course structure
 * Returns format: {"en": "Section Title"} or empty object if not found
 */
async function getSectionTitle(
  tracker: Tracker,
): Promise<Record<string, string>> {
  // Try to get from tracker data if stored (already in correct format)
  if ((tracker.data as any)?.section_title) {
    const title = (tracker.data as any).section_title;
    // If already an object, return as-is
    if (typeof title === "object" && title !== null) {
      return title;
    }
    // If string, convert to object format
    if (typeof title === "string") {
      const lang = tracker.data?.lang || "en";
      return { [lang]: title };
    }
  }

  // Try to load course structure and find section title
  try {
    const { loadCourseFromIDB } = await import("@/utils/courseLoaderIDB");
    const { useCourseStore } = await import("@/store/useStore");
    const { fetchCourseStructure } =
      await import("@/services/courseStreamingService");

    let courseStructure: any = null;
    const courseId = tracker.courseId.toString();
    const shortname = tracker.courseShortname;

    // Method 1: Try IndexedDB (downloaded courses)
    if (courseId) {
      const idbCourse = await loadCourseFromIDB(courseId);
      courseStructure = idbCourse?.structure;
    }

    // Method 2: Try Zustand cache by courseId
    if (!courseStructure && courseId) {
      const cachedCourse = useCourseStore.getState().getCachedCourse(courseId);
      courseStructure = cachedCourse?.structure;
    }

    // Method 3: Try Zustand cache by shortname (search all cached courses)
    if (!courseStructure && shortname) {
      const cache = useCourseStore.getState().cachedCourses;
      for (const [id, cached] of cache.entries()) {
        if (cached.structure?.shortname === shortname) {
          courseStructure = cached.structure;
          break;
        }
      }
    }

    // Method 4: Try fetching from API by shortname (for streaming courses)
    if (
      !courseStructure &&
      shortname &&
      typeof window !== "undefined" &&
      navigator.onLine
    ) {
      try {
        const streamedStructure = await fetchCourseStructure(shortname);
        // Convert to CourseStructure format
        courseStructure = {
          sections: streamedStructure.sections.map((section: any) => ({
            id: section.id,
            title: section.title,
            sectionTitle: section.sectionTitle,
            digest: section.digest,
            type: section.type,
          })),
        };
      } catch (apiError) {}
    }

    if (courseStructure && courseStructure.sections && tracker.digest) {
      // Find activity by digest to get its section
      const section = courseStructure.sections.find(
        (s: any) => s.digest === tracker.digest,
      );

      if (section && section.sectionTitle) {
        const lang = tracker.data?.lang || "en";
        // If sectionTitle is already an object, return as-is, otherwise wrap it
        if (
          typeof section.sectionTitle === "object" &&
          section.sectionTitle !== null
        ) {
          return section.sectionTitle;
        }
        return { [lang]: section.sectionTitle };
      } else {
      }
    } else {
    }
  } catch (error) {}

  // Return empty object if not found
  return {};
}

function formatQuizAttemptDate(isoDate: string): string {
  // Use the same format as tracker submitted_date
  return formatAPIDate(isoDate);
}

async function trackerToJSON(
  tracker: Tracker,
): Promise<Record<string, unknown>> {
  // Get IP and browser info
  const ip = await getClientIP();
  const agent = getBrowserName();

  const dataObj: Record<string, unknown> = {
    uuid: tracker.id,
    lang: tracker.data?.lang || "en",
    timetaken: tracker.data?.timetaken || 0,
    // Device metadata (use empty strings if not available)
    network: tracker.data?.network || "",
    battery: tracker.data?.battery !== undefined ? tracker.data.battery : "",
    manufacturermodel: tracker.data?.manufacturermodel || "",
    wifion: tracker.data?.wifion !== undefined ? tracker.data.wifion : false,
    netconnected:
      tracker.data?.netconnected !== undefined
        ? tracker.data.netconnected
        : false,
    readaloud:
      tracker.data?.readaloud !== undefined ? tracker.data.readaloud : false,
  };

  // Add additional metadata if present
  if (tracker.data) {
    if (tracker.data.appInstanceId)
      dataObj.appInstanceId = tracker.data.appInstanceId;
    if (tracker.data.platform) dataObj.platform = tracker.data.platform;

    // Media-specific fields
    if (tracker.data.mediafile) dataObj.mediafile = tracker.data.mediafile;
    if (tracker.data.media) {
      // Ensure media is "played" or "not played"
      dataObj.media = tracker.data.media === "played" ? "played" : "not played";
    } else {
      dataObj.media = "not played";
    }
    if (tracker.data.media_end_reached !== undefined) {
      dataObj.media_end_reached = tracker.data.media_end_reached;
    }

    // Quiz-specific fields (for quiz trackers)
    if (tracker.type === "quiz") {
      if (tracker.data.quiz_id !== undefined)
        dataObj.quiz_id = tracker.data.quiz_id;
      if (tracker.data.instance_id)
        dataObj.instance_id = tracker.data.instance_id;
      if (tracker.data.score !== undefined) dataObj.score = tracker.data.score;
      if (tracker.data.timetaken !== undefined)
        dataObj.timetaken = tracker.data.timetaken;
    }
  }

  // Valid tracker types - only these 5 types are allowed:
  // - login → "login"
  // - download → "download"
  // - page → "page" (activity completed)
  // - media → "media" (activity with media)
  // - quiz → "quiz"
  // - feedback → "feedback"
  const VALID_TRACKER_TYPES = [
    "login",
    "download",
    "page",
    "media",
    "quiz",
    "feedback",
  ] as const;

  let trackerType = String(tracker.type || "").trim();

  if (trackerType === "page" && tracker.event !== "activity_completed") {
    let hasMedia = false;

    // Check tracker data first
    if (tracker.data?.mediafile || tracker.data?.media) {
      hasMedia = true;
    } else {
      // Check course structure for media files
      try {
        const { loadCourseFromIDB } = await import("@/utils/courseLoaderIDB");
        const { useCourseStore } = await import("@/store/useStore");
        const { fetchCourseStructure } =
          await import("@/services/courseStreamingService");

        let courseStructure: any = null;
        const courseId = tracker.courseId.toString();
        const shortname = tracker.courseShortname;

        // Try IndexedDB
        if (courseId) {
          const idbCourse = await loadCourseFromIDB(courseId);
          courseStructure = idbCourse?.structure;
        }

        // Try cache
        if (!courseStructure && courseId) {
          const cachedCourse = useCourseStore
            .getState()
            .getCachedCourse(courseId);
          courseStructure = cachedCourse?.structure;
        }

        // Try cache by shortname
        if (!courseStructure && shortname) {
          const cache = useCourseStore.getState().cachedCourses;
          for (const [id, cached] of cache.entries()) {
            if (cached.structure?.shortname === shortname) {
              courseStructure = cached.structure;
              break;
            }
          }
        }

        // Try API fetch
        if (
          !courseStructure &&
          shortname &&
          typeof window !== "undefined" &&
          navigator.onLine
        ) {
          try {
            const streamedStructure = await fetchCourseStructure(shortname);
            courseStructure = {
              sections: streamedStructure.sections.map((section: any) => ({
                digest: section.digest,
                mediaFiles: section.mediaFiles,
              })),
            };
          } catch (apiError) {
            // Ignore API errors
          }
        }

        // Check if activity has media files
        if (courseStructure && courseStructure.sections && tracker.digest) {
          const section = courseStructure.sections.find(
            (s: any) => s.digest === tracker.digest,
          );
          if (
            section &&
            (section.mediaFiles?.length > 0 || section.media?.length > 0)
          ) {
            hasMedia = true;
          }
        }
      } catch (error) {
        // Ignore errors when checking course structure
      }
    }

    if (hasMedia) {
      trackerType = "media";
    }
  }

  // Validate type - only allow the 6 valid types
  if (!VALID_TRACKER_TYPES.includes(trackerType as any)) {
    // Fallback: try to infer type from event or use "page" as default
    if (tracker.event === "login") {
      trackerType = "login";
    } else if (tracker.event === "course_downloaded") {
      trackerType = "download";
    } else if (
      String(tracker.type) === "feedback" ||
      tracker.event.includes("feedback")
    ) {
      trackerType = "feedback";
    } else if (tracker.type === "quiz" || tracker.event.includes("quiz")) {
      trackerType = "quiz";
    } else if (tracker.data?.mediafile || tracker.data?.media) {
      trackerType = "media";
    } else {
      trackerType = "page"; // Default fallback for activity completions
    }
  }

  // Ensure type doesn't exceed 10 characters (database limit)
  if (trackerType.length > 10) {
    trackerType = trackerType.substring(0, 10).trim();
  }

  // Get activity and section titles (async - returns objects like {"en": "Title"})
  const activityTitle = await getActivityTitle(tracker);
  const sectionTitle = await getSectionTitle(tracker);

  // Get time taken (from data or default to 0)
  const timeTaken = tracker.data?.timetaken || 0;

  // Get language
  const lang = tracker.data?.lang || "en";

  let apiEvent = tracker.event;
  if (trackerType === "quiz") {
    apiEvent = "quiz_attempt";
  } else if (trackerType === "media") {
    apiEvent = "media_played";
  }

  return {
    digest: tracker.digest || "",
    data: JSON.stringify(dataObj),
    submitted_date: formatAPIDate(tracker.submittedDate), // Changed from tracker_date
    ip: ip, // IP address
    agent: agent, // Browser name
    completed: tracker.completed ? 1 : 0, // Changed from boolean to 1/0
    time_taken: timeTaken, // Time taken at root level
    activity_title: activityTitle, // Activity title
    section_title: sectionTitle, // Section title
    lang: lang, // Language at root level
    course: tracker.courseShortname || "",
    course_version: tracker.courseVersion || 0,
    event: apiEvent,
    points: tracker.points,
    type: trackerType,
  };
}

/**
 * Generate JSON body from trackers
 */
async function generateTrackersJSON(trackers: Tracker[]): Promise<string> {
  const objects = await Promise.all(trackers.map(trackerToJSON));
  return JSON.stringify({ objects });
}

async function quizAttemptToJSON(
  attempt: QuizAttempt,
  userId: number,
): Promise<Record<string, unknown>> {
  // Get IP address
  const ip = await getClientIP();

  let event = "quiz_attempt"; // Default fallback
  try {
    const { getUnsubmittedTrackers } = await import("@/utils/gamificationIDB");
    const trackers = await getUnsubmittedTrackers(userId);
    const correspondingTracker = trackers.find(
      (t) => t.type === "quiz" && t.data?.instance_id === attempt.instanceId,
    );
    if (correspondingTracker) {
      event = correspondingTracker.event;
    }
  } catch (error) {}

  // Format responses array - each response should have question_id, score, and text
  const responses = (attempt.responses || []).map((response) => ({
    question_id: response.question_id,
    score: response.score,
    text: response.text || "", // Ensure text is always a string, even if empty
  }));

  const stringToNumber = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Ensure positive number
    return Math.abs(hash);
  };

  const numericId = stringToNumber(attempt.id);

  return {
    id: numericId, // Convert UUID string to number
    submitted_date: formatQuizAttemptDate(attempt.submittedDate), // UTC format
    attempt_date: formatISTDate(attempt.submittedDate), // IST format
    score: attempt.score,
    maxscore: attempt.maxScore, // API expects 'maxscore' not 'max_score'
    ip: ip,
    instance_id: attempt.instanceId,
    quiz_id: attempt.quizId || 0,
    user_id: userId,
    event: event,
    points: attempt.points,
    time_taken: attempt.timetaken,
    responses: responses, // Array of question responses
  };
}

/**
 * Submit all pending trackers (internal implementation)
 */
async function submitTrackersInternal(
  userId: number,
  username: string,
  apiKey: string,
): Promise<{ submitted: number; failed: number }> {
  const trackers = await getUnsubmittedTrackers(userId);

  if (trackers.length === 0) {
    return { submitted: 0, failed: 0 };
  }

  trackers.forEach((t, i) => {
    if (t.type.length > 10) {
    }
  });

  // Split into batches
  const batches = [];
  for (let i = 0; i < trackers.length; i += MAX_TRACKERS_PER_BATCH) {
    batches.push(trackers.slice(i, i + MAX_TRACKERS_PER_BATCH));
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    try {
      // Generate JSON for this batch
      const jsonBody = await generateTrackersJSON(batch);
      const requestData = JSON.parse(jsonBody);

      const apiUrl = `${API_BASE_URL}/tracker/`;

      // console.log("[trackerSubmission] PATCH /tracker/ body", requestData);

      // Send API request
      const response = await fetch(apiUrl, {
        method: "PATCH",
        headers: {
          Authorization: `ApiKey ${username}:${apiKey}`,
          "Content-Type": "application/json",
        },
        body: jsonBody,
      });

      // Read response body once
      const responseText = await response.text();

      if (!response.ok) {
        console.error(`[trackerSubmission] ❌ PATCH /tracker/ FAILED`, {
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText,
          requestBody: requestData,
        });
        throw new Error(
          `API returned ${response.status}: ${response.statusText}`,
        );
      }

      // console.log(`[trackerSubmission] ✅ PATCH /tracker/ OK`, {
      //   status: response.status,
      //   batchSize: batch.length,
      // });

      // Parse response
      let result: TrackerSubmissionResponse;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        result = {
          badges: 0,
          scoring: true,
          badging: true,
        };
      }

      // Mark as submitted
      const uuids = batch.map((t: Tracker) => t.id);
      await markTrackersAsSubmitted(uuids);

      // Update badges
      if (result.badges !== undefined) {
        await updateUserBadges(userId, result.badges);
      }

      successCount += batch.length;
    } catch (error) {
      console.error(
        `[trackerSubmission] ❌ Tracker batch sync error:`,
        error instanceof Error ? error.message : error,
      );
      failCount += batch.length;
    }
  }

  if (successCount > 0) {
    await resetUserPoints(userId);
  }

  return { submitted: successCount, failed: failCount };
}

async function submitQuizAttemptsInternal(
  userId: number,
  username: string,
  apiKey: string,
): Promise<{ submitted: number; failed: number }> {
  const attempts = await getUnsubmittedQuizAttempts(userId);

  if (attempts.length === 0) {
    return { submitted: 0, failed: 0 };
  }

  attempts.forEach((q, i) => {});

  let successCount = 0;
  let failCount = 0;

  // Process quiz attempts one by one (matches Android behavior)
  for (const attempt of attempts) {
    try {
      const jsonData = await quizAttemptToJSON(attempt, userId);
      const apiUrl = `${API_BASE_URL}/quizattempt/`;
      const bodyStr = JSON.stringify(jsonData);

      // Send API request
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `ApiKey ${username}:${apiKey}`,
          "Content-Type": "application/json",
        },
        body: bodyStr,
      });

      // Read response body once
      const responseText = await response.text();

      if (!response.ok) {
        console.error(`[trackerSubmission] ❌ POST /quizattempt/ FAILED`, {
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText,
          requestBody: jsonData,
        });
        throw new Error(
          `API returned ${response.status}: ${response.statusText}`,
        );
      }

      // Parse response
      let result: { badges?: number; points?: number };
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        result = { badges: 0, points: 0 };
      }

      // Mark as submitted
      await markQuizAttemptsAsSubmitted([attempt.id]);

      // Update badges if returned
      if (result.badges !== undefined) {
        await updateUserBadges(userId, result.badges);
      }

      successCount++;
    } catch (error) {
      console.error(
        `[trackerSubmission] ❌ Quiz attempt sync error:`,
        error instanceof Error ? error.message : error,
      );
      failCount++;
    }
  }

  // Reset local points after successful quiz submission
  if (successCount > 0) {
    await resetUserPoints(userId);
  }

  return { submitted: successCount, failed: failCount };
}

/**
 * Result type for submit operations
 */
export interface SubmitResult {
  trackers: { submitted: number; failed: number };
  quizAttempts: { submitted: number; failed: number };
}

/**
 * Submit all pending data (trackers + quiz attempts)
 */
export async function submitAllPendingData(
  userId: number,
  username: string,
  apiKey: string,
): Promise<SubmitResult> {
  // Submit trackers first
  const trackersResult = await submitTrackersInternal(userId, username, apiKey);

  // Then submit quiz attempts
  const quizResult = await submitQuizAttemptsInternal(userId, username, apiKey);

  const result: SubmitResult = {
    trackers: trackersResult,
    quizAttempts: quizResult,
  };

  return result;
}

/**
 * Check if online and auto-submit if needed
 */
export async function autoSubmitIfOnline(
  userId: number,
  username: string,
  apiKey: string,
): Promise<SubmitResult> {
  if (!navigator.onLine) {
    return {
      trackers: { submitted: 0, failed: 0 },
      quizAttempts: { submitted: 0, failed: 0 },
    };
  }

  return await submitAllPendingData(userId, username, apiKey);
}

/**
 * Get activity metadata for tracker submission
 */
export function getActivityMetadata(): Record<string, unknown> {
  return {
    app_version: "1.0.0",
    device_id: "web-app",
    device_type: "web",
    os_version:
      typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    network_type:
      typeof navigator !== "undefined" && navigator.onLine
        ? "online"
        : "offline",
  };
}

/**
 * Get app instance ID (persisted in localStorage)
 * Creates UUID on first call and reuses it
 */
export function getAppInstanceId(): string {
  if (typeof window === "undefined") return "server";

  let id = localStorage.getItem("oppia_app_instance_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("oppia_app_instance_id", id);
  }
  return id;
}

export async function createLoginTracker(
  userId: number,
  courseShortname: string = "",
  courseVersion: number = 0,
): Promise<void> {
  const { saveTracker } = await import("@/utils/gamificationIDB");
  const { v4: uuidv4 } = await import("uuid");

  const appInstanceId = getAppInstanceId(); // Create/reuse app instance ID

  const loginTracker: Tracker = {
    id: uuidv4(),
    userId,
    courseId: 0, // No course for login
    courseShortname,
    courseVersion,
    type: "login",
    digest: "",
    submittedDate: new Date().toISOString(),
    points: 0,
    event: "",
    completed: false, // Will be converted to 0 in trackerToJSON
    data: {
      uuid: uuidv4(),
      lang: "en",
      timetaken: 0,
      appInstanceId,
      platform: "web",
    },
    synced: false,
  };

  await saveTracker(loginTracker);
}
