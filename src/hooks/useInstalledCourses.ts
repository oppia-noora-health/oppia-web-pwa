import { useState, useEffect } from "react";
import { getAllDownloadedCourses } from "@/utils/courseStorageIDB";
import { useAuthenticatedApi } from "@/hooks/useAuthenticatedApi";
import { fetchAllCoursesFromAPI } from "@/services/courseVersionService";

export interface InstalledCourse {
  courseId: string;
  shortname: string;
  version: number;
  downloadedAt: string;
  structure: any;
  downloadUrl?: string; // Added download URL for updates
  hasUpdate?: boolean; // Whether a newer version is available
  remoteVersion?: number; // Version from API
}

export const useInstalledCourses = () => {
  const api = useAuthenticatedApi();
  const [installedCourses, setInstalledCourses] = useState<InstalledCourse[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstalledCourses = async () => {
    try {
      setLoading(true);

      const courses = await getAllDownloadedCourses();

      // Fetch course list from /course/ API if online to check for updates
      if (navigator.onLine && api.isAuthenticated) {
        try {
          // Fetch all courses from /course/ API (maps to /api/v2/course/)
          const apiCourses = await fetchAllCoursesFromAPI();

          // Merge download URLs and check for updates
          const coursesWithUpdates = courses.map((course) => {
            // Find matching course in API response by ID or shortname
            const apiCourse = apiCourses.find(
              (c: any) =>
                c.id?.toString() === course.courseId ||
                c.shortname === course.shortname,
            );

            if (!apiCourse) {
              return {
                ...course,
                hasUpdate: false,
              };
            }

            // Get download URL
            const downloadUrl = apiCourse.url || apiCourse.download_url;

            // Compare versions
            const localVersionNum = Number(course.version);
            const remoteVersionNum = apiCourse.version
              ? Number(apiCourse.version)
              : localVersionNum;
            const hasUpdate =
              apiCourse.version !== undefined &&
              remoteVersionNum > localVersionNum;

            return {
              ...course,
              downloadUrl,
              hasUpdate,
              remoteVersion: apiCourse.version,
            };
          });

          setInstalledCourses(coursesWithUpdates);
        } catch (apiError) {
          // Still show courses even if API fails (from IndexedDB)

          setInstalledCourses(courses);
        }
      } else {
        // Offline: use IndexedDB courses as-is

        setInstalledCourses(courses);
      }

      setError(null);
    } catch (err) {
      // CRITICAL: If we have previously loaded courses, don't lose them on error
      // Only show error if we have no courses loaded at all
      if (installedCourses.length === 0) {
        setError("Failed to load installed courses");
      }
      // If we already have courses loaded, preserve them silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstalledCourses();
  }, []);

  // CRITICAL: Refetch courses when coming back online to ensure we show latest courses
  // This fixes the issue where courses disappear when network is restored
  useEffect(() => {
    const handleOnline = () => {
      // Only refetch if API is authenticated (user is logged in)
      if (api.isAuthenticated) {
        fetchInstalledCourses();
      }
    };

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [api.isAuthenticated]);

  const removeCourse = (courseId: string) => {
    setInstalledCourses((prev) => prev.filter((c) => c.courseId !== courseId));
  };

  return {
    installedCourses,
    loading,
    error,
    removeCourse,
    refetch: fetchInstalledCourses,
  };
};
