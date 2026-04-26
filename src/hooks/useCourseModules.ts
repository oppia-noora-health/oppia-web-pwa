import { useState, useEffect, useMemo } from "react";
import { useAuthenticatedApi } from "@/hooks/useAuthenticatedApi";
import { useCourseDownload } from "@/hooks/useCourseDownload";
import { useCourseStore, useActivityCompletionStore } from "@/store/useStore";
import { loadCourseFromIDB } from "@/utils/courseLoaderIDB";
import { activityTrackingService } from "@/services/activityTrackingService";
import { parseLessonsFromCourse } from "@/utils/lessonParser";
import { fetchCourseStructure } from "@/services/courseStreamingService";
import type { CourseStructure } from "@/services/courseDownloadService";
import type { Lesson } from "@/utils/lessonParser";

interface UseCourseModulesOptions {
  skipDownload?: boolean; // If true, use streaming API instead of downloading
  shortname?: string | null; // Required for streaming mode
  forceRefresh?: boolean; // If true, skip cache and fetch fresh from API
}

export const useCourseModules = (
  courseId: string,
  options: UseCourseModulesOptions = {},
) => {
  const {
    skipDownload = false,
    shortname: shortnameFromOptions,
    forceRefresh = false,
  } = options;
  const api = useAuthenticatedApi();
  const { getCachedCourse, setCachedCourse } = useCourseStore();
  const { setCompletionData, getCompletionData } = useActivityCompletionStore();

  // Use Zustand selector to subscribe to completion data changes
  // Get the raw object to avoid creating new Map on every render
  const completionDataObject = useActivityCompletionStore(
    (state) => state.completionData[courseId] || null,
  );

  // Memoize the Map conversion to avoid infinite loops
  const zustandCompletionData = useMemo(() => {
    return completionDataObject
      ? new Map(Object.entries(completionDataObject))
      : null;
  }, [completionDataObject]);

  const { getCourse, downloadCourse, downloading } = useCourseDownload();

  const [loading, setLoading] = useState(true);
  const [courseData, setCourseData] = useState<CourseStructure | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [courseSource, setCourseSource] = useState<
    "indexeddb" | "cache" | "api" | null
  >(null);
  const [completionMap, setCompletionMap] = useState<Map<string, boolean>>(
    new Map(),
  );

  // Re-parse lessons when completion data changes in Zustand
  // This ensures the UI updates immediately when activities are completed
  useEffect(() => {
    if (!courseData || !zustandCompletionData) return;

    // Update local state and re-parse lessons when Zustand data changes
    setCompletionMap(zustandCompletionData);
    const parsedLessons = parseLessonsFromCourse(
      courseData,
      zustandCompletionData,
    );
    setLessons(parsedLessons);
  }, [zustandCompletionData, courseData, courseId]);

  // Fetch activity tracking data
  const fetchActivityTracking = async (
    courseShortname: string,
    courseStructure: CourseStructure,
  ) => {
    try {
      // Check cached completion data
      // For downloaded/offline courses, keep using cached completion data if present.
      // For streaming mode, always fetch fresh tracking from the API so the UI
      // reflects the server state on every open.
      const cached = getCompletionData(courseId);
      if (!skipDownload && cached !== null) {
        setCompletionMap(cached);
        const parsedLessons = parseLessonsFromCourse(courseStructure, cached);
        setLessons(parsedLessons);
        return;
      }

      // Fetch from API
      const trackingData =
        await activityTrackingService.getCourseActivityTracking(
          courseShortname,
        );

      // console.log(
      //   `📦 Received tracking data with ${trackingData.trackers.length} trackers`
      // );

      // Create completion map
      const newCompletionMap =
        activityTrackingService.createCompletionMap(trackingData);

      // MERGE API data with any existing Zustand data to prevent overwrites
      // (Zustand may have been populated between the cache check and API response)
      const existingCached = getCompletionData(courseId);
      if (existingCached && existingCached.size > 0) {
        existingCached.forEach((value, key) => {
          if (value) newCompletionMap.set(key, true);
        });
      }

      // Store in state and Zustand
      setCompletionMap(newCompletionMap);
      setCompletionData(courseId, newCompletionMap);

      // Parse lessons with completion data
      const parsedLessons = parseLessonsFromCourse(
        courseStructure,
        newCompletionMap,
      );
      setLessons(parsedLessons);

      // console.log(`================================================\n`);
    } catch (error) {
      // console.error(`\n❌ ========== FETCH TRACKING ERROR ==========`);
      // console.error("Error in fetchActivityTracking:", error);
      // console.error(
      //   "Error details:",
      //   error instanceof Error ? error.message : error
      // );
      // console.error(`================================================\n`);
      // Preserve existing completion data instead of wiping it
      // This prevents completed activities from vanishing when API fails offline
      const existingCached = getCompletionData(courseId);
      const completionData =
        existingCached && existingCached.size > 0 ? existingCached : new Map();
      setCompletionMap(completionData);
      const parsedLessons = parseLessonsFromCourse(
        courseStructure,
        completionData,
      );
      setLessons(parsedLessons);
    }
  };

  useEffect(() => {
    const fetchCourse = async () => {
      // console.log("=== COURSE MODULES PAGE: Starting fetchCourse ===");
      // console.log("Course ID:", courseId);
      // console.log("API authenticated:", api.isAuthenticated);

      setLoading(true);
      setError(null);

      try {
        // console.log(`🔍 Loading course ${courseId} modules...`);

        // CRITICAL FIX: When forceRefresh is true AND we're offline, still use
        // IndexedDB. Previously forceRefresh skipped all local checks and went
        // straight to API, which fails offline — causing an error when the user
        // navigates back from the viewer while offline.
        const shouldSkipLocalChecks = forceRefresh && navigator.onLine;

        if (shouldSkipLocalChecks) {
        } else {
          // STEP 1: Check IndexedDB FIRST (Downloaded courses - works offline)
          // console.log("📦 Checking IndexedDB...");
          const idbCourse = await loadCourseFromIDB(courseId);

          if (idbCourse && idbCourse.structure) {
            // console.log("✅ Course found in IndexedDB (offline mode)");
            setCourseData(idbCourse.structure);
            setCourseSource("indexeddb");
            // Only fetch activity tracking if online, otherwise use empty map
            if (navigator.onLine) {
              await fetchActivityTracking(
                idbCourse.structure.shortname,
                idbCourse.structure,
              );
            } else {
              // Offline - use cached completion data or empty map
              const cached = getCompletionData(courseId);
              const completionData =
                cached && cached.size > 0 ? cached : new Map();
              setCompletionMap(completionData);
              const parsedLessons = parseLessonsFromCourse(
                idbCourse.structure,
                completionData,
              );
              setLessons(parsedLessons);
            }
            setLoading(false);
            return;
          }

          // STEP 2: Check Zustand Cache (works offline if previously cached)
          // console.log("💾 Checking Zustand cache...");
          const cachedCourse = getCachedCourse(courseId);

          if (cachedCourse && cachedCourse.structure) {
            // console.log("✅ Course found in cache");
            setCourseData(cachedCourse.structure);
            setCourseSource("cache");
            // Use cached completion data or empty map if offline
            const cached = getCompletionData(courseId);
            const completionData =
              cached && cached.size > 0 ? cached : new Map();
            setCompletionMap(completionData);
            const parsedLessons = parseLessonsFromCourse(
              cachedCourse.structure,
              completionData,
            );
            setLessons(parsedLessons);
            setLoading(false);
            return;
          }

          // STEP 3: Check LocalStorage (Backward compatibility - works offline)
          // console.log("🗄️ Checking localStorage...");
          const downloadedCourse = getCourse(parseInt(courseId));

          if (downloadedCourse) {
            // console.log("✅ Using downloaded course from localStorage");
            setCourseData(downloadedCourse.structure);
            setCourseSource("cache");

            // Use cached completion data or empty map if offline
            const cached = getCompletionData(courseId);
            const completionData =
              cached && cached.size > 0 ? cached : new Map();
            setCompletionMap(completionData);
            const parsedLessons = parseLessonsFromCourse(
              downloadedCourse.structure,
              completionData,
            );
            setLessons(parsedLessons);

            // Cache it in Zustand
            setCachedCourse(courseId, {
              id: courseId,
              structure: downloadedCourse.structure,
              modules: [],
              cachedAt: new Date().toISOString(),
              files: downloadedCourse.files,
            });

            setLoading(false);
            return;
          }
        }

        // For remaining steps, we need authentication
        if (!api.isAuthenticated) {
          // console.log("API not authenticated and no offline course found");
          setError(
            "Course not available offline. Please connect to the internet.",
          );
          setLoading(false);
          return;
        }

        // If skipDownload is true, use streaming API instead
        if (skipDownload) {
          // Get shortname from options or fetch from course API
          let courseShortname = shortnameFromOptions;

          if (!courseShortname) {
            try {
              const courseInfo = await api.get(`/course/${courseId}/`);
              courseShortname = courseInfo.shortname;
            } catch (e) {
              setError("Failed to get course information.");
              setLoading(false);
              return;
            }
          }

          if (!courseShortname) {
            setError("Course shortname not available for streaming.");
            setLoading(false);
            return;
          }

          try {
            const streamedStructure =
              await fetchCourseStructure(courseShortname);

            // Convert streamed structure to CourseStructure format
            const courseStructure: CourseStructure = {
              id: streamedStructure.id || parseInt(courseId),
              title: streamedStructure.title,
              shortname: streamedStructure.shortname,
              version: streamedStructure.version,
              sections: streamedStructure.sections.map((section) => ({
                id: section.id,
                title: section.title,
                sectionTitle: section.sectionTitle,
                sectionOrder: section.sectionOrder,
                order: section.order,
                type: section.type,
                htmlFile: section.htmlFile,
                quizData: section.quizData || section.content,
                digest: section.digest,
              })),
              totalPages: streamedStructure.totalPages,
              sequencing: streamedStructure.sequencing,
            };

            setCourseData(courseStructure);
            setCourseSource("api");
            await fetchActivityTracking(courseShortname, courseStructure);
            setLoading(false);
            return;
          } catch (streamError) {
            setError("Failed to load course structure. Please try again.");
            setLoading(false);
            return;
          }
        }

        // Normal download mode
        const courseResponse = await api.get(`/course/${courseId}/`);

        if (!courseResponse.url) {
          setError("Download URL not available for this course.");
          setLoading(false);
          return;
        }

        const coursePackage = await downloadCourse(
          parseInt(courseId),
          courseResponse.shortname,
          courseResponse.version,
          courseResponse.url,
          false, // isDownloaded: false for temporary viewing
        );

        // console.log("Download complete. Package received:", !!coursePackage);

        if (coursePackage) {
          // console.log("✅ Course package structure:", coursePackage.structure);
          setCourseData(coursePackage.structure);
          setCourseSource("api");
          await fetchActivityTracking(
            coursePackage.structure.shortname,
            coursePackage.structure,
          );

          // Cache it in Zustand
          setCachedCourse(courseId, {
            id: courseId,
            structure: coursePackage.structure,
            modules: [],
            cachedAt: new Date().toISOString(),
            files: coursePackage.files,
          });
        } else {
          // console.error("Course package is null/undefined");
          setError("Failed to view course. Please try again.");
        }
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load course. Please try again.",
        );
      } finally {
        // console.log("=== fetchCourse complete, setting loading to false ===");
        setLoading(false);
      }
    };

    fetchCourse();
  }, [
    api,
    courseId,
    getCourse,
    downloadCourse,
    getCachedCourse,
    setCachedCourse,
    getCompletionData,
    setCompletionData,
    skipDownload,
    shortnameFromOptions,
    forceRefresh, // Re-fetch when forceRefresh changes
  ]);

  return {
    loading,
    courseData,
    lessons,
    error,
    courseSource,
    completionMap,
    downloading,
  };
};
