// hooks/useCourseStreaming.ts

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchCourseStructure,
  fetchHtmlContent,
  prefetchHtmlFiles,
  type StreamedCourseStructure,
  type StreamedMedia,
} from "@/services/courseStreamingService";

interface UseCourseStreamingReturn {
  loading: boolean;
  courseData: StreamedCourseStructure | null;
  currentContent: string;
  currentPageIndex: number;
  error: string | null;
  loadPage: (pageIndex: number) => Promise<void>;
  setCurrentPageIndex: (index: number) => void;
  currentMediaFiles: StreamedMedia[];
  allCourseMedia: StreamedMedia[];
  serverUrl: string;
}

/**
 * Hook for streaming course content from server
 */
export function useCourseStreaming(
  shortname: string,
  initialPage: string | null,
): UseCourseStreamingReturn {
  const [loading, setLoading] = useState(true);
  const [courseData, setCourseData] = useState<StreamedCourseStructure | null>(
    null,
  );
  const [currentContent, setCurrentContent] = useState<string>("");
  const [currentPageIndex, setCurrentPageIndex] = useState(() => {
    if (!initialPage) return 0;
    const parsedPage = parseInt(initialPage, 10);
    return isNaN(parsedPage) || parsedPage < 0 ? 0 : parsedPage;
  });
  const [error, setError] = useState<string | null>(null);
  const [contentCache, setContentCache] = useState<Map<string, string>>(
    new Map(),
  );

  // Track previous shortname to detect actual changes (not just empty -> value)
  const previousShortnameRef = useRef<string>("");

  // Fetch course structure on mount or when shortname changes only.
  // Do NOT depend on initialPage: when user clicks Next we update URL (replaceState)
  // and initialPage changes, which was re-running this effect and calling
  // loadCourseStructure() again, setting loading=true and showing full-screen
  // "Streaming course..." on every next-activity click.
  useEffect(() => {
    let isMounted = true;

    // CRITICAL: Only reset state if shortname actually changed to a DIFFERENT non-empty value
    // If shortname changes from empty to a value, DON'T reset - preserve existing data
    const previousShortname = previousShortnameRef.current;
    const shortnameChanged = previousShortname !== shortname;
    const wasEmpty = !previousShortname || previousShortname.trim() === "";
    const isEmpty = !shortname || shortname.trim() === "";
    const isSettingShortname = wasEmpty && !isEmpty; // Going from empty to a value

    // Only reset if shortname changed to a different non-empty value (not empty -> value)
    const shouldReset = shortnameChanged && !isSettingShortname && !isEmpty;

    previousShortnameRef.current = shortname;

    if (shouldReset) {
      setCourseData(null);
      setCurrentContent("");
      setContentCache(new Map());
      setError(null);
      setLoading(true);
    } else if (isSettingShortname) {
      // Don't reset - preserve existing courseData if it exists
      // Only set loading if we don't have data yet
      if (!courseData) {
        setLoading(true);
      }
    } else if (isEmpty) {
      setCourseData(null);
      setCurrentContent("");
      setContentCache(new Map());
      setError(null);
      setLoading(false);
    }

    // Respect initialPage only when we're loading structure (mount or shortname change)
    if (initialPage) {
      const parsedPage = parseInt(initialPage, 10);
      const pageIndex = isNaN(parsedPage) || parsedPage < 0 ? 0 : parsedPage;
      setCurrentPageIndex(pageIndex);
    } else if (shouldReset) {
      setCurrentPageIndex(0);
    }

    async function loadCourseStructure() {
      // Skip if shortname is empty or undefined
      if (!shortname || shortname.trim() === "") {
        if (isMounted) {
          setLoading(false);
          setError("Course shortname is required for streaming mode");
        }
        return;
      }

      try {
        if (isMounted) {
          setLoading(true);
          setError(null);
        }

        const structure = await fetchCourseStructure(shortname);

        if (!isMounted) {
          return;
        }

        setCourseData(structure);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError("Failed to load course. Please try again.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadCourseStructure();

    return () => {
      isMounted = false;
      setCourseData(null);
      setCurrentContent("");
      setContentCache(new Map());
      setError(null);
    };
  }, [shortname]); // Only shortname - do not re-fetch structure when initialPage (URL page param) changes

  /**
   * Load content for a specific page
   */
  const loadPageContent = useCallback(
    async (
      pageIndex: number,
      structure: StreamedCourseStructure | null = courseData,
    ) => {
      // Update page index first to ensure activity tabs update correctly
      setCurrentPageIndex(pageIndex);

      // If structure is not loaded yet, don't show error - wait for it to load
      if (
        !structure ||
        !structure.sections ||
        structure.sections.length === 0
      ) {
        // Don't set error content - let loading state handle this
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

      // Quiz/feedback without htmlFile: content is from structure only (no HTML to load)
      if (
        (section.type === "quiz" || section.type === "feedback") &&
        !section.htmlFile
      ) {
        setCurrentContent("");
        return;
      }

      if (!section.htmlFile) {
        setCurrentContent("<p>No content available for this section</p>");
        return;
      }

      try {
        let content = contentCache.get(section.htmlFile);

        if (!content) {
          content = await fetchHtmlContent(
            structure.server,
            structure.shortname,
            section.htmlFile,
          );

          // Cache the content
          if (content) {
            setContentCache((prev) => {
              const newCache = new Map(prev);
              newCache.set(section.htmlFile!, content!);
              return newCache;
            });
          }
        } else {}

        if (content) {
          setCurrentContent(content);

          prefetchNextPages(pageIndex, structure);
        } else {
          setCurrentContent(
            `<div style="padding: 2rem; font-family: system-ui;">
              <h2 style="color: #0891b2; margin-bottom: 1rem;">${
                section.title || "Untitled"
              }</h2>
              <p style="color: #ef4444;">Failed to load content. Please check your connection.</p>
            </div>`,
          );
        }
      } catch (err) {
        setCurrentContent(
          `<div style="padding: 2rem; font-family: system-ui;">
            <h2 style="color: #0891b2; margin-bottom: 1rem;">${
              section.title || "Untitled"
            }</h2>
            <p style="color: #ef4444;">Failed to load content. Please check your connection.</p>
          </div>`,
        );
      }
    },
    [courseData, contentCache],
  );

  /**
   * Prefetch next 2 pages in background
   */
  const prefetchNextPages = useCallback(
    async (currentIndex: number, structure: StreamedCourseStructure) => {
      const nextFiles: string[] = [];

      // Get next 2 HTML files
      for (let i = 1; i <= 2; i++) {
        const nextIndex = currentIndex + i;
        if (nextIndex < structure.sections.length) {
          const nextSection = structure.sections[nextIndex];
          if (nextSection.htmlFile && !contentCache.has(nextSection.htmlFile)) {
            nextFiles.push(nextSection.htmlFile);
          }
        }
      }

      if (nextFiles.length > 0) {
        try {
          const prefetchedCache = await prefetchHtmlFiles(
            structure.server,
            structure.shortname,
            nextFiles,
          );

          setContentCache((prev) => {
            const newCache = new Map(prev);
            prefetchedCache.forEach((content, file) => {
              newCache.set(file, content);
            });
            return newCache;
          });
        } catch (err) {}
      }
    },
    [contentCache],
  );

  const loadPage = useCallback(
    async (pageIndex: number) => {
      if (courseData) {
        await loadPageContent(pageIndex, courseData);
      }
    },
    [courseData, loadPageContent],
  );

  // Watch for initialPage changes from URL (when user clicks different activity)
  useEffect(() => {
    if (initialPage) {
      const parsedPage = parseInt(initialPage, 10);
      const pageIndex = isNaN(parsedPage) || parsedPage < 0 ? 0 : parsedPage;
      if (pageIndex !== currentPageIndex) {
        setCurrentPageIndex(pageIndex);
      }
    }
  }, [initialPage]); // Only depend on initialPage, not currentPageIndex to avoid loops

  // Load page content when courseData is available or currentPageIndex changes
  useEffect(() => {
    if (courseData && courseData.sections.length > 0) {
      loadPageContent(currentPageIndex, courseData);
    }
  }, [courseData, currentPageIndex, loadPageContent]);

  // Get current section's media files for streaming mode
  const currentMediaFiles =
    courseData?.sections?.[currentPageIndex]?.mediaFiles || [];

  // Get all course media files as fallback
  const allCourseMedia = courseData?.media || [];

  // Get server URL for asset resolution
  const serverUrl = courseData?.server || "";

  return {
    loading,
    courseData,
    currentContent,
    currentPageIndex,
    error,
    loadPage,
    setCurrentPageIndex,
    currentMediaFiles,
    allCourseMedia,
    serverUrl,
  };
}
