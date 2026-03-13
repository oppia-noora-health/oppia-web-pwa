/**
 * Course Version Checking Service
 * Handles version comparison between local IndexedDB courses and API
 * Uses /course/ API endpoint (which maps to /api/v2/course/) to get all courses with versions
 */

import { authenticatedGet } from "@/utils/apiClient";
import { API_PATHS } from "@/utils/apiPaths";
import { getAllDownloadedCourses } from "@/utils/courseStorageIDB";

interface CourseStructureResponse {
  id: number;
  resource_uri: string;
  shortname: string;
  structure: string; // JSON string containing the course structure
}

interface CourseApiResponse {
  id: number;
  shortname: string;
  version: number;
  url?: string;
  download_url?: string;
  title?: Record<string, string | null>;
  [key: string]: any;
}

interface CoursesApiResponse {
  courses: CourseApiResponse[];
  meta?: {
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total_count: number;
  };
}

export interface CourseVersionInfo {
  courseId: string;
  shortname: string;
  localVersion: string;
  remoteVersion: string;
  hasUpdate: boolean;
  downloadUrl?: string;
}

// Cache for course list to avoid repeated API calls
let cachedCoursesList: CourseApiResponse[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all courses from /course/ API (maps to /api/v2/course/)
 * Uses caching to avoid repeated calls
 */
export async function fetchAllCoursesFromAPI(): Promise<CourseApiResponse[]> {
  // Return cached data if still valid
  const now = Date.now();
  if (cachedCoursesList && now - cacheTimestamp < CACHE_DURATION) {
    return cachedCoursesList;
  }

  try {
    const response = await authenticatedGet<CoursesApiResponse>("/course/");

    // Handle both array and object with courses property
    const courses = Array.isArray(response) ? response : response.courses || [];

    // Cache the result
    cachedCoursesList = courses;
    cacheTimestamp = now;

    return courses;
  } catch (error) {
    // Return cached data if available, even if expired
    if (cachedCoursesList) {
      return cachedCoursesList;
    }
    throw error;
  }
}

/**
 * Find a course in the API response by ID or shortname
 */
function findCourseInApiResponse(
  courses: CourseApiResponse[],
  courseId: string,
  shortname: string
): CourseApiResponse | null {
  // First try to find by ID
  const byId = courses.find((c) => c.id.toString() === courseId);
  if (byId) return byId;

  // Fallback to shortname
  const byShortname = courses.find((c) => c.shortname === shortname);
  return byShortname || null;
}

/**
 * Fetch remote course version from /course/ API (maps to /api/v2/course/)
 */
export async function fetchRemoteCourseVersion(
  courseId: string,
  shortname: string
): Promise<{ version: number | null; downloadUrl: string | null }> {
  try {
    const courses = await fetchAllCoursesFromAPI();
    const apiCourse = findCourseInApiResponse(courses, courseId, shortname);

    if (!apiCourse) {
      return { version: null, downloadUrl: null };
    }

    return {
      version: apiCourse.version || null,
      downloadUrl: apiCourse.url || apiCourse.download_url || null,
    };
  } catch (error) {
    return { version: null, downloadUrl: null };
  }
}

/**
 * Extract version ID from course structure JSON (legacy method, kept for backward compatibility)
 */
function extractVersionFromStructure(structure: string): string | null {
  try {
    const structureData = JSON.parse(structure);
    const versionId = structureData?.module?.meta?.versionid;
    return versionId || null;
  } catch (error) {
    return null;
  }
}

/**
 * Check if a single course has an update available
 * Uses /course/ API (maps to /api/v2/course/) to get version information
 */
export async function checkCourseUpdate(
  courseId: string,
  shortname: string,
  localVersion: string | number
): Promise<CourseVersionInfo> {
  const { version: remoteVersion, downloadUrl } =
    await fetchRemoteCourseVersion(courseId, shortname);
  const localVersionStr = String(localVersion);
  const remoteVersionStr = remoteVersion
    ? String(remoteVersion)
    : localVersionStr;

  // Compare versions as numbers for proper comparison
  const localVersionNum = Number(localVersion);
  const remoteVersionNum = remoteVersion
    ? Number(remoteVersion)
    : localVersionNum;
  const hasUpdate =
    remoteVersion !== null && remoteVersionNum > localVersionNum;

  return {
    courseId,
    shortname,
    localVersion: localVersionStr,
    remoteVersion: remoteVersionStr,
    hasUpdate,
    downloadUrl: downloadUrl || undefined,
  };
}

/**
 * Check all downloaded courses for updates
 * Returns array of courses that have updates available
 */
export async function checkAllCoursesForUpdates(): Promise<
  CourseVersionInfo[]
> {
  try {
    // Get all downloaded courses from IndexedDB
    const downloadedCourses = await getAllDownloadedCourses();

    // Filter only actually downloaded courses (not just viewed)
    const actualDownloads = downloadedCourses.filter(
      (course: any) => course.isDownloaded === true
    );

    // Check each course for updates in parallel
    const updateChecks = await Promise.all(
      actualDownloads.map((course: any) =>
        checkCourseUpdate(
          course.courseId,
          course.shortname,
          course.version
        ).catch((error) => {
          return {
            courseId: course.courseId,
            shortname: course.shortname,
            localVersion: String(course.version),
            remoteVersion: String(course.version),
            hasUpdate: false,
          };
        })
      )
    );

    // Filter courses that have updates
    const coursesWithUpdates = updateChecks.filter(
      (check: CourseVersionInfo) => check.hasUpdate
    );

    return updateChecks;
  } catch (error) {
    return [];
  }
}

/**
 * Get update status for a specific course
 * Uses /course/ API (maps to /api/v2/course/) to get version information
 */
export async function getCourseUpdateStatus(
  courseId: string,
  shortname: string,
  localVersion: string | number
): Promise<{
  hasUpdate: boolean;
  remoteVersion: number | null;
  downloadUrl: string | null;
}> {
  const { version: remoteVersion, downloadUrl } =
    await fetchRemoteCourseVersion(courseId, shortname);
  const localVersionNum = Number(localVersion);
  const remoteVersionNum = remoteVersion
    ? Number(remoteVersion)
    : localVersionNum;
  const hasUpdate =
    remoteVersion !== null && remoteVersionNum > localVersionNum;

  return {
    hasUpdate,
    remoteVersion,
    downloadUrl,
  };
}
