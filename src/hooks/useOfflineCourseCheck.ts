import { useState, useEffect } from "react";
import { loadCourseFromIDB } from "@/utils/courseLoaderIDB";
import type { CourseStructure } from "@/services/courseDownloadService";

interface OfflineCourseCheckResult {
  isDownloaded: boolean;
  courseData: CourseStructure | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to check if a course is available offline (downloaded in IndexedDB)
 * Used to determine if a course can be accessed when the app is offline
 */
export function useOfflineCourseCheck(
  courseId: string,
): OfflineCourseCheckResult {
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [courseData, setCourseData] = useState<CourseStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkOfflineAvailability = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!courseId || courseId === "undefined" || courseId === "null") {
          setError("Invalid course ID");
          setIsDownloaded(false);
          setLoading(false);
          return;
        }

        const course = await loadCourseFromIDB(courseId);

        if (course && course.structure) {
          setIsDownloaded(true);
          setCourseData(course.structure);
          setError(null);
        } else {
          setIsDownloaded(false);
          setCourseData(null);
          setError("Course not available offline");
        }
      } catch (err) {
        console.error("[useOfflineCourseCheck] Error checking course:", err);
        setError("Failed to check offline availability");
        setIsDownloaded(false);
        setCourseData(null);
      } finally {
        setLoading(false);
      }
    };

    checkOfflineAvailability();
  }, [courseId]);

  return {
    isDownloaded,
    courseData,
    loading,
    error,
  };
}
