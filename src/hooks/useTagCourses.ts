import { useState, useEffect } from "react";
import { useAuthenticatedApi } from "@/hooks/useAuthenticatedApi";
import { useCourseStore } from "@/store/useCourseStore";
import { useAuthStore } from "@/store/useStore";

export interface Course {
  id: number;
  shortname: string;
  title: Record<string, string | null>;
  description: Record<string, string | null>;
  version: number;
  url?: string;
  download_url?: string;
  resource_uri?: string;
  status?: string;
  author?: string;
  restricted?: boolean;
  priority?: number;
  organisation?: string;
  username?: string;
  cohorts?: number[];
}

export const useTagCourses = (tagId: string) => {
  const api = useAuthenticatedApi();
  const { courses: allCourses, setCourses } = useCourseStore();
  const user = useAuthStore((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tagCourses, setTagCourses] = useState<Course[]>([]);

  useEffect(() => {
    const fetchTagCourses = async () => {
      if (!api.isAuthenticated) return;

      setLoading(true);
      setError(null);

      try {
        const tagResponse = await api.get(`/tag/${tagId}/`);

        let coursesFromTag: Course[] = tagResponse.courses || [];

        // Filter out restricted courses unless the current user belongs to a cohort
        // listed on the course (in which case show it).
        if (
          user?.cohorts &&
          Array.isArray(user.cohorts) &&
          user.cohorts.length > 0
        ) {
          const userCohorts = user.cohorts.map((n) => Number(n));
          coursesFromTag = coursesFromTag.filter((c) => {
            if (!c.restricted) return true;
            if (
              !c.cohorts ||
              !Array.isArray(c.cohorts) ||
              c.cohorts.length === 0
            )
              return false;
            // Show restricted course only if any cohort matches user's cohorts
            return c.cohorts.some((cohort) =>
              userCohorts.includes(Number(cohort)),
            );
          });
        } else {
          // No user cohorts -> hide restricted courses
          coursesFromTag = coursesFromTag.filter((c) => !c.restricted);
        }

        if (coursesFromTag.length === 0) {
          setTagCourses([]);
          setLoading(false);
          return;
        }

        // Sort courses by ID
        const sortedCourses = coursesFromTag.sort((a, b) => a.id - b.id);

        setTagCourses(sortedCourses);

        // Cache these courses in the store for future use
        if (allCourses.length === 0) {
          setCourses(coursesFromTag);
        }
      } catch (err) {
        setError("Failed to load courses. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchTagCourses();
  }, [api, tagId, allCourses.length]);

  return {
    tagCourses,
    loading,
    error,
  };
};
