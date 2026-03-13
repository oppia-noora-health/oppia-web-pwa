import { useState, useEffect, useCallback, useRef } from "react";
import { useCourseStore } from "@/store/useStore";
import { useAuthenticatedApi } from "@/hooks/useAuthenticatedApi";
import { useCourseDownload } from "@/hooks/useCourseDownload";
import {
  loadCourseFromIDB,
  loadFileFromCourse,
  loadAndPopulateTrackerData,
} from "@/utils/courseLoaderIDB";
import type {
  CourseStructure,
  CourseSection,
} from "@/services/courseDownloadService";
import {
  processHtmlForOfflineMedia,
  processHtmlForOnlineMedia,
} from "@/utils/htmlProcessor";

// ── Performance: In-memory cache for processed offline HTML ──
// Keyed by "courseId::filePath" → processed HTML string.
// Avoids re-reading IDB + re-running heavy HTML post-processing on
// every "Next" / "Previous" navigation for the same course.
const processedHtmlCache = new Map<string, string>();
const PROCESSED_HTML_CACHE_MAX = 30; // keep at most N pages cached

function getCachedProcessedHtml(
  courseId: string,
  filePath: string,
): string | undefined {
  return processedHtmlCache.get(`${courseId}::${filePath}`);
}

function setCachedProcessedHtml(
  courseId: string,
  filePath: string,
  html: string,
): void {
  const key = `${courseId}::${filePath}`;
  // Simple LRU-ish eviction: delete oldest entries when we exceed max
  if (processedHtmlCache.size >= PROCESSED_HTML_CACHE_MAX) {
    const firstKey = processedHtmlCache.keys().next().value;
    if (firstKey) processedHtmlCache.delete(firstKey);
  }
  processedHtmlCache.set(key, html);
}

/** Clear the processed-HTML cache (call when switching courses or on version change). */
export function clearProcessedHtmlCache(courseId?: string): void {
  if (!courseId) {
    processedHtmlCache.clear();
    return;
  }
  const prefix = `${courseId}::`;
  for (const key of processedHtmlCache.keys()) {
    if (key.startsWith(prefix)) processedHtmlCache.delete(key);
  }
}

type CourseSource = "indexeddb" | "cache" | "api" | null;

interface UseCourseDataOptions {
  skipDownload?: boolean; // If true, don't download course from API (used in streaming mode)
  disabled?: boolean; // If true, don't run the hook at all (used while determining mode)
}

export function useCourseData(
  courseId: string,
  initialPage: string | null,
  options: UseCourseDataOptions = {},
) {
  const { skipDownload = false, disabled = false } = options;
  const { getCachedCourse, setCachedCourse } = useCourseStore();
  const api = useAuthenticatedApi();
  const { getCourse, getFileContent, downloadCourse, downloading } =
    useCourseDownload();

  const [loading, setLoading] = useState(true);
  const [courseData, setCourseData] = useState<CourseStructure | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(() => {
    if (!initialPage) return 0;
    const parsedPage = parseInt(initialPage, 10);
    return isNaN(parsedPage) || parsedPage < 0 ? 0 : parsedPage;
  });
  const [currentContent, setCurrentContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [courseSource, setCourseSource] = useState<CourseSource>(null);

  // CRITICAL: Ref to track if we should abort operations when skipDownload changes
  const skipDownloadRef = useRef(skipDownload);
  skipDownloadRef.current = skipDownload;

  // Guard ref: once course is loaded from IDB, prevent wasteful re-fetches
  // caused by Zustand hydration changing the `api` dependency.
  const loadedFromIDBRef = useRef(false);

  const loadPageContent = useCallback(
    (pageIndex: number, structure: CourseStructure) => {
      try {
        // Update page index first to ensure activity tabs update correctly
        setCurrentPageIndex(pageIndex);

        // Validate inputs
        if (
          !structure ||
          !structure.sections ||
          structure.sections.length === 0
        ) {
          setCurrentContent("<p>No course content available</p>");
          return;
        }

        if (pageIndex < 0 || pageIndex >= structure.sections.length) {
          setCurrentContent("<p>Invalid page index</p>");
          return;
        }

        const section = structure.sections[pageIndex];

        if (!section) {
          setCurrentContent("<p>Section not found</p>");
          return;
        }

        if (!section.htmlFile) {
          setCurrentContent("<p>No content available for this section</p>");
          return;
        }

        const content = getFileContent(
          structure.id,
          section.htmlFile,
          structure.version,
        );

        if (content) {
          // Process HTML to inline CSS and JS from cache
          const processedContent = processHtmlForOnlineMedia(
            content,
            structure,
            getFileContent,
          );
          setCurrentContent(processedContent);
        } else {
          setCurrentContent(`
          <div style="padding: 2rem; font-family: system-ui;">
            <h2 style="color: #0891b2; margin-bottom: 1rem;">${
              section.title || "Untitled"
            }</h2>
            <p style="color: #64748b;">Content not available</p>
          </div>
        `);
        }
      } catch (error) {
        setCurrentContent("<p>Error loading content</p>");
      }
    },
    [getFileContent],
  );

  // ── Prefetch helper: silently load & cache the next N pages ──
  const prefetchPages = useCallback(
    (startIndex: number, structure: CourseStructure, count = 2) => {
      if (!courseId || !structure?.sections) return;
      for (let i = 1; i <= count; i++) {
        const idx = startIndex + i;
        if (idx >= structure.sections.length) break;
        const sec = structure.sections[idx];
        if (!sec?.htmlFile) continue;
        const htmlFile = sec.htmlFile;
        // Skip if already cached
        if (getCachedProcessedHtml(courseId, htmlFile)) continue;
        // Fire-and-forget: load + process + cache in background
        (async () => {
          try {
            const raw = await loadFileFromCourse(courseId, htmlFile);
            if (raw) {
              const processed = await processHtmlForOfflineMedia(raw, courseId);
              setCachedProcessedHtml(courseId, htmlFile, processed);
            }
          } catch {
            // prefetch is best-effort
          }
        })();
      }
    },
    [courseId],
  );

  const loadPageContentFromIDB = useCallback(
    async (pageIndex: number, structure: CourseStructure) => {
      const t0 = performance.now();
      try {
        // Update page index first to ensure activity tabs update correctly
        setCurrentPageIndex(pageIndex);

        // Validate inputs
        if (
          !structure ||
          !structure.sections ||
          structure.sections.length === 0
        ) {
          setCurrentContent("<p>No course content available</p>");
          return;
        }

        if (!courseId) {
          setCurrentContent("<p>Invalid course ID</p>");
          return;
        }

        if (pageIndex < 0 || pageIndex >= structure.sections.length) {
          setCurrentContent("<p>Invalid page index</p>");
          return;
        }

        const section = structure.sections[pageIndex];

        if (!section) {
          setCurrentContent("<p>Section not found</p>");
          return;
        }

        if (!section.htmlFile) {
          setCurrentContent("<p>No content available for this section</p>");
          return;
        }

        // ── Performance: check in-memory cache first ──
        const cached = getCachedProcessedHtml(courseId, section.htmlFile);
        if (cached) {
          setCurrentContent(cached);
          console.log(
            `[perf] loadPageContentFromIDB page=${pageIndex} CACHE HIT ${(performance.now() - t0).toFixed(1)}ms`,
          );
          // Prefetch upcoming pages in background
          prefetchPages(pageIndex, structure);
          return;
        }

        // ── Load from IndexedDB (static import, no dynamic import overhead) ──
        const t1 = performance.now();
        const content = await loadFileFromCourse(courseId, section.htmlFile);
        const t2 = performance.now();

        if (content) {
          const processedContent = await processHtmlForOfflineMedia(
            content,
            courseId,
          );
          const t3 = performance.now();
          // Cache the processed result for instant re-access
          setCachedProcessedHtml(courseId, section.htmlFile, processedContent);
          setCurrentContent(processedContent);
          console.log(
            `[perf] loadPageContentFromIDB page=${pageIndex} ` +
              `IDB=${(t2 - t1).toFixed(1)}ms ` +
              `HTML-process=${(t3 - t2).toFixed(1)}ms ` +
              `total=${(t3 - t0).toFixed(1)}ms`,
          );
          // Prefetch upcoming pages in background
          prefetchPages(pageIndex, structure);
        } else {
          setCurrentContent(`
          <div style="padding: 2rem; font-family: system-ui;">
            <h2 style="color: #0891b2; margin-bottom: 1rem;">${
              section.title || "Untitled"
            }</h2>
            <p style="color: #64748b;">Content not available</p>
            <p style="color: #94a3b8; font-size: 0.875rem; margin-top: 0.5rem;">File: ${
              section.htmlFile
            }</p>
          </div>
        `);
        }
      } catch (error) {
        setCurrentContent("<p>Error loading content</p>");
      }
    },
    [courseId, prefetchPages],
  );

  useEffect(() => {
    let isCancelled = false;

    const fetchCourse = async () => {
      console.log(
        `[FLOW-4] 🚀 useCourseData effect — initialPage: "${initialPage}", disabled: ${disabled}, skipDownload: ${skipDownload}, courseId: ${courseId}, loadedFromIDB: ${loadedFromIDBRef.current}`,
      );
      // Don't run if disabled (still determining mode)
      if (disabled) {
        console.log("[useCourseData] ⏸️ Disabled - skipping fetch", {
          courseId,
        });
        return;
      }

      // CRITICAL: If skipDownload is true, immediately return - don't do anything
      if (skipDownload) {
        console.log(
          "[useCourseData] ⏭️ skipDownload=true - clearing and returning",
          {
            courseId,
          },
        );
        setLoading(false);
        setCourseData(null); // Clear any previous data
        setCourseSource(null);
        return;
      }

      // Validate courseId
      if (!courseId || courseId === "undefined" || courseId === "null") {
        console.error("[useCourseData] ❌ Invalid courseId:", courseId);
        setError("Invalid course ID");
        setLoading(false);
        return;
      }

      // EDGE CASE FIX: If we already loaded this course from IDB, don't
      // re-run just because Zustand hydrated and changed `api`. The IDB
      // data is authoritative for downloaded courses and doesn't need auth.
      if (loadedFromIDBRef.current) {
        console.log(
          "[useCourseData] ⏭️ Already loaded from IDB — skipping re-fetch",
        );
        return;
      }

      console.log("[useCourseData] 🚀 Starting course fetch:", {
        courseId,
        initialPage,
        isOnline: navigator.onLine,
        isAuthenticated: api.isAuthenticated,
      });

      setLoading(true);
      setError(null);

      try {
        // CRITICAL FIX: Check IndexedDB FIRST, BEFORE auth check.
        // IndexedDB is local storage — no authentication needed.
        // This ensures offline access works even during Zustand hydration delay.
        console.log("[useCourseData] 📂 Step 1: Checking IndexedDB...");
        const idbCourse = await loadCourseFromIDB(courseId);

        if (idbCourse && idbCourse.structure) {
          console.log("[useCourseData] ✅ Course found in IndexedDB!", {
            courseId,
            sections: idbCourse.structure.sections?.length,
          });
          setCourseData(idbCourse.structure);
          setCourseSource("indexeddb");

          // Load tracker data in background (non-blocking) — it only affects
          // completion-status display, not the actual content rendering.
          loadAndPopulateTrackerData(courseId).catch((trackerError) => {
            console.warn(
              "[useCourseData] ⚠️ Could not load tracker data:",
              trackerError,
            );
          });

          let pageToLoad = 0;
          if (initialPage) {
            const parsedPage = parseInt(initialPage, 10);
            if (
              !isNaN(parsedPage) &&
              parsedPage >= 0 &&
              parsedPage < idbCourse.structure.sections.length
            ) {
              pageToLoad = parsedPage;
            }
          }
          const sectionAtPage = idbCourse.structure.sections[pageToLoad];
          console.log(
            `[FLOW-4a] 📌 IDB pageToLoad — initialPage: "${initialPage}", pageToLoad: ${pageToLoad}, sectionTitle: "${sectionAtPage?.title || sectionAtPage?.sectionTitle || "N/A"}", sectionType: "${sectionAtPage?.type || "N/A"}", totalSections: ${idbCourse.structure.sections?.length}`,
          );
          await loadPageContentFromIDB(pageToLoad, idbCourse.structure);
          loadedFromIDBRef.current = true; // Prevent re-fetch on hydration
          setLoading(false);
          return;
        }
        console.log(
          "[useCourseData] ℹ️ Course not in IndexedDB - continuing...",
        );

        const cachedCourse = getCachedCourse(courseId);

        if (cachedCourse && cachedCourse.structure) {
          console.log(
            "[useCourseData] 💾 Step 2: Found course in Zustand cache",
          );
          // CRITICAL: Verify that files actually exist before using cached structure
          // If files don't exist, this is a streamed course structure and we should skip it
          const testSection = cachedCourse.structure.sections?.find(
            (s: CourseSection) =>
              s.htmlFile && s.type !== "quiz" && s.type !== "feedback",
          );

          if (testSection && testSection.htmlFile) {
            const testContent = getFileContent(
              cachedCourse.structure.id,
              testSection.htmlFile,
              cachedCourse.structure.version,
            );

            if (!testContent) {
              console.log(
                "[useCourseData] ❌ Cache found but files don't exist - skipping",
              );
            } else {
              console.log("[useCourseData] ✅ Using cached course with files!");
              setCourseData(cachedCourse.structure);
              setCourseSource("cache");
              let pageToLoad = 0;
              if (initialPage) {
                const parsedPage = parseInt(initialPage, 10);
                if (
                  !isNaN(parsedPage) &&
                  parsedPage >= 0 &&
                  parsedPage < cachedCourse.structure.sections.length
                ) {
                  pageToLoad = parsedPage;
                }
              }
              loadPageContent(pageToLoad, cachedCourse.structure);
              setLoading(false);
              return;
            }
          } else {
            console.log("[useCourseData] ℹ️ Cached course has no HTML files");
          }
        }

        console.log("[useCourseData] 🔍 Step 3: Checking getCourse service...");
        const downloadedCourse = getCourse(parseInt(courseId));

        if (downloadedCourse) {
          console.log("[useCourseData] ✅ Found in getCourse service!");
          setCourseData(downloadedCourse.structure);
          setCourseSource("cache");
          let pageToLoad = 0;
          if (initialPage) {
            const parsedPage = parseInt(initialPage, 10);
            if (
              !isNaN(parsedPage) &&
              parsedPage >= 0 &&
              parsedPage < downloadedCourse.structure.sections.length
            ) {
              pageToLoad = parsedPage;
            }
          }
          loadPageContent(pageToLoad, downloadedCourse.structure);

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
        // STEP 5: Fetch from API (requires auth + network)
        // Auth check moved here: only API calls need authentication,
        // local storage (IDB, cache, memory) checks above don't.
        if (!api.isAuthenticated) {
          console.log(
            "[useCourseData] 🔐 Not authenticated - cannot call API",
            {
              courseId,
              isOnline: navigator.onLine,
            },
          );
          setError(
            "You are offline and this course is not downloaded. Please connect to the internet to access this course.",
          );
          setLoading(false);
          return;
        }

        // CRITICAL: Double-check skipDownload here to prevent race conditions
        if (skipDownload) {
          console.log(
            "[useCourseData] ⏭️ skipDownload still true - returning before API",
          );
          setLoading(false);
          return;
        }

        // CRITICAL: Check offline status before trying API call
        // If offline and no course found yet, don't try API (will fail anyway)
        // This prevents timeout delays and unnecessary API attempts when offline
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          console.error(
            "[useCourseData] 📴 OFFLINE - Course not in any cache!",
          );
          console.log("[useCourseData] Course loading sequence failed:", {
            courseId,
            foundInIDB: false,
            foundInCache: false,
            foundInService: false,
            isOnline: navigator.onLine,
          });
          setError(
            "You are offline and this course is not downloaded. Please connect to the internet to access this course.",
          );
          setLoading(false);
          return;
        }

        // SAFETY: If the effect was re-triggered (e.g. dep changed during
        // navigation) bail out before making a network request.
        if (isCancelled) {
          console.log("[useCourseData] ⏹️ Cancelled before API call");
          return;
        }

        console.log("[useCourseData] 🌐 Step 5: Fetching from API...");
        try {
          // CRITICAL: Add timeout to prevent hanging on flaky networks
          const { fetchWithTimeout } = await import("@/utils/offlineUtils");

          const response = await fetchWithTimeout(
            `/api/v2/course/${courseId}/`,
            {
              timeout: 8000, // 8 second timeout for API
            },
          );

          if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
          }

          const courseResponse = await response.json();

          if (!courseResponse.url) {
            console.error(
              "[useCourseData] ❌ API response has no download URL",
            );
            setError("Download URL not available for this course.");
            setLoading(false);
            return;
          }

          console.log(
            "[useCourseData] ✅ Got course from API, starting download...",
            {
              courseId,
              shortname: courseResponse.shortname,
            },
          );

          // CRITICAL: Check skipDownload again before downloading
          if (skipDownload || skipDownloadRef.current) {
            console.log(
              "[useCourseData] ⏭️ skipDownload triggered during API fetch",
            );
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

          console.log(
            "[useCourseData] ✅ Download completed, got coursePackage",
          );

          // CRITICAL: Check skipDownload after download completes
          if (skipDownload || skipDownloadRef.current) {
            console.log(
              "[useCourseData] ⏭️ skipDownload triggered after download",
            );
            setLoading(false);
            setCourseData(null);
            setCourseSource(null);
            return;
          }

          if (coursePackage) {
            console.log(
              "[useCourseData] ✅ Setting courseData from API download",
              {
                courseId,
                sections: coursePackage.structure.sections?.length,
              },
            );
            setCourseData(coursePackage.structure);
            setCourseSource("api");
            let pageToLoad = 0;
            if (initialPage) {
              const parsedPage = parseInt(initialPage, 10);
              if (
                !isNaN(parsedPage) &&
                parsedPage >= 0 &&
                parsedPage < coursePackage.structure.sections.length
              ) {
                pageToLoad = parsedPage;
              }
            }
            loadPageContent(pageToLoad, coursePackage.structure);

            setCachedCourse(courseId, {
              id: courseId,
              structure: coursePackage.structure,
              modules: [],
              cachedAt: new Date().toISOString(),
              files: coursePackage.files,
            });
          } else {
            console.error(
              "[useCourseData] ❌ coursePackage is null after download",
            );
            setError("Failed to download course. Please try again.");
          }
        } catch (apiError: any) {
          console.error("[useCourseData] 💥 API Error:", {
            status: apiError?.response?.status,
            message: apiError?.message,
            code: apiError?.code,
            isOnline: navigator.onLine,
          });

          // Handle offline errors gracefully
          if (
            apiError?.response?.status === 503 ||
            apiError?.message?.includes("offline")
          ) {
            console.log("[useCourseData] ❌ Setting offline error");
            setError(
              "You are offline and this course is not downloaded. Please connect to the internet to access this course.",
            );
          } else if (
            apiError?.code === "ECONNABORTED" ||
            apiError?.message?.includes("timeout")
          ) {
            console.error("[useCourseData] ⏱️ Connection timeout");
            setError(
              "Connection timeout. Please check your internet connection.",
            );
          } else if (
            apiError?.message === "Network Error" ||
            !navigator.onLine
          ) {
            console.warn("[useCourseData] 🌐 Network error detected");
            setError(
              "No internet connection. Please download this course for offline access.",
            );
          } else {
            console.error(
              "[useCourseData] ❌ Generic API error",
              apiError?.message,
            );
            setError("Failed to load course. Please try again.");
          }
        }
      } catch (error) {
        // Provide specific error messages for offline scenarios
        console.error(
          "[useCourseData] 💥 Unexpected error in course loading:",
          error,
        );
        if (!navigator.onLine) {
          console.log("[useCourseData] 📴 Error occurred while offline");
          setError(
            "You are offline. Please download courses for offline access or connect to the internet.",
          );
        } else {
          console.error("[useCourseData] ❌ Error occurred while online");
          setError("Failed to load course. Please try again.");
        }
      } finally {
        console.log("[useCourseData] ✅ Course loading completed", {
          courseId,
          hasData: !!courseData,
          hasError: !!error,
          source: courseSource,
        });
        setLoading(false);
      }
    };

    fetchCourse();

    return () => {
      isCancelled = true;
    };
  }, [
    api,
    courseId,
    getCourse,
    downloadCourse,
    getCachedCourse,
    setCachedCourse,
    initialPage,
    loadPageContent,
    loadPageContentFromIDB,
    skipDownload,
    disabled,
  ]);

  // SAFETY FIX: If initialPage becomes available AFTER we loaded from IDB with
  // pageToLoad=0 (because initialPage was null/undefined during initial load),
  // re-load the correct page. This handles race conditions where useSearchParams()
  // returns null on the first render during offline navigation.
  const correctedPageRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      loadedFromIDBRef.current &&
      initialPage &&
      courseData &&
      correctedPageRef.current !== initialPage
    ) {
      const parsedPage = parseInt(initialPage, 10);
      if (
        !isNaN(parsedPage) &&
        parsedPage >= 0 &&
        parsedPage < (courseData.sections?.length || 0) &&
        parsedPage !== currentPageIndex
      ) {
        console.log(
          `[FLOW-4b] 🔄 SAFETY FIX — correcting page! initialPage: "${initialPage}", currentPageIndex: ${currentPageIndex}, correcting to: ${parsedPage}`,
        );
        correctedPageRef.current = initialPage;
        if (courseSource === "indexeddb") {
          loadPageContentFromIDB(parsedPage, courseData);
        } else {
          loadPageContent(parsedPage, courseData);
        }
      }
    }
  }, [
    initialPage,
    courseData,
    currentPageIndex,
    courseSource,
    loadPageContentFromIDB,
    loadPageContent,
  ]);

  return {
    loading,
    courseData,
    currentPageIndex,
    currentContent,
    error,
    courseSource,
    downloading,
    setCurrentPageIndex,
    loadPageContent,
    loadPageContentFromIDB,
  };
}
