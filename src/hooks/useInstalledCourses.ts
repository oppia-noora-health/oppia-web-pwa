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
      console.log(
        "[useInstalledCourses] 📥 Fetching installed courses...",
        { isOnline: navigator.onLine, isAuthenticated: api.isAuthenticated }
      );

      const courses = await getAllDownloadedCourses();
      console.log("[useInstalledCourses] 📦 Downloaded courses from IDB:", {
        count: courses.length,
        courseIds: courses.map((c) => c.courseId),
        courses: courses,
      });

      // Fetch course list from /course/ API if online to check for updates
      if (navigator.onLine && api.isAuthenticated) {
        try {
          console.log("[useInstalledCourses] 🌐 Online & Authenticated - Fetching from API");
          // Fetch all courses from /course/ API (maps to /api/v2/course/)
          const apiCourses = await fetchAllCoursesFromAPI();
          console.log("[useInstalledCourses] ✅ API Courses fetched:", {
            count: apiCourses.length,
            courseIds: apiCourses.map((c: any) => c.id),
          });

          // Merge download URLs and check for updates
          const coursesWithUpdates = courses.map((course) => {
            // Find matching course in API response by ID or shortname
            const apiCourse = apiCourses.find(
              (c: any) =>
                c.id?.toString() === course.courseId ||
                c.shortname === course.shortname,
            );

            if (!apiCourse) {
              console.log(
                `[useInstalledCourses] ⚠️ Course ${course.courseId} not in API`
              );
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

            if (hasUpdate) {
              console.log(
                `[useInstalledCourses] 🔄 Update available for ${course.courseId}: ${localVersionNum} -> ${remoteVersionNum}`
              );
            }

            return {
              ...course,
              downloadUrl,
              hasUpdate,
              remoteVersion: apiCourse.version,
            };
          });

          console.log("[useInstalledCourses] ✅ Setting courses with updates:", {
            count: coursesWithUpdates.length,
          });
          setInstalledCourses(coursesWithUpdates);
        } catch (apiError) {
          console.error("[useInstalledCourses] ❌ API error:", apiError);
          // Still show courses even if API fails (from IndexedDB)
          console.log(
            "[useInstalledCourses] 🔄 Falling back to IDB courses only"
          );
          setInstalledCourses(courses);
        }
      } else {
        // Offline: use IndexedDB courses as-is
        console.log(
          "[useInstalledCourses] 📴 Offline or Not Authenticated - using IDB courses",
          { isOnline: navigator.onLine, isAuthenticated: api.isAuthenticated }
        );
        setInstalledCourses(courses);
      }

      console.log("[useInstalledCourses] ✅ Courses state updated:", {
        count: installedCourses.length,
      });
      setError(null);
    } catch (err) {
      console.error("[useInstalledCourses] 💥 Fatal error:", err);
      // CRITICAL: If we have previously loaded courses, don't lose them on error
      // Only show error if we have no courses loaded at all
      if (installedCourses.length === 0) {
        console.log("[useInstalledCourses] ⚠️ Setting error state - no courses to show");
        setError("Failed to load installed courses");
      } else {
        console.log(
          "[useInstalledCourses] ✅ Preserving existing courses despite error"
        );
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
      console.log("[useInstalledCourses] 🟢 ONLINE EVENT - Connection restored!");
      // Only refetch if API is authenticated (user is logged in)
      if (api.isAuthenticated) {
        console.log(
          "[useInstalledCourses] 🔄 User authenticated - Refetching courses"
        );
        fetchInstalledCourses();
      } else {
        console.log(
          "[useInstalledCourses] ⚠️ User not authenticated - Skipping refetch"
        );
      }
    };

    window.addEventListener("online", handleOnline);
    console.log("[useInstalledCourses] 👂 Registered 'online' event listener");
    return () => {
      window.removeEventListener("online", handleOnline);
      console.log("[useInstalledCourses] 👂 Removed 'online' event listener");
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
