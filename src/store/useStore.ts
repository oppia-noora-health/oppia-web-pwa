// store/useStore.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  LoginResponse,
  CoursePoint,
  CustomFields,
} from "@/services/authService";
import { accessLogService } from "@/services/accessLogService";

interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  email?: string;
  country?: string;
  language?: string;
  apiKey?: string;
  points?: number;
  badges?: number;
  coursePoints?: CoursePoint[];
  customFields?: CustomFields;
  cohorts?: number[];
  lastLogin?: string;
  resourceUri?: string;
}

// Course cache for temporary storage (online viewing)
export interface CachedCourse {
  id: string;
  structure: any;
  modules: any[];
  cachedAt: string;
  files: Map<string, string>; // filepath -> content
}

interface CourseState {
  cachedCourses: Map<string, CachedCourse>;
  setCachedCourse: (courseId: string, course: CachedCourse) => void;
  getCachedCourse: (courseId: string) => CachedCourse | null;
  clearCachedCourse: (courseId: string) => void;
  clearAllCachedCourses: () => void;
}

// Download Progress State
export type DownloadPhase =
  | "idle"
  | "downloading"
  | "installing"
  | "complete"
  | "error";

export interface DownloadProgress {
  courseId: string;
  phase: DownloadPhase;
  progress: number; // 0-100
  message: string;
  error?: string;
}

interface DownloadState {
  downloads: Map<string, DownloadProgress>;
  setDownloadProgress: (courseId: string, progress: DownloadProgress) => void;
  getDownloadProgress: (courseId: string) => DownloadProgress | null;
  clearDownloadProgress: (courseId: string) => void;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (loginResponse: LoginResponse) => void;
  logout: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
}

// Download Progress Store (in-memory, not persisted)
export const useDownloadStore = create<DownloadState>()((set, get) => ({
  downloads: new Map(),

  setDownloadProgress: (courseId: string, progress: DownloadProgress) => {
    set((state) => {
      const newDownloads = new Map(state.downloads);
      newDownloads.set(courseId, progress);
      return { downloads: newDownloads };
    });
  },

  getDownloadProgress: (courseId: string) => {
    const downloads = get().downloads;
    return downloads.get(courseId) || null;
  },

  clearDownloadProgress: (courseId: string) => {
    set((state) => {
      const newDownloads = new Map(state.downloads);
      newDownloads.delete(courseId);
      return { downloads: newDownloads };
    });
  },
}));

// Course Cache Store (in-memory, not persisted)
export const useCourseStore = create<CourseState>()((set, get) => ({
  cachedCourses: new Map(),

  setCachedCourse: (courseId: string, course: CachedCourse) => {
    set((state) => {
      const newCache = new Map(state.cachedCourses);
      newCache.set(courseId, course);
      return { cachedCourses: newCache };
    });
  },

  getCachedCourse: (courseId: string) => {
    const cache = get().cachedCourses;
    return cache.get(courseId) || null;
  },

  clearCachedCourse: (courseId: string) => {
    set((state) => {
      const newCache = new Map(state.cachedCourses);
      newCache.delete(courseId);
      return { cachedCourses: newCache };
    });
  },

  clearAllCachedCourses: () => {
    set({ cachedCourses: new Map() });
  },
}));

// Auth Store with persistence using localStorage
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Start with no user - user must login
      user: null,
      isAuthenticated: false,

      /* FOR TESTING ONLY - Default logged in state with mock user
      user: DEFAULT_MOCK_USER,
      isAuthenticated: true,
      */

      login: async (loginResponse: LoginResponse) => {
        // Extract user ID from resource_uri (format: /api/v2/user/123/)
        const extractUserId = (resourceUri: string): string => {
          const match = resourceUri.match(/\/user\/(\d+)\/?$/);
          return match ? match[1] : "0";
        };

        const user: User = {
          id: extractUserId(loginResponse.resource_uri),
          username: loginResponse.username,
          firstName: loginResponse.first_name,
          lastName: loginResponse.last_name,
          phoneNumber: loginResponse.phone_number,
          email: loginResponse.email,
          country: loginResponse.custom_fields.Country,
          language: loginResponse.custom_fields.Language,
          apiKey: loginResponse.api_key,
          points: loginResponse.points,
          badges: loginResponse.badges,
          coursePoints: loginResponse.course_points,
          customFields: loginResponse.custom_fields,
          cohorts: loginResponse.cohorts,
          lastLogin: loginResponse.last_login,
          resourceUri: loginResponse.resource_uri,
        };

        // Store full user data in localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem(
            "auth-storage",
            JSON.stringify({
              state: {
                user,
                isAuthenticated: true,
              },
              version: 0,
            }),
          );
        }

        set({ user, isAuthenticated: true });

        void accessLogService.log(
          {
            event: "login",
            user: {
              userId: user.id,
              username: user.username,
              phoneNumber: loginResponse.phone_number,
            },
            pageName: "/login",
            activityType: "auth",
            details: {
              country: loginResponse.custom_fields?.Country ?? null,
              language: loginResponse.custom_fields?.Language ?? null,
              lastLogin: loginResponse.last_login ?? null,
            },
          },
          true,
        );

        // Copy guest settings to user so they keep pre-login preferences
        if (typeof window !== "undefined" && user.id) {
          const { migrateGuestSettingsToUser } =
            await import("@/utils/settingsStorage");
          const userId =
            typeof user.id === "string" ? user.id : String(user.id);
          migrateGuestSettingsToUser(userId);
        }

        // Create login tracker
        if (user.id) {
          try {
            const userId =
              typeof user.id === "string" ? parseInt(user.id) : user.id;
            const { createLoginTracker } =
              await import("@/services/trackerSubmission");
            await createLoginTracker(userId);
          } catch (error) {}
        }

        // Pre-cache settings, privacy policy, about/help for offline access (fire-and-forget)
        if (typeof window !== "undefined") {
          import("@/utils/pageCaching")
            .then(({ preCacheStaticPagesOnLogin }) =>
              preCacheStaticPagesOnLogin(),
            )
            .catch((err) => void 0);
        }
      },

      logout: async () => {
        // Get user ID before clearing state (needed to clear user-scoped settings)
        const currentUser = get().user;
        const userId = currentUser?.id?.toString();

        void accessLogService.log(
          {
            event: "logout",
            user: {
              userId: currentUser?.id ?? null,
              username: currentUser?.username ?? null,
              phoneNumber:
                (currentUser as any)?.phoneNumber ??
                (currentUser as any)?.phoneNo ??
                null,
            },
            pageName: "/logout",
            activityType: "auth",
            details: {
              source: "useAuthStore.logout",
            },
          },
          true,
        );

        set({ user: null, isAuthenticated: false });

        // Clear all storage, cache, and IndexedDB data
        if (typeof window !== "undefined") {
          // 1. Clear ALL localStorage, then restore only the custom API URL
          const preservedApiUrl = localStorage.getItem("custom_api_url");
          localStorage.clear();
          if (preservedApiUrl) {
            localStorage.setItem("custom_api_url", preservedApiUrl);
          }

          // 2. Clear all Zustand stores (course cache, completion, points, cached courses)
          try {
            // Clear course list cache (from useCourseStore.ts)
            const { useCourseStore: useCourseListStore } =
              await import("@/store/useCourseStore");
            useCourseListStore.getState().clearCache();

            // Clear cached courses (from useStore.ts - defined in this file)
            useCourseStore.getState().clearAllCachedCourses();

            const { useActivityCompletionStore } =
              await import("@/store/useStore");
            useActivityCompletionStore.getState().clearAllCompletionData();

            const { useGamificationPointsStore } =
              await import("@/store/useStore");
            useGamificationPointsStore.getState().clearPoints();
          } catch (error) {}

          // 3. Clear all IndexedDB data
          try {
            // Clear gamification data (IndexedDB)
            const { clearAllGamificationData } =
              await import("@/utils/gamificationIDB");
            await clearAllGamificationData();

            // Clear all courses from IndexedDB
            const { deleteAllCoursesFromIDB } =
              await import("@/utils/courseStorageIDB");
            await deleteAllCoursesFromIDB();

            // Clear offline data (IndexedDB)
            const { clearOfflineData } =
              await import("@/utils/offlineStorageIDB");
            await clearOfflineData();
          } catch (error) {}

          // 4. Clear Cache Storage (media + page cache used for offline static pages + API cache)
          try {
            const { clearMediaCache } =
              await import("@/utils/mediaCacheStorage");
            await clearMediaCache();

            // Clear ALL app caches (including service worker caches for different URLs)
            if ("caches" in window) {
              const cacheNames = await caches.keys();
              await Promise.all(
                cacheNames
                  .filter((name) => name.startsWith("noora-"))
                  .map((name) => caches.delete(name)),
              );
            }
          } catch (error) {}

          // 5. Clear localStorage-based data
          try {
            // Clear pre-test attempts
            const { clearAllPreTestAttempts } =
              await import("@/utils/preTestStorage");
            clearAllPreTestAttempts();

            // Clear last visited activities
            const { clearAllLastVisitedActivities } =
              await import("@/utils/lastActivityStorage");
            clearAllLastVisitedActivities();
          } catch (error) {}
        }
      },

      updateUser: (updatedUser: Partial<User>) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updatedUser } : null,
        }));
      },
    }),
    {
      name: "auth-storage",
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Fix: Extract user ID from resourceUri if id is missing (for existing users)
          if (state.user && !state.user.id && state.user.resourceUri) {
            const match = state.user.resourceUri.match(/\/user\/(\d+)\/?$/);
            if (match) {
              state.user.id = match[1];
            }
          }
        }
      },
    },
  ),
);

// Activity Completion Store (stores completion status per course)
// Uses plain objects instead of Map for persistence compatibility
interface ActivityCompletionStore {
  // Record of courseId -> Record of digest -> completion status
  completionData: Record<string, Record<string, boolean>>;

  setCompletionData: (
    courseId: string,
    completionMap: Map<string, boolean>,
  ) => void;
  getCompletionData: (courseId: string) => Map<string, boolean> | null;
  clearCompletionData: (courseId: string) => void;
  clearAllCompletionData: () => void;
}

export const useActivityCompletionStore = create<ActivityCompletionStore>()(
  persist(
    (set, get) => ({
      completionData: {},

      setCompletionData: (
        courseId: string,
        completionMap: Map<string, boolean>,
      ) => {
        set((state) => {
          // Convert Map to plain object for persistence
          const completionObject = Object.fromEntries(completionMap);

          return {
            completionData: {
              ...state.completionData,
              [courseId]: completionObject,
            },
          };
        });
      },

      getCompletionData: (courseId: string) => {
        const data = get().completionData;
        const courseData = data[courseId];
        const completedCount = courseData
          ? Object.values(courseData).filter(Boolean).length
          : 0;
        const totalCount = courseData ? Object.keys(courseData).length : 0;

        // Convert plain object back to Map
        return courseData ? new Map(Object.entries(courseData)) : null;
      },

      clearCompletionData: (courseId: string) => {
        set((state) => {
          const newData = { ...state.completionData };
          delete newData[courseId];
          return { completionData: newData };
        });
      },

      clearAllCompletionData: () => {
        set({ completionData: {} });
      },
    }),
    {
      name: "activity-completion-storage",
    },
  ),
);

// Gamification Points Store (shared across all components, persisted)
interface GamificationPointsStore {
  userPoints: number;
  userBadges: number;
  setPoints: (points: number, badges: number) => void;
  clearPoints: () => void;
}

export const useGamificationPointsStore = create<GamificationPointsStore>()(
  persist(
    (set) => ({
      userPoints: 0,
      userBadges: 0,
      setPoints: (points: number, badges: number) => {
        set({ userPoints: points, userBadges: badges });
      },
      clearPoints: () => {
        set({ userPoints: 0, userBadges: 0 });
      },
    }),
    {
      name: "gamification-points-storage",
    },
  ),
);

// Pending Toast Store (in-memory, not persisted)
// Bridges the gap between /course/[id]/view and /course/[id] across navigation.
// view/page triggers tracking, writes here, then navigates.
// /course/[id]/page reads here on mount and shows the toast.
export interface PendingToast {
  activityTitle: string;
  courseTitle: string;
  points: number;
}

interface PendingToastState {
  pendingToast: PendingToast | null;
  setPendingToast: (toast: PendingToast) => void;
  clearPendingToast: () => void;
}

export const usePendingToastStore = create<PendingToastState>()((set) => ({
  pendingToast: null,
  setPendingToast: (toast) => set({ pendingToast: toast }),
  clearPendingToast: () => set({ pendingToast: null }),
}));
