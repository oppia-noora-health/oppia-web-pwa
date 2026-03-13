import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Course {
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

interface CourseStoreState {
  courses: Course[];
  lastFetched: number | null;
  setCourses: (courses: Course[]) => void;
  clearCache: () => void;
  isCacheValid: (maxAge?: number) => boolean;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useCourseStore = create<CourseStoreState>()(
  persist(
    (set, get) => ({
      courses: [],
      lastFetched: null,

      setCourses: (courses: Course[]) => {
        set({
          courses,
          lastFetched: Date.now(),
        });
      },

      clearCache: () => {
        set({
          courses: [],
          lastFetched: null,
        });
      },

      isCacheValid: (maxAge: number = CACHE_DURATION) => {
        const { lastFetched } = get();
        if (!lastFetched) return false;
        return Date.now() - lastFetched < maxAge;
      },
    }),
    {
      name: "course-cache-storage",
    }
  )
);
