"use client";

import {
  useAuthStore,
  useCourseStore as useCourseCacheStore,
  useActivityCompletionStore,
} from "@/store/useStore";
import {
  useRouter,
  useParams,
  useSearchParams,
  usePathname,
} from "next/navigation";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { PageLoading } from "@/components/Loading";
import QuizRenderer from "@/components/QuizRenderer";
import FeedbackRenderer from "@/components/FeedbackRenderer";
import HtmlContentRenderer from "@/components/HtmlContentRenderer";
import CourseHeader from "@/components/course/CourseHeader";
import ActivityTabs from "@/components/course/ActivityTabs";
import CourseNavigation from "@/components/course/CourseNavigation";
import MediaDownloadDialog from "@/components/course/MediaDownloadDialog";

import LockedActivityDialog from "@/components/course/LockedActivityDialog";
import SectionPasswordDialog from "@/components/course/SectionPasswordDialog";
import {
  isSectionUnlocked,
  unlockSection,
} from "@/utils/sectionPasswordStorage";
import { useCourseToast } from "@/contexts/CourseToastContext";
import {
  BadgeAwardedToast,
  BadgeType,
} from "@/components/course/BadgeAwardedToast";
import { useCourseData } from "@/hooks/useCourseData";
import { useCourseStreaming } from "@/hooks/useCourseStreaming";
import { useMediaDownload } from "@/hooks/useMediaDownload";
import { useActivityNavigation } from "@/hooks/useActivityNavigation";
import { useGamification } from "@/hooks/useGamification";
import { BackButton } from "@/components/ui/back-button";
import { loadCourseFromIDB } from "@/utils/courseLoaderIDB";
import { OfflineError } from "@/components/OfflineError";
import { useTour } from "@/hooks/useTour";
import { getCourseViewerTour } from "@/config/tourSteps";
import { cachePageWithDependencies } from "@/utils/pageCaching";
import { useCourseSwipeNavigation } from "@/hooks/useCourseSwipeNavigation";
import { saveLastVisitedActivity } from "@/utils/lastActivityStorage";
import { getLocalizedText } from "@/utils/localization";
import {
  executeWithRetry,
  validatePersistence,
  raceDetector,
} from "@/utils/persistenceErrorHandler";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  hasAttemptedPreTest,
  markPreTestAttempted,
  isPreTestTitle,
  isPreTestCompleted,
} from "@/utils/preTestStorage";
import {
  shouldAwardPoints,
  markCompletedToday,
  wasCompletedToday,
  getTodayDateKey,
  getDailyCompletionKey,
} from "@/utils/dailyCompletionTracker";
import { activityTrackingService } from "@/services/activityTrackingService";
import { DEFAULT_GAMIFICATION_CONFIG } from "@/types/gamification";
import { getMediaTracker } from "@/utils/gamificationIDB";

import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Home,
  Trophy,
  Star,
  Download,
  User,
  Settings,
  Lock,
  Info,
  LogOut,
  RefreshCw,
} from "lucide-react";
import Image from "next/image";
import { useTranslation } from "@/hooks/useTranslation";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { useZustandRehydration } from "@/hooks/useZustandRehydration";

// Navigation sections structure
interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  route: string;
  id?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const getNavigationSections = (t: (key: string) => string): NavSection[] => [
  {
    label: t("navigation.home").toUpperCase(),
    items: [
      {
        icon: Home,
        label: t("navigation.home"),
        route: "/course",
        id: "home-nav",
      },
      {
        icon: Trophy,
        label: t("navigation.scoreboard"),
        route: "/scoreboard",
        id: "scorecard-nav",
      },
      {
        icon: Star,
        label: t("navigation.points"),
        route: "/points",
        id: "points-nav",
      },
    ],
  },
  {
    label: t("course.courses").toUpperCase(),
    items: [
      {
        icon: Download,
        label: t("navigation.downloadCourses"),
        route: "/course-management",
        id: "download-courses-nav",
      },
    ],
  },
  {
    label: "MORE",
    items: [
      { icon: User, label: t("navigation.profile"), route: "/profile" },
      { icon: Settings, label: t("navigation.settings"), route: "/settings" },
      { icon: Lock, label: t("navigation.privacy"), route: "/privacy-policy" },
      { icon: Info, label: t("navigation.aboutHelp"), route: "/about-help" },
    ],
  },
];

const getWordCountFromHtml = (html: string): number => {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return 0;
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,noscript").forEach((el) => el.remove());
  const text = doc.body?.textContent ?? "";
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return 0;
  return normalized.split(" ").length;
};

// Sidebar component for course viewer page
function CourseViewerSidebar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, updateUser } = useAuthStore();
  const courseCacheStore = useCourseCacheStore(); // This is from useStore.ts (has getCachedCourse)
  const { userPoints } = useGamification();
  const { t } = useTranslation();
  const { pendingCount } = useSyncStatus();

  const navigationSections = getNavigationSections(t);

  const handleNavClick = (route: string) => {
    onOpenChange(false);
    router.push(route);
  };

  const handleLogout = async () => {
    onOpenChange(false);
    // Logout function now handles all cleanup (cache, IndexedDB, localStorage, etc.)
    await logout();
    router.push("/login");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-74 p-0 overflow-y-auto bg-sidebar text-sidebar-foreground">
        {/* Header with Logo and User Info */}
        <SidebarHeader className="border-b p-6">
          <div className="flex items-center gap-3 mb-6">
            <Image
              src="/logo/logo-icon.svg"
              alt="Noora Academy Logo"
              width={48}
              height={48}
              className="object-contain"
            />
            <div>
              <h1 className="text-xl font-semibold text-black">Noora</h1>
              <p className="text-gray-600">Learning Platform</p>
            </div>
          </div>

          {/* User Info Card */}
          <div className="bg-secondary-300 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-linear-to-br from-[#00D5BE] to-[#00B8DB] flex items-center justify-center text-2xl">
              😊
            </div>
            <div className="flex-1">
              <p className="text-black text-lg">{user?.firstName || "User"}</p>
              <p className="text-sm text-gray-600">
                {((userPoints || 0) + (user?.points || 0)).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Sync Status Indicator */}
          {pendingCount > 0 && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
              <RefreshCw className="w-4 h-4 text-amber-600" />
              <span className="text-amber-700">
                {pendingCount} {pendingCount === 1 ? "change" : "changes"}{" "}
                pending sync
              </span>
            </div>
          )}
        </SidebarHeader>

        {/* Navigation Content */}
        <SidebarContent className="px-4 py-6">
          {navigationSections.map((section, sectionIndex) => (
            <SidebarGroup key={sectionIndex}>
              <SidebarGroupLabel className="text-xs font-bold text-gray-500 mb-3 px-3">
                {section.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => {
                    const isActive = pathname === item.route;
                    const Icon = item.icon;

                    return (
                      <SidebarMenuItem key={item.route}>
                        <SidebarMenuButton
                          id={item.id}
                          onClick={() => handleNavClick(item.route)}
                          className={`
                            w-full h-12 cursor-pointer px-4 rounded-xl flex items-center gap-3
                            transition-all duration-200
                            ${
                              isActive
                                ? "bg-primary-500 text-white hover:bg-primary-500 hover:text-white"
                                : "hover:bg-primary-500 hover:text-white"
                            }
                          `}>
                          <Icon className="w-5 h-5" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        {/* Footer with Logout */}
        <SidebarFooter className="border-t p-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleLogout}
                className="w-full max-w-[200px] h-12 px-4 rounded-xl flex items-center gap-3 text-red-500 hover:bg-red-50 transition-all duration-200">
                <LogOut className="w-5 h-5" />
                <span className="text-base font-medium">
                  {t("auth.logout")}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </SheetContent>
    </Sheet>
  );
}

export default function CourseViewerPage() {
  const { user, isAuthenticated } = useAuthStore();
  const { getCompletionData, setCompletionData } = useActivityCompletionStore();
  const isZustandRehydrated = useZustandRehydration();
  const courseCacheStore = useCourseCacheStore(); // Initialize cache store
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const courseId = params?.id as string;
  const initialPage = searchParams?.get("page");
  const mode = searchParams?.get("mode"); // "streaming" or undefined
  const shortnameParam = searchParams?.get("shortname");
  const tagId = searchParams?.get("tagId");
  const tagName = searchParams?.get("tagName");
  const sourceFrom = searchParams?.get("from");
  const pretestDoneParam = searchParams?.get("pretestDone"); // "1" = done, "0" = not done, null = unknown

  // ── DIAGNOSTIC: raw URL vs parsed searchParams ──
  const _rawUrl = typeof window !== "undefined" ? window.location.href : "SSR";
  const _rawSearch =
    typeof window !== "undefined" ? window.location.search : "SSR";
  console.log(`[FLOW-1] 🔍 Viewer mount — rawURL: ${_rawUrl}`);
  console.log(
    `[FLOW-2] 🔍 Viewer searchParams — page: "${initialPage}", mode: "${mode}", shortname: "${shortnameParam}", pretestDone: "${pretestDoneParam}", rawSearch: "${_rawSearch}"`,
  );

  // Determine if we should use streaming mode
  const [useStreaming, setUseStreaming] = useState(false);
  const [checkingMode, setCheckingMode] = useState(true);
  const [streamingShortname, setStreamingShortname] = useState<string | null>(
    shortnameParam,
  );

  // Tour setup - Course Viewer page (one-time only)
  const { startTour, hasCompletedTour } = useTour("course-viewer");

  // Check if course is downloaded (to determine mode)
  useEffect(() => {
    async function determineMode() {
      console.log(
        `[FLOW-3] 🔍 determineMode start — mode: "${mode}", shortnameParam: "${shortnameParam}", online: ${navigator.onLine}`,
      );
      if (mode === "streaming" && shortnameParam) {
        console.log(`[FLOW-3a] ➡️ determineMode → streaming mode`);
        setStreamingShortname(shortnameParam);
        setUseStreaming(true);
        setCheckingMode(false);
        return;
      }

      if (mode === "streaming" && !shortnameParam) {
        setUseStreaming(false);
        setCheckingMode(false);
        return;
      }

      try {
        const idbCourse = await loadCourseFromIDB(courseId);

        if (idbCourse) {
          console.log(
            `[FLOW-3b] ➡️ determineMode → IDB mode (downloaded course found)`,
          );
          setUseStreaming(false);
          setCheckingMode(false);
        } else {
          if (shortnameParam) {
            setStreamingShortname(shortnameParam);
            setUseStreaming(true);
            setCheckingMode(false);
          } else {
            // CRITICAL: Check if offline BEFORE trying API
            if (typeof navigator !== "undefined" && !navigator.onLine) {
              console.log("[CourseViewer] Offline - checking cache only");
              const cachedCourse = useCourseCacheStore
                .getState()
                .getCachedCourse(courseId);

              if (cachedCourse?.structure?.shortname) {
                setStreamingShortname(cachedCourse.structure.shortname);
                setUseStreaming(true);
              } else {
                setUseStreaming(false);
              }
              setCheckingMode(false);
              return;
            }

            try {
              const response = await fetch(`/api/course/${courseId}/`);

              if (response.ok) {
                const courseInfo = await response.json();

                if (courseInfo.shortname) {
                  setStreamingShortname(courseInfo.shortname);
                  setUseStreaming(true);
                } else {
                  setUseStreaming(false);
                }
              } else {
                // CRITICAL: If API fails, check cached course structure for shortname
                // This handles cases where course was previously streamed
                const cachedCourse = useCourseCacheStore
                  .getState()
                  .getCachedCourse(courseId);

                if (cachedCourse?.structure?.shortname) {
                  setStreamingShortname(cachedCourse.structure.shortname);
                  setUseStreaming(true);
                } else {
                  setUseStreaming(false);
                }
              }
            } catch (apiError) {
              // CRITICAL: On exception, also check cached course structure
              try {
                const cachedCourse = useCourseCacheStore
                  .getState()
                  .getCachedCourse(courseId);

                if (cachedCourse?.structure?.shortname) {
                  setStreamingShortname(cachedCourse.structure.shortname);
                  setUseStreaming(true);
                } else {
                  setUseStreaming(false);
                }
              } catch (cacheError) {
                setUseStreaming(false);
              }
            }
            setCheckingMode(false);
          }
        }
      } catch (error) {
        // On error, check cache first before trying API (especially when offline)
        if (!shortnameParam) {
          // Check cache first
          const cachedCourse = useCourseCacheStore
            .getState()
            .getCachedCourse(courseId);

          if (cachedCourse?.structure?.shortname) {
            setStreamingShortname(cachedCourse.structure.shortname);
            setUseStreaming(true);
            setCheckingMode(false);
            return;
          }

          // Only try API if online
          if (typeof navigator !== "undefined" && navigator.onLine) {
            try {
              const response = await fetch(`/api/course/${courseId}/`);
              if (response.ok) {
                const courseInfo = await response.json();
                if (courseInfo.shortname) {
                  setStreamingShortname(courseInfo.shortname);
                  setUseStreaming(true);
                } else {
                  setUseStreaming(false);
                }
              } else {
                setUseStreaming(false);
              }
            } catch (apiError) {
              setUseStreaming(false);
            }
          } else {
            // Offline and no cache = can't determine streaming
            setUseStreaming(false);
          }
        } else {
          setStreamingShortname(shortnameParam);
          setUseStreaming(true);
        }
        setCheckingMode(false);
      }
    }

    determineMode();
  }, [courseId, mode, shortnameParam]);

  // Cleanup: Reset streaming state when component unmounts
  useEffect(() => {
    return () => {
      setStreamingShortname(null);
      setUseStreaming(false);
    };
  }, []);

  const {
    loading: downloadedLoading,
    courseData: downloadedCourseData,
    currentPageIndex: downloadedPageIndex,
    currentContent: downloadedContent,
    error: downloadedError,
    courseSource,
    downloading,
    loadPageContent,
    loadPageContentFromIDB,
    setCurrentPageIndex: setDownloadedPageIndex,
  } = useCourseData(courseId, initialPage, {
    skipDownload: useStreaming,
    disabled: checkingMode,
  });
  console.log(
    `[FLOW-5] 📦 useCourseData returned — downloadedPageIndex: ${downloadedPageIndex}, downloadedLoading: ${downloadedLoading}, courseSource: "${courseSource}", checkingMode: ${checkingMode}, useStreaming: ${useStreaming}`,
  );

  const {
    loading: streamingLoading,
    courseData: streamedCourseData,
    currentContent: streamedContent,
    currentPageIndex: streamedPageIndex,
    error: streamingError,
    loadPage: loadStreamedPage,
    setCurrentPageIndex: setStreamedPageIndex,
    currentMediaFiles: streamingMediaFiles,
    allCourseMedia: streamingAllMedia,
    serverUrl: streamingServerUrl,
  } = useCourseStreaming(streamingShortname || "", initialPage);

  // CRITICAL: If streamed data exists but useStreaming is false, enable streaming mode
  // This handles cases where determineMode failed but useCourseStreaming has data
  // This runs AFTER hooks are initialized so we can access streamedCourseData
  useEffect(() => {
    if (!checkingMode && !useStreaming && streamedCourseData?.shortname) {
      setStreamingShortname(streamedCourseData.shortname);
      setUseStreaming(true);
    }
  }, [checkingMode, useStreaming, streamedCourseData]);

  // Use the appropriate data based on mode
  const loading = useStreaming ? streamingLoading : downloadedLoading;
  const rawCourseData = useStreaming
    ? streamedCourseData
    : downloadedCourseData;
  const currentContent = useStreaming ? streamedContent : downloadedContent;
  const currentPageIndex = useStreaming
    ? streamedPageIndex
    : downloadedPageIndex;
  const error = useStreaming ? streamingError : downloadedError;

  const gamificationConfig = useMemo(() => {
    const courseConfig = (rawCourseData as any)?.gamificationConfig;
    return courseConfig
      ? { ...DEFAULT_GAMIFICATION_CONFIG, ...courseConfig }
      : DEFAULT_GAMIFICATION_CONFIG;
  }, [rawCourseData]);

  // Immediate detection of slides from raw HTML string—no DOM or script execution needed.
  // This provides an instant signal before HtmlContentRenderer's async detection completes.
  const htmlHasSlides = useMemo(() => {
    if (typeof currentContent !== "string" || !currentContent) return false;
    const slideCount = (currentContent.match(/<slide[\s>]/gi) || []).length;
    return slideCount > 1 || currentContent.toLowerCase().includes("<slides");
  }, [currentContent]);

  const currentWordCount = useMemo(() => {
    return typeof currentContent === "string"
      ? getWordCountFromHtml(currentContent)
      : 0;
  }, [currentContent]);

  // Detect if current activity has PDF links (requires user to open PDF for completion)
  const hasPdfContent = useMemo(() => {
    if (typeof currentContent !== "string") return false;
    // Match <a> tags pointing to .pdf files or resources/ paths
    return (
      /href=["'][^"']*\.pdf/i.test(currentContent) ||
      /href=["'][^"']*resources\//i.test(currentContent)
    );
  }, [currentContent]);

  const getRequiredTimeForCompletion = useCallback(
    (section: { activityTime?: number } | null, wordCount: number): number => {
      const baseTime =
        section?.activityTime ??
        gamificationConfig.PAGE_COMPLETED_TIME_SPENT ??
        3;

      if (gamificationConfig.PAGE_COMPLETED_METHOD === "WPM") {
        const safeWpm =
          gamificationConfig.PAGE_COMPLETED_WPM > 0
            ? gamificationConfig.PAGE_COMPLETED_WPM
            : DEFAULT_GAMIFICATION_CONFIG.PAGE_COMPLETED_WPM;
        if (wordCount > 0) {
          const requiredTime = Math.ceil((wordCount * 60) / safeWpm);
          console.log(
            `[⏱️ TIME-THRESHOLD] METHOD=WPM words=${wordCount}, required=${requiredTime}s, wpm=${safeWpm}, activityTime=${section?.activityTime}, baseTime=${baseTime}`,
          );
          return requiredTime;
        }
      }

      console.log(
        `[⏱️ TIME-THRESHOLD] METHOD=TIME_SPENT words=${wordCount}, required=${baseTime}s, activityTime=${section?.activityTime}, baseTime=${baseTime}`,
      );
      return baseTime;
    },
    [gamificationConfig],
  );

  // Log content being displayed for debugging
  useEffect(() => {
    if (!loading && currentContent) {
      const section = rawCourseData?.sections?.[currentPageIndex];
      console.log(
        `[FLOW-6] 📄 FINAL RENDER — currentPageIndex: ${currentPageIndex}, initialPage: "${initialPage}", useStreaming: ${useStreaming}, sectionTitle: "${section?.title || section?.sectionTitle || "unknown"}", sectionType: "${section?.type}", totalSections: ${rawCourseData?.sections?.length}`,
      );
    } else if (!loading && !currentContent) {
    } else {
    }
  }, [
    currentContent,
    currentPageIndex,
    loading,
    useStreaming,
    courseSource,
    rawCourseData,
    streamedCourseData,
    downloadedCourseData,
    error,
    mode,
    shortnameParam,
    streamingShortname,
  ]);

  // Filter out quiz/feedback activities that have no questions (memoized to prevent infinite loops)
  const courseData = useMemo(() => {
    if (!rawCourseData) return null;

    return {
      ...rawCourseData,
      sections: rawCourseData.sections?.filter((section) => {
        // Keep non-quiz/feedback sections
        if (section.type !== "quiz" && section.type !== "feedback") {
          return true;
        }

        // For quiz/feedback, check if they have valid questions
        const data = section.quizData || (section as any)?.content;
        const hasQuestions = data?.questions && data.questions.length > 0;

        if (!hasQuestions) {
        }

        return hasQuestions;
      }),
    };
  }, [rawCourseData]);

  const {
    missingMedia,
    showMediaPrompt,
    setShowMediaPrompt,
    downloadingMedia,
    mediaDownloadProgress,
    handleDownloadMedia,
  } = useMediaDownload(courseId, courseSource);

  const {
    currentLessonActivities,
    currentActivityIndexInLesson,
    setCurrentActivityIndexInLesson,
  } = useActivityNavigation(courseData, currentPageIndex);

  // Gamification hooks
  const {
    trackActivityCompleted,
    trackQuizAttempt,
    trackFeedback,
    trackMediaPlayback,
    refreshPoints,
  } = useGamification();

  // Toast notifications are handled by the shared CourseToastProvider in layout.tsx
  const { triggerToast } = useCourseToast();

  const [activityStartTime, setActivityStartTime] = useState<number>(
    Date.now(),
  );

  // ── Multi-media tracking ──
  // Stores ALL pending media data keyed by decoded filename.
  // Updated by onVideoTracking / onAudioTracking; cleared per-file when tracked.
  const pendingMediaMapRef = useRef<
    Map<
      string,
      {
        filename: string;
        timeWatched: number;
        duration: number;
        mediaType: "video" | "audio";
      }
    >
  >(new Map());

  // Which media filenames have reached ≥80% threshold.
  // Activity completion is gated on ALL media in the section being in this Set.
  const mediaPlayedSetRef = useRef<Set<string>>(new Set());

  // Which media filenames have been tracked (points awarded) at 100% completion.
  // Prevents double-tracking on Next click for media already tracked immediately.
  const mediaTrackedSetRef = useRef<Set<string>>(new Set());

  // PDF open tracking — set to true when user clicks a PDF link on current page
  const pdfOpenedRef = useRef<boolean>(false);

  // ── Multi-media helpers ──
  /** Find the correct media file digest by matching filename to section.mediaFiles */
  const findMediaDigestByFilename = (
    section: any,
    filename: string,
  ): string => {
    const mediaFiles = section?.mediaFiles || section?.media || [];
    const decoded = decodeURIComponent(filename);
    for (const mf of mediaFiles) {
      const mfDecoded = decodeURIComponent(mf.filename || "");
      if (mfDecoded === decoded || mf.filename === filename) {
        return mf.digest || "";
      }
    }
    // Fallback: first media file's digest (backward compat)
    return mediaFiles.length > 0 ? mediaFiles[0].digest || "" : "";
  };

  /** Check if ALL media files in the section have been played ≥80% */
  const isAllMediaPlayed = (section: any): boolean => {
    const mediaFiles = section?.mediaFiles || section?.media || [];
    if (mediaFiles.length === 0) return true;
    return mediaFiles.every((mf: any) => {
      const decoded = decodeURIComponent(mf.filename || "");
      return (
        mediaPlayedSetRef.current.has(decoded) ||
        mediaPlayedSetRef.current.has(mf.filename || "")
      );
    });
  };

  /**
   * Track all untracked pending media and return whether any media toast was shown.
   * Used by trackCurrentActivityBeforeLeaving, handleNextPage, and last-activity code.
   */
  const trackAllPendingMedia = async (section: any): Promise<boolean> => {
    let mediaToastShown = false;
    if (!courseData || !section?.digest) return mediaToastShown;

    const course = {
      id: parseInt(courseId, 10) || 0,
      shortname: streamingShortname || courseData.shortname || "",
      version: courseData.version || 1,
    };
    const activity = {
      digest: section.digest || "",
      title: section.sectionTitle || section.title || "Media",
    };

    // Iterate all pending media that haven't been tracked yet
    for (const [key, data] of pendingMediaMapRef.current.entries()) {
      if (mediaTrackedSetRef.current.has(key)) continue; // already tracked at 100%

      const pct =
        data.duration > 0 ? (data.timeWatched / data.duration) * 100 : 0;
      const mediaFileDigest = findMediaDigestByFilename(section, data.filename);

      try {
        const result = await trackMediaPlayback(
          course,
          activity,
          data.filename,
          data.timeWatched,
          data.duration,
          data.mediaType,
          mediaFileDigest,
        );

        if (pct >= 80) {
          mediaPlayedSetRef.current.add(decodeURIComponent(data.filename));
        }

        if (result.points > 0) {
          triggerToast(
            data.mediaType === "video" ? "Video Watched" : "Audio Listened",
            result.points,
            courseData?.title || "Course",
            "media",
          );
          mediaToastShown = true;
          await refreshPoints();
          // Small delay between toasts so user sees each one
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        mediaTrackedSetRef.current.add(key);
      } catch (error) {
        console.error(
          `[MEDIA-TRACKING] Error tracking ${data.mediaType} playback:`,
          error,
        );
      }
    }

    // Clear tracked entries from pending map
    for (const key of mediaTrackedSetRef.current) {
      pendingMediaMapRef.current.delete(key);
    }

    return mediaToastShown;
  };

  // Locked activity dialog state
  const [showLockedDialog, setShowLockedDialog] = useState(false);

  // Password dialog state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordProtectedSection, setPasswordProtectedSection] = useState<{
    title: string;
    password: string;
    targetIndex: number;
  } | null>(null);
  const [lockedType, setLockedType] = useState<"section" | "activity">(
    "activity",
  );
  const [lockedSectionTitle, setLockedSectionTitle] = useState<string>("");
  const [lockedActivityTitle, setLockedActivityTitle] = useState<string>("");

  // Badge notification state
  const [showBadgeToast, setShowBadgeToast] = useState(false);
  const [awardedBadge, setAwardedBadge] = useState<BadgeType | null>(null);
  // Track which badges have been shown for this course session to avoid duplicates
  const shownBadgesRef = useRef<Set<BadgeType>>(new Set());
  // When true, closing the badge toast should navigate back to courses (used on Finish)
  const exitAfterBadgeCloseRef = useRef(false);

  // Track if current activity has slides with internal navigation
  const [hasSlidesWithNavigation, setHasSlidesWithNavigation] = useState(false);
  // Track if user is on the last slide of the activity
  const [isOnLastSlide, setIsOnLastSlide] = useState(false);
  // Track if user is on the first slide of the activity
  const [isOnFirstSlide, setIsOnFirstSlide] = useState(false);

  // Check password protection on page load
  useEffect(() => {
    if (
      !courseData ||
      !courseData.sections ||
      currentPageIndex < 0 ||
      currentPageIndex >= courseData.sections.length
    ) {
      return;
    }

    const currentSection = courseData.sections[currentPageIndex];
    if (currentSection?.password && currentSection.sectionTitle) {
      const isUnlocked = isSectionUnlocked(
        courseId,
        currentSection.sectionTitle,
      );

      if (!isUnlocked) {
        setPasswordProtectedSection({
          title: currentSection.sectionTitle,
          password: currentSection.password,
          targetIndex: currentPageIndex,
        });
        setShowPasswordDialog(true);
      } else {
      }
    }
  }, [courseData, currentPageIndex, courseId]);

  // Pre-test state
  const [showPreTestModal, setShowPreTestModal] = useState(false);
  const [preTestDetected, setPreTestDetected] = useState(false);
  const [preTestQuizId, setPreTestQuizId] = useState<string | number | null>(
    null,
  );
  const [preTestIndex, setPreTestIndex] = useState<number | null>(null);
  const [hasViewedPreTest, setHasViewedPreTest] = useState(false);
  // Pre-test completed according to /activity API (null = not fetched yet)
  const [pretestCompletedFromActivity, setPretestCompletedFromActivity] =
    useState<boolean | null>(null);

  // Ref to track if pre-test detection has already run (prevents re-runs)
  const preTestDetectionRunRef = useRef(false);
  // Ref to track the courseData we've already processed (prevents re-processing same data)
  const processedCourseDataRef = useRef<string | null>(null);

  // Detect pre-test when course data loads (only once, don't re-run unnecessarily)
  useEffect(() => {
    // Skip if already detected or if detection has already run
    if (preTestDetected || preTestDetectionRunRef.current) {
      return;
    }

    // CRITICAL: Skip if we've already processed this courseData
    // This prevents re-detection when courseData object reference changes but content is the same
    const courseDataKey = courseData
      ? `${courseId}-${courseData.sections?.length || 0}`
      : null;
    if (courseDataKey && processedCourseDataRef.current === courseDataKey) {
      return;
    }

    // CRITICAL: Also skip if we're showing quiz results (results screen means quiz was completed)
    // This prevents re-detection during re-renders after quiz submission
    const isShowingResults =
      typeof window !== "undefined" &&
      window.location.pathname.includes("/view") &&
      currentPageIndex === preTestIndex &&
      preTestQuizId &&
      hasAttemptedPreTest(courseId, preTestQuizId);

    if (isShowingResults) {
      return;
    }

    // CRITICAL: Skip if loading is true - wait for course data to be fully loaded
    // This prevents the useEffect from running multiple times as loading changes
    if (loading) {
      return;
    }

    // Only detect pre-test once when course data first loads
    // Don't re-run if already detected or if we're past the pre-test page
    if (courseData && courseData.sections && courseData.sections.length > 0) {
      // Mark that detection has run and track which courseData we processed
      preTestDetectionRunRef.current = true;
      processedCourseDataRef.current = courseDataKey;

      // Find pre-test quiz (case-insensitive check for "pre-test" or "pretest" in title)
      for (let i = 0; i < courseData.sections.length; i++) {
        const section = courseData.sections[i];
        if (section.type === "quiz") {
          // Check multiple sources for quiz title (meta activities use section.title)
          const rawQuizTitle =
            section.quizData?.title ||
            (section as any).content?.title ||
            section.title;

          // Handle multilingual titles (e.g., {"en": "Pre-test"}, {"kn": "Pre Test"})
          let quizTitle = "";
          if (typeof rawQuizTitle === "object" && rawQuizTitle !== null) {
            quizTitle = getLocalizedText(rawQuizTitle, "");
          } else {
            quizTitle = String(rawQuizTitle || "");
          }

          const quizId =
            section.quizData?.id || (section as any).content?.id || section.id;

          if (isPreTestTitle(quizTitle)) {
            // Check if pre-test has already been attempted
            const hasAttempted = hasAttemptedPreTest(courseId, quizId);

            console.log(
              `[FLOW-7] 🔍 Pretest DETECTED — index: ${i}, quizId: ${quizId}, quizTitle: "${quizTitle}", hasAttempted: ${hasAttempted}, currentPageIndex: ${currentPageIndex}, initialPage: "${initialPage}"`,
            );

            // Always set pre-test info (needed for marking as attempted)
            // But don't prevent navigation - user can always continue
            setPreTestDetected(true);
            setPreTestQuizId(quizId);
            setPreTestIndex(i);

            break;
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseData, courseId]); // Only run when courseData or courseId changes - NOT when loading changes

  // Handle pre-test completion (called when results are shown)
  const handlePreTestComplete = useCallback(() => {
    console.log(
      `[PreTest] 🔔 handlePreTestComplete called — courseId: ${courseId}, preTestQuizId: ${preTestQuizId}`,
    );
    if (preTestQuizId) {
      console.log(
        `[PreTest] ✏️ Calling markPreTestAttempted with courseId: ${courseId}, quizId: ${preTestQuizId}`,
      );
      markPreTestAttempted(courseId, preTestQuizId);

      // Verify it was saved
      const verifyAttempted = hasAttemptedPreTest(courseId, preTestQuizId);
      console.log(
        `[PreTest] 🔍 handlePreTestComplete verification — verifyAttempted: ${verifyAttempted}`,
      );
    } else {
      console.log(
        `[PreTest] ⚠️ handlePreTestComplete — preTestQuizId is not set!`,
      );
    }
  }, [courseId, preTestQuizId]);

  // Fetch /activity API to check if pretest has ANY attempt on server (by digest)
  const shortname =
    courseData?.shortname || streamingShortname || shortnameParam;
  useEffect(() => {
    if (
      !preTestDetected ||
      preTestIndex === null ||
      !courseData?.sections?.[preTestIndex] ||
      !shortname
    ) {
      if (!preTestDetected) setPretestCompletedFromActivity(null);
      return;
    }
    const pretestDigest = courseData.sections[preTestIndex].digest;
    if (!pretestDigest) {
      setPretestCompletedFromActivity(false);
      return;
    }
    let cancelled = false;
    activityTrackingService
      .getCourseActivityTracking(shortname)
      .then((response) => {
        if (cancelled) return;

        // Check if ANY attempt exists (regardless of pass/fail status)
        const hasAnyAttempt = response.trackers.some(
          (tracker) =>
            tracker.digest === pretestDigest && tracker.type === "quiz",
        );

        console.log(
          `[PreTest] 🌐 Viewer API — trackers: ${response.trackers.length}, hasAnyAttempt: ${hasAnyAttempt}, online: ${navigator.onLine}`,
        );

        if (hasAnyAttempt) {
          console.log(`[PreTest] ✅ Viewer API — attempt found on server`);
          setPretestCompletedFromActivity(true);
        } else {
          // API returned empty trackers (server 503 / offline / no cache).
          // Check THREE fallbacks regardless of online status:
          // 1. Local pre-test storage flags
          // 2. Zustand completion store
          const attemptedLocally = preTestQuizId
            ? hasAttemptedPreTest(courseId, preTestQuizId)
            : false;
          const completionMap = getCompletionData(courseId);
          const attemptedInZustand = completionMap?.get(pretestDigest) || false;

          console.log(
            `[PreTest] 🔄 Viewer API fallback — attemptedLocally: ${attemptedLocally}, attemptedInZustand: ${attemptedInZustand}, digest: ${pretestDigest}, online: ${navigator.onLine}`,
          );

          if (attemptedLocally || attemptedInZustand) {
            setPretestCompletedFromActivity(true);
          } else {
            console.log(
              `[PreTest] ❌ Viewer API — no attempt found in any source`,
            );
            setPretestCompletedFromActivity(false);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.log(`[PreTest] ⚠️ Viewer API error:`, err);
          // Check THREE fallbacks regardless of online status:
          // 1. Local pre-test storage flags
          // 2. Zustand completion store
          const attemptedLocally = preTestQuizId
            ? hasAttemptedPreTest(courseId, preTestQuizId)
            : false;
          const completionMap = getCompletionData(courseId);
          const pretestDigest = courseData?.sections?.[preTestIndex]?.digest;
          const attemptedInZustand = pretestDigest
            ? completionMap?.get(pretestDigest) || false
            : false;

          console.log(
            `[PreTest] 🔄 Viewer catch fallback — attemptedLocally: ${attemptedLocally}, attemptedInZustand: ${attemptedInZustand}, digest: ${pretestDigest}, online: ${navigator.onLine}`,
          );

          if (attemptedLocally || attemptedInZustand) {
            setPretestCompletedFromActivity(true);
          } else {
            console.log(`[PreTest] ❌ Viewer catch — no attempt in any source`);
            setPretestCompletedFromActivity(false);
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [preTestDetected, preTestIndex, courseData?.sections, shortname]);

  // Resolved: pretest has any attempt if local storage says so OR activity API has any record
  // Also check hasAttemptedPreTest directly as a fallback for offline scenarios
  // where isPreTestCompleted may fail due to missing results_shown flag
  // Finally check Zustand completion store as ultimate fallback (always available)
  // Also trust pretestDone query param from detail page (authoritative for offline)
  const _localCompleted = isPreTestCompleted(courseId, preTestQuizId ?? "");
  const _apiCompleted = pretestCompletedFromActivity === true;
  const _localAttempted = hasAttemptedPreTest(courseId, preTestQuizId ?? "");
  const _zustandCompleted = (() => {
    if (!preTestDetected || preTestIndex === null) return false;
    const digest = courseData?.sections?.[preTestIndex]?.digest;
    if (!digest) return false;
    const completionMap = getCompletionData(courseId);
    return completionMap?.get(digest) || false;
  })();
  const _paramCompleted = pretestDoneParam === "1";
  const isPreTestCompletedResolved =
    _localCompleted ||
    _apiCompleted ||
    _localAttempted ||
    _zustandCompleted ||
    _paramCompleted;

  console.log(
    `[PreTest] 🔎 Resolved — local: ${_localCompleted}, api: ${_apiCompleted}, attempted: ${_localAttempted}, zustand: ${_zustandCompleted}, param: ${_paramCompleted}, RESOLVED: ${isPreTestCompletedResolved}, online: ${typeof navigator !== "undefined" ? navigator.onLine : "N/A"}`,
  );

  // CRITICAL: Check if pre-test has any attempt before allowing course viewing
  // Redirect to course detail page if pre-test exists but user hasn't attempted it yet
  useEffect(() => {
    if (
      !loading &&
      !checkingMode &&
      courseData &&
      preTestDetected &&
      preTestQuizId &&
      currentPageIndex !== preTestIndex
    ) {
      // Wait for activity API if we have shortname and haven't got result yet
      const stillLoadingActivity =
        !!shortname && pretestCompletedFromActivity === null;
      if (stillLoadingActivity) return;

      // Wait for Zustand rehydration before making redirect decisions
      // Without this, persisted completion data may not be loaded yet
      if (!isZustandRehydrated) return;

      const completed = isPreTestCompletedResolved;
      console.log(
        `[PreTest] 🚦 Redirect check — completed: ${completed}, pageIndex: ${currentPageIndex}, preTestIndex: ${preTestIndex}, online: ${navigator.onLine}`,
      );

      if (!completed) {
        // EDGE CASE FIX: When offline, don't redirect away from the viewer
        // just because we can't verify pre-test completion. The activity
        // tracking API is unreachable and cached data may not exist. Let the
        // user continue viewing; the pre-test check will re-run when online.
        if (!navigator.onLine) {
          console.log(
            "[CourseViewer] 📴 Offline — skipping pre-test redirect (cannot verify)",
          );
          return;
        }

        // Redirect back to course detail page where modal will show
        const shortname =
          courseData?.shortname || streamingShortname || shortnameParam;
        let url = `/course/${courseId}`;
        const params = [];
        if (shortname) {
          params.push(`shortname=${encodeURIComponent(shortname)}`);
        }
        if (tagId) {
          params.push(`tagId=${tagId}`);
        }
        if (tagName) {
          params.push(`tagName=${encodeURIComponent(tagName)}`);
        }
        if (params.length > 0) {
          url += `?${params.join("&")}`;
        }
        router.push(url);
      }
    }
  }, [
    loading,
    checkingMode,
    courseData,
    preTestDetected,
    preTestQuizId,
    currentPageIndex,
    preTestIndex,
    courseId,
    router,
    streamingShortname,
    shortnameParam,
    tagId,
    tagName,
    shortname,
    pretestCompletedFromActivity,
    isPreTestCompletedResolved,
    isZustandRehydrated,
  ]);

  // Ref for scrollable content area
  const contentScrollRef = useRef<HTMLDivElement>(null);

  /**
   * Check if a target page index is locked based on sequencing type
   * Returns: { isLocked: boolean, type: 'section' | 'activity', blockingSection: string, blockingActivity: string }
   */
  const checkIfActivityLocked = (
    targetIndex: number,
  ): {
    isLocked: boolean;
    type: "section" | "activity";
    blockingSectionTitle: string;
    blockingActivityTitle: string;
  } => {
    if (
      !courseData ||
      !courseData.sections ||
      courseData.sections.length === 0
    ) {
      return {
        isLocked: false,
        type: "activity",
        blockingSectionTitle: "",
        blockingActivityTitle: "",
      };
    }

    const sequencing = (courseData as any).sequencing || "none";

    // If sequencing is none, nothing is locked
    if (sequencing === "none") {
      return {
        isLocked: false,
        type: "activity",
        blockingSectionTitle: "",
        blockingActivityTitle: "",
      };
    }

    const completionMap = getCompletionData(courseId) || new Map();
    const targetSection = courseData.sections[targetIndex];

    if (!targetSection) {
      return {
        isLocked: false,
        type: "activity",
        blockingSectionTitle: "",
        blockingActivityTitle: "",
      };
    }

    // For sequencingThroughSection: Lock next section until all activities in current section are complete
    if (sequencing === "sequencingThroughSection") {
      const targetSectionOrder = targetSection.sectionOrder;

      // Find all sections with lower order number
      const previousSections = courseData.sections.filter(
        (s) =>
          s.sectionOrder !== undefined &&
          s.sectionOrder < (targetSectionOrder || 0),
      );

      // Check if all activities in previous sections are completed
      for (const section of previousSections) {
        const isCompleted = section.digest
          ? completionMap.get(section.digest) || false
          : true;
        if (!isCompleted) {
          return {
            isLocked: true,
            type: "section",
            blockingSectionTitle: section.sectionTitle || "Previous section",
            blockingActivityTitle: section.title || "Previous activity",
          };
        }
      }
    }

    // For sequencingThroughActivity: Lock next activity until current one is complete
    if (sequencing === "sequencingThroughActivity") {
      // All activities before targetIndex must be completed
      for (let i = 0; i < targetIndex; i++) {
        const section = courseData.sections[i];
        if (!section) continue;

        const isCompleted = section.digest
          ? completionMap.get(section.digest) || false
          : true;
        if (!isCompleted) {
          return {
            isLocked: true,
            type: "activity",
            blockingSectionTitle: section.sectionTitle || "Previous section",
            blockingActivityTitle: section.title || "Previous activity",
          };
        }
      }
    }

    // For "section" sequencing: Lock activities within the same section until previous activity in that section is complete
    // Users can freely navigate between sections, but must complete activities sequentially within each section
    if (sequencing === "section") {
      const targetSectionOrder = targetSection.sectionOrder;
      const targetSectionTitle = targetSection.sectionTitle;
      const targetOrder = targetSection.order;

      // Find all activities in the same section that come before the target activity
      // Only check activities within the same section (same sectionOrder and sectionTitle)
      // and with a lower order number within that section
      const activitiesInSameSection = courseData.sections.filter(
        (s) =>
          s.sectionOrder === targetSectionOrder &&
          s.sectionTitle === targetSectionTitle &&
          s.order !== undefined &&
          targetOrder !== undefined &&
          s.order < targetOrder,
      );

      // Check if all previous activities in the same section are completed
      for (const section of activitiesInSameSection) {
        const isCompleted = section.digest
          ? completionMap.get(section.digest) || false
          : true;
        if (!isCompleted) {
          return {
            isLocked: true,
            type: "activity",
            blockingSectionTitle: section.sectionTitle || "Previous section",
            blockingActivityTitle: section.title || "Previous activity",
          };
        }
      }
    }

    // For "course" sequencing: Combines outer (section-level) and inner (activity-level) sequencing
    // Sections must be completed sequentially, AND activities within each section must be completed sequentially
    if (sequencing === "course") {
      const targetSectionOrder = targetSection.sectionOrder;
      const targetSectionTitle = targetSection.sectionTitle;
      const targetOrder = targetSection.order;

      // First check: Outer sequencing - all previous sections must be completed
      const previousSections = courseData.sections.filter(
        (s) =>
          s.sectionOrder !== undefined &&
          s.sectionOrder < (targetSectionOrder || 0),
      );

      // Check if all activities in previous sections are completed
      for (const section of previousSections) {
        const isCompleted = section.digest
          ? completionMap.get(section.digest) || false
          : true;
        if (!isCompleted) {
          return {
            isLocked: true,
            type: "section",
            blockingSectionTitle: section.sectionTitle || "Previous section",
            blockingActivityTitle: section.title || "Previous activity",
          };
        }
      }

      // Second check: Inner sequencing - all previous activities within the same section must be completed
      const activitiesInSameSection = courseData.sections.filter(
        (s) =>
          s.sectionOrder === targetSectionOrder &&
          s.sectionTitle === targetSectionTitle &&
          s.order !== undefined &&
          targetOrder !== undefined &&
          s.order < targetOrder,
      );

      // Check if all previous activities in the same section are completed
      for (const section of activitiesInSameSection) {
        const isCompleted = section.digest
          ? completionMap.get(section.digest) || false
          : true;
        if (!isCompleted) {
          return {
            isLocked: true,
            type: "activity",
            blockingSectionTitle: section.sectionTitle || "Previous section",
            blockingActivityTitle: section.title || "Previous activity",
          };
        }
      }
    }

    return {
      isLocked: false,
      type: "activity",
      blockingSectionTitle: "",
      blockingActivityTitle: "",
    };
  };

  /**
   * Check if completing an activity triggers a badge milestone
   * Returns the badge type if a new milestone is reached, null otherwise
   */
  const checkForBadgeMilestone = (
    previousCompletedCount: number,
    newCompletedCount: number,
    totalActivities: number,
  ): BadgeType | null => {
    if (totalActivities === 0) return null;

    const previousPercentage = Math.round(
      (previousCompletedCount / totalActivities) * 100,
    );
    const newPercentage = Math.round(
      (newCompletedCount / totalActivities) * 100,
    );

    // Check diamond (100%)
    if (previousPercentage < 100 && newPercentage >= 100) {
      if (!shownBadgesRef.current.has("diamond")) {
        shownBadgesRef.current.add("diamond");
        return "diamond";
      }
    }
    // Check gold (66%)
    else if (previousPercentage < 66 && newPercentage >= 66) {
      if (!shownBadgesRef.current.has("gold")) {
        shownBadgesRef.current.add("gold");
        return "gold";
      }
    }
    // Check silver (33%)
    else if (previousPercentage < 33 && newPercentage >= 33) {
      if (!shownBadgesRef.current.has("silver")) {
        shownBadgesRef.current.add("silver");
        return "silver";
      }
    }

    return null;
  };

  /**
   * Get current completion count from completion data
   */
  const getCompletionCount = (): number => {
    const completionMap = getCompletionData(courseId);
    if (!completionMap) return 0;

    let count = 0;
    completionMap.forEach((isCompleted) => {
      if (isCompleted) count++;
    });
    return count;
  };

  // Check if the current activity is locked when page loads or page changes
  useEffect(() => {
    if (
      !loading &&
      courseData &&
      courseData.sections &&
      courseData.sections.length > 0
    ) {
      const lockStatus = checkIfActivityLocked(currentPageIndex);
      if (lockStatus.isLocked) {
        setLockedType(lockStatus.type);
        setLockedSectionTitle(lockStatus.blockingSectionTitle);
        setLockedActivityTitle(lockStatus.blockingActivityTitle);
        setShowLockedDialog(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, courseData, currentPageIndex]);

  // Reset timer when page changes
  useEffect(() => {
    setActivityStartTime(Date.now());
    // Reset slides state when page changes
    setHasSlidesWithNavigation(false);
    setIsOnLastSlide(false);
    // Default to true so the footer shows Previous (not Next) while detection runs.
    // fixNavigationButtons will update to the real value once scripts execute.
    setIsOnFirstSlide(true);
    // Reset PDF opened state when navigating to a new page
    pdfOpenedRef.current = false;
    // Reset multi-media tracking for new page
    pendingMediaMapRef.current.clear();
    mediaPlayedSetRef.current.clear();
    mediaTrackedSetRef.current.clear();
  }, [currentPageIndex]);

  // Pre-populate mediaPlayedSetRef & mediaTrackedSetRef from:
  //   1) Server-side completionMap (cross-device: data pulled from /activity API)
  //   2) Local IndexedDB mediaTrackers (cross-session on same device)
  useEffect(() => {
    if (loading || !courseData?.sections) return;
    const section = courseData.sections[currentPageIndex];
    if (!section) return;
    const mediaFiles: any[] =
      section.mediaFiles || (section as any).media || [];
    if (mediaFiles.length === 0) return;

    // ── 1) Synchronous: check server-side completionMap (works cross-device) ──
    const completionMap = getCompletionData(courseId);
    if (completionMap) {
      for (const mf of mediaFiles) {
        const digest = mf.digest || "";
        if (!digest) continue;
        if (completionMap.get(digest) === true) {
          const decoded = decodeURIComponent(mf.filename || "");
          mediaPlayedSetRef.current.add(decoded);
          mediaTrackedSetRef.current.add(decoded);
        }
      }
    }

    // ── 2) Async: check local IndexedDB mediaTrackers (same device, cross-session) ──
    const userId = user?.id ? parseInt(user.id, 10) : NaN;
    if (isNaN(userId)) return;

    let cancelled = false;
    (async () => {
      for (const mf of mediaFiles) {
        if (cancelled) return;
        const digest = mf.digest || "";
        if (!digest) continue;
        // Skip if already marked by completionMap above
        const decoded = decodeURIComponent(mf.filename || "");
        if (mediaPlayedSetRef.current.has(decoded)) continue;
        try {
          const tracker = await getMediaTracker(userId, digest);
          if (cancelled) return;
          if (tracker && tracker.points > 0) {
            mediaPlayedSetRef.current.add(decoded);
            mediaTrackedSetRef.current.add(decoded);
          }
        } catch {
          // IDB read failed — skip, user will still earn points on replay
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    loading,
    courseData,
    currentPageIndex,
    user?.id,
    getCompletionData,
    courseId,
  ]);

  // Memoize the callback to prevent infinite re-renders in streaming mode
  const handleSlidesChange = useCallback(
    (hasSlides: boolean, isOnLast?: boolean, isOnFirst?: boolean) => {
      setHasSlidesWithNavigation(hasSlides);
      setIsOnLastSlide(isOnLast ?? false);
      setIsOnFirstSlide(isOnFirst ?? false);
    },
    [], // Empty deps - this callback doesn't depend on any props/state
  );

  // Track last visited activity when page changes
  useEffect(() => {
    if (
      !loading &&
      courseData &&
      courseData.sections &&
      courseData.sections.length > 0 &&
      currentPageIndex >= 0 &&
      currentPageIndex < courseData.sections.length
    ) {
      const currentSection = courseData.sections[currentPageIndex];

      // Use title if available, fallback to sectionTitle
      const activityTitle =
        (currentSection as any).title || currentSection.sectionTitle || "";

      // Find the lesson (parent section) for this activity
      let lessonTitle = currentSection.sectionTitle || "";
      if (courseData.sections) {
        // Try to find if this activity belongs to a subsection
        for (const section of courseData.sections) {
          if ((section as any).activities) {
            const foundInSub = (section as any).activities.find(
              (act: any) => act.id === currentSection.id,
            );
            if (foundInSub) {
              lessonTitle = section.sectionTitle || "";
              break;
            }
          }
        }
      }

      saveLastVisitedActivity({
        courseId,
        activityId: currentSection.id,
        activityIndex: currentPageIndex,
        activityTitle: activityTitle,
        lessonTitle: lessonTitle,
        timestamp: new Date().toISOString(),
        shortname: useStreaming
          ? streamingShortname || undefined
          : courseData.shortname,
        mode: useStreaming ? "streaming" : "offline",
      });
    }
  }, [
    currentPageIndex,
    courseData,
    loading,
    courseId,
    useStreaming,
    streamingShortname,
  ]);

  // Note: Auth redirect is handled by AuthProvider, no need to duplicate here

  // Auto-trigger tour for first-time visitors
  useEffect(() => {
    if (
      isAuthenticated &&
      !loading &&
      courseData &&
      currentContent &&
      !hasCompletedTour()
    ) {
      const timer = setTimeout(() => {
        const tourSteps = getCourseViewerTour();
        startTour(tourSteps);
      }, 800); // Slightly longer delay for viewer page
      return () => clearTimeout(timer);
    }
  }, [
    isAuthenticated,
    loading,
    courseData,
    currentContent,
    hasCompletedTour,
    startTour,
  ]);

  // Cache this page for offline access when first loaded
  useEffect(() => {
    if (!loading && courseData && !useStreaming && navigator.onLine) {
      // Cache current page URL for offline access
      const currentUrl = window.location.pathname + window.location.search;
      const timer = setTimeout(() => {
        cachePageWithDependencies(currentUrl);
      }, 2000); // Cache after page is fully loaded
      return () => clearTimeout(timer);
    }
  }, [loading, courseData, useStreaming]);

  const markMediaCompleted = useCallback(
    (activityDigest?: string) => {
      if (!activityDigest || !courseData) return;

      const completionMap = getCompletionData(courseId) || new Map();
      // Check daily completion - don't award if already completed today
      if (wasCompletedToday(completionMap, activityDigest)) return;

      // Mark as completed today
      const updatedCompletionMap = markCompletedToday(
        completionMap,
        activityDigest,
      );
      setCompletionData(courseId, updatedCompletionMap);

      const previousCompletedCount = getCompletionCount();
      const totalActivities = courseData.sections?.length || 0;
      const newCompletedCount = previousCompletedCount + 1;
      const badgeAwarded = checkForBadgeMilestone(
        previousCompletedCount,
        newCompletedCount,
        totalActivities,
      );

      if (badgeAwarded) {
        setTimeout(() => {
          setAwardedBadge(badgeAwarded);
          setShowBadgeToast(true);
        }, 3500);
      }
    },
    [
      courseData,
      courseId,
      getCompletionData,
      setCompletionData,
      getCompletionCount,
      checkForBadgeMilestone,
    ],
  );

  /**
   * Handle immediate media tracking when media reaches 100% completion.
   * Called from onVideoComplete / onAudioComplete callbacks.
   * Tracks media_played, shows media toast, and clears pending media data
   * so handleNextPage doesn't double-track media.
   * Activity tracking is deferred to Next click (handleNextPage / trackCurrentActivityBeforeLeaving).
   */
  const handleMediaFullCompletion = useCallback(
    async (
      mediaType: "video" | "audio",
      filename: string,
      timeWatched: number,
      duration: number,
    ) => {
      const decodedFilename = decodeURIComponent(filename);

      // Guard: only process once PER MEDIA FILE (not globally)
      if (mediaTrackedSetRef.current.has(decodedFilename)) return;

      if (
        !courseData ||
        !courseData.sections ||
        courseData.sections.length === 0
      )
        return;
      const section = courseData.sections[currentPageIndex];
      if (!section || !section.digest) return;

      console.log(
        `[🎬 MEDIA-100%] ${mediaType} "${decodedFilename}" finished playing — immediate tracking`,
        {
          filename: decodedFilename,
          timeWatched: Math.round(timeWatched),
          duration: Math.round(duration),
          digest: section.digest?.slice(0, 8),
        },
      );

      // Mark this specific media as played (≥80% threshold met trivially at 100%)
      mediaPlayedSetRef.current.add(decodedFilename);

      // ── 1. Track media_played with correct per-file digest ──
      const course = {
        id: parseInt(courseId, 10) || 0,
        shortname: streamingShortname || courseData.shortname || "",
        version: courseData.version || 1,
      };
      const activity = {
        digest: section.digest || "",
        title:
          section.sectionTitle ||
          section.title ||
          (mediaType === "video" ? "Video" : "Audio"),
      };

      // Match filename to the correct media file digest
      const mediaFileDigest = findMediaDigestByFilename(section, filename);

      try {
        const mediaResult = await trackMediaPlayback(
          course,
          activity,
          filename,
          timeWatched,
          duration,
          mediaType,
          mediaFileDigest,
        );

        if (mediaResult.points > 0) {
          triggerToast(
            mediaType === "video" ? "Video Watched" : "Audio Listened",
            mediaResult.points,
            courseData?.title || "Course",
            "media",
          );
          await refreshPoints();
        }
      } catch (error) {
        console.error(
          `[MEDIA-100%] Error tracking ${mediaType} playback:`,
          error,
        );
      }

      // Mark this file as tracked so handleNextPage doesn't re-track it
      mediaTrackedSetRef.current.add(decodedFilename);
      // Remove only THIS file from pending map
      pendingMediaMapRef.current.delete(decodedFilename);

      const allPlayed = isAllMediaPlayed(section);
      console.log(
        `[🎬 MEDIA-100%] "${decodedFilename}" tracked. All media played: ${allPlayed}. Activity tracking deferred to Next click.`,
      );
    },
    [
      courseData,
      currentPageIndex,
      courseId,
      streamingShortname,
      trackMediaPlayback,
      refreshPoints,
      triggerToast,
    ],
  );

  // Handle PDF open — fires when user clicks a PDF link in the activity
  const handlePdfOpen = useCallback(async () => {
    // Guard: only process once per page view
    if (pdfOpenedRef.current) return;
    pdfOpenedRef.current = true;

    if (!courseData || !courseData.sections || courseData.sections.length === 0)
      return;
    const section = courseData.sections[currentPageIndex];
    if (!section || !section.digest) return;

    // Check if already completed - both lifetime and today
    const completionMap = getCompletionData(courseId) || new Map();
    const alreadyCompletedToday = wasCompletedToday(
      completionMap,
      section.digest || "",
    );
    if (alreadyCompletedToday) return;

    const timeSpent = Math.floor((Date.now() - activityStartTime) / 1000);
    const activityTitle = section.title || "Activity";
    const course = {
      id: courseData.id || parseInt(courseId),
      shortname: courseData.shortname || "",
      title: courseData.title || "",
      version: courseData.version || 1,
      gamificationEvents: (courseData as any).gamificationEvents,
    };
    const activity = {
      digest: section.digest || "",
      title: activityTitle,
      type: section.type || "page",
      gamificationEvents: (section as any).gamificationEvents,
    };

    try {
      const result = await trackActivityCompleted(course, activity, timeSpent);

      // Update completion map - mark as completed today
      if (section.digest) {
        const currentCompletionMap = getCompletionData(courseId) || new Map();
        const updatedMap = markCompletedToday(
          currentCompletionMap,
          section.digest,
        );
        setCompletionData(courseId, updatedMap);
      }

      await refreshPoints();
      // CRITICAL: ALWAYS show PDF completion toast when points awarded
      if (result.points > 0) {
        triggerToast(
          activityTitle,
          result.points,
          courseData?.title || "Course",
          "activity",
        );
      }
    } catch (error) {
      console.error(
        "[PDF_OPEN] Error tracking PDF activity completion:",
        error,
      );
    }
  }, [
    courseData,
    currentPageIndex,
    courseId,
    activityStartTime,
    getCompletionData,
    setCompletionData,
    trackActivityCompleted,
    refreshPoints,
    triggerToast,
  ]);

  /**
   * Track the current activity (and pending video) before leaving via any navigation.
   * Used by both Next button and activity bar so points are awarded consistently.
   */
  const trackCurrentActivityBeforeLeaving =
    useCallback(async (): Promise<boolean> => {
      let mediaToastShown = false;
      if (
        !courseData ||
        !courseData.sections ||
        courseData.sections.length === 0
      ) {
        return mediaToastShown;
      }
      const section = courseData.sections[currentPageIndex];
      if (!section) return mediaToastShown;

      // CRITICAL: Snapshot before any async work — React useEffect may clear
      // mediaPlayedSetRef during awaits if page index changes concurrently.
      const allMediaDoneSnapshot = isAllMediaPlayed(section);

      // Track ALL pending media (each gets its own points with correct digest)
      mediaToastShown = await trackAllPendingMedia(section);

      // Delay between media toast and activity toast so user sees both
      if (mediaToastShown) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      // Track current activity completion if eligible (same conditions as handleNextPage)
      const timeSpent = Math.floor((Date.now() - activityStartTime) / 1000);
      const completionMap = getCompletionData(courseId);
      // CRITICAL: Check daily completion - only award points once per day
      const canAwardPointsToday = shouldAwardPoints(
        completionMap,
        section.digest || "",
      );
      const requiredTime = getRequiredTimeForCompletion(
        section,
        currentWordCount,
      );

      // Check if this activity has media (from module.xml metadata)
      // If it does, skip 3-second completion tracking - media must reach 80% threshold instead
      const hasMediaContent = !!(
        (section as any)?.mediaFiles?.length > 0 ||
        (section as any)?.media?.length > 0
      );

      // If activity has PDF content, only complete when the PDF was actually opened
      const hasPdfButNotOpened = hasPdfContent && !pdfOpenedRef.current;

      const todayKey = getTodayDateKey();
      const dailyKey = section.digest
        ? getDailyCompletionKey(section.digest, todayKey)
        : "";
      const completedToday = wasCompletedToday(
        completionMap,
        section.digest || "",
      );
      console.log("[🎯 COMPLETION_CHECK] Activity Navigation Away", {
        courseId,
        digest: section.digest || "",
        todayKey,
        dailyKey,
        completedToday,
        canAwardPointsToday,
        timeSpent,
        requiredTime,
        "timeSpent >= requiredTime": timeSpent >= requiredTime,
        hasMediaContent,
        hasPdfButNotOpened,
        type: section.type,
      });

      // Always send tracker even with 0 points (engine handles dedup).
      // Removed canAwardPointsToday gate — tracker is always created.
      // Activity completes only when ALL media in the section have been played ≥80%.
      // Use pre-async snapshot to avoid race with useEffect clearing refs.
      const shouldTrack =
        timeSpent >= requiredTime &&
        section.type !== "quiz" &&
        section.type !== "feedback" &&
        (!hasMediaContent || allMediaDoneSnapshot) &&
        !hasPdfButNotOpened &&
        !!section.digest;

      console.log(
        `[⏱️ TIME-SPENT-CHECK] Expected: ${requiredTime}s, Actual: ${timeSpent}s, Meets Threshold: ${timeSpent >= requiredTime}`,
        {
          canAwardPointsToday,
          timeSpentValid: timeSpent >= requiredTime,
          isNotQuizOrFeedback:
            section.type !== "quiz" && section.type !== "feedback",
          noMediaContent: !hasMediaContent,
          pdfOpened: !hasPdfButNotOpened,
          hasDigest: !!section.digest,
          shouldTrack,
        },
      );

      if (shouldTrack) {
        console.log(
          `[🟢 COMPLETION-TRIGGERED] Activity will be tracked and marked as complete`,
          {
            activity: section.digest?.slice(0, 8) || "",
            activityTitle: section.title,
            timeSpent,
            requiredTime,
          },
        );

        const activityTitle = section.title || "Activity";
        const course = {
          id: courseData.id || parseInt(courseId),
          shortname: courseData.shortname || "",
          title: courseData.title || "",
          version: courseData.version || 1,
          gamificationEvents: (courseData as any).gamificationEvents,
        };
        const activity = {
          digest: section.digest || "",
          title: activityTitle,
          type: section.type || "page",
          gamificationEvents: (section as any).gamificationEvents,
        };
        try {
          // Track race conditions
          raceDetector.logCall("trackActivityCompleted");

          const result = await trackActivityCompleted(
            course,
            activity,
            timeSpent,
          );

          raceDetector.logComplete("trackActivityCompleted");

          const previousCompletedCount = getCompletionCount();
          const currentCompletionMap = getCompletionData(courseId) || new Map();
          // CRITICAL: Mark activity as completed for today (not just lifetime)
          const updatedCompletionMap = markCompletedToday(
            currentCompletionMap,
            section.digest || "",
          );

          console.log(`[✅ POINTS-AWARDED] Activity completion successful`, {
            activity: section.digest?.slice(0, 8) || "",
            pointsAwarded: result.points,
            pointsMessage: result.message,
            completedActivitiesBefore: previousCompletedCount,
            completedActivitiesAfter: previousCompletedCount + 1,
            note:
              result.points === 0
                ? "⚠️ 0 points: Activity already completed on server"
                : "✅ Points awarded",
          });

          if (section.digest) {
            console.log(
              `[OFFLINE_TRACKER] Activity completed - Course: ${courseId}, Activity: ${section.digest}, Total: ${updatedCompletionMap.size}`,
            );

            // Use retry logic for persistence
            raceDetector.logCall("setCompletionData");
            const persistResult = await executeWithRetry(
              () => setCompletionData(courseId, updatedCompletionMap),
              `setCompletionData(${courseId})`,
            );
            raceDetector.logComplete("setCompletionData");

            // Validate persistence succeeded
            if (!persistResult.success) {
              console.error(
                `[OFFLINE_TRACKER] ❌ Activity completion failed to persist after retries`,
                {
                  course: courseId,
                  activity: section.digest,
                  error: persistResult.error,
                },
              );
              // Show error to user that data wasn't saved
              throw new Error(
                `Failed to save activity completion: ${persistResult.error}`,
              );
            }

            // Check for race conditions
            const raceCheck = raceDetector.detectRaceCondition();
            if (raceCheck.detected) {
              console.warn(
                `[OFFLINE_TRACKER] ⚠️  Possible race condition detected`,
                raceCheck.info,
              );
            }
          }

          await refreshPoints();
          // CRITICAL: ALWAYS show the activity toast when points are awarded, regardless of previous toast state
          // This ensures users see points when navigating backward after spending required time
          if (result.points > 0) {
            console.log(
              `[🎉 TOAST-TRIGGER] Showing activity completion toast`,
              {
                activity: section.title,
                pointsToShow: result.points,
                course: courseData?.title,
              },
            );
            triggerToast(
              activityTitle,
              result.points,
              courseData?.title || "Course",
            );
          } else {
            console.log(
              `[⏭️ TOAST-SKIPPED] NO TOAST shown because points = ${result.points}`,
              {
                activity: section.title,
                reason:
                  result.points === 0
                    ? "Already completed (0 points)"
                    : "Unknown",
                resultMessage: result.message,
              },
            );
          }
          const totalActivities = courseData.sections?.length || 0;
          const newCompletedCount = previousCompletedCount + 1;
          const badgeAwarded = checkForBadgeMilestone(
            previousCompletedCount,
            newCompletedCount,
            totalActivities,
          );
          if (badgeAwarded) {
            setTimeout(() => {
              setAwardedBadge(badgeAwarded);
              setShowBadgeToast(true);
            }, 3500);
          }
        } catch (error) {
          console.error(
            "[OFFLINE_TRACKER] Fatal error during activity completion:",
            error,
          );
          // Error state - points = 0 so toast will not show (triggerToast guards on points > 0)
        }
      } else {
        // Activity tracking was skipped - log why
        const reasons: string[] = [];
        if (timeSpent < requiredTime)
          reasons.push(
            `Insufficient time spent (${timeSpent}s < ${requiredTime}s)`,
          );
        if (section.type === "quiz" || section.type === "feedback")
          reasons.push(`Activity type is ${section.type}`);
        if (hasMediaContent && !allMediaDoneSnapshot) {
          const mediaFiles =
            (section as any)?.mediaFiles || (section as any)?.media || [];
          const totalMedia = mediaFiles.length;
          const playedCount = mediaPlayedSetRef.current.size;
          reasons.push(
            `Not all media played to threshold (${playedCount}/${totalMedia})`,
          );
        }
        if (hasPdfButNotOpened) reasons.push("PDF content not opened");
        if (!section.digest) reasons.push("No digest available");

        console.log(`[⚠️ COMPLETION-SKIPPED] Activity tracking not triggered`, {
          activity: section.digest?.slice(0, 8) || "",
          activityTitle: section.title,
          reasons: reasons.length > 0 ? reasons : "Unknown reason",
          timeSpent,
          requiredTime,
        });
      }
      return mediaToastShown;
    }, [
      courseData,
      currentPageIndex,
      activityStartTime,
      currentWordCount,
      courseId,
      streamingShortname,
      getCompletionData,
      setCompletionData,
      getCompletionCount,
      getRequiredTimeForCompletion,
      trackActivityCompleted,
      trackMediaPlayback,
      refreshPoints,
      checkForBadgeMilestone,
      markMediaCompleted,
      triggerToast,
    ]);

  // Navigation handlers
  const handleNextPage = async () => {
    if (
      !courseData ||
      !courseData.sections ||
      courseData.sections.length === 0
    ) {
      return;
    }

    const maxIndex = courseData.sections.length - 1;

    if (currentPageIndex < maxIndex) {
      const nextIndex = currentPageIndex + 1;

      // CRITICAL: Check if pre-test is completed before allowing navigation past it
      if (
        preTestDetected &&
        preTestQuizId &&
        currentPageIndex === preTestIndex &&
        !isPreTestCompletedResolved
      ) {
        setLockedType("activity");
        setLockedSectionTitle("Pre-test Required");
        setLockedActivityTitle(
          "You must complete the pre-test and view results before continuing",
        );
        setShowLockedDialog(true);
        return;
      }

      // CRITICAL: Prevent navigating to other activities if pre-test not completed
      if (
        preTestDetected &&
        preTestQuizId &&
        nextIndex !== preTestIndex &&
        !isPreTestCompletedResolved
      ) {
        setLockedType("activity");
        setLockedSectionTitle("Pre-test Required");
        setLockedActivityTitle(
          "You must complete the pre-test before accessing course activities",
        );
        setShowLockedDialog(true);
        return;
      }

      // Check if next section is password protected
      const nextSection = courseData.sections[nextIndex];
      if (nextSection?.password && nextSection.sectionTitle) {
        const isUnlocked = isSectionUnlocked(
          courseId,
          nextSection.sectionTitle,
        );

        if (!isUnlocked) {
          setPasswordProtectedSection({
            title: nextSection.sectionTitle,
            password: nextSection.password,
            targetIndex: nextIndex,
          });
          setShowPasswordDialog(true);
          return;
        }
      }

      // Get current section info
      const currentSectionForTracking = courseData.sections[currentPageIndex];

      // Calculate time spent on this activity (in seconds)
      const timeSpent = Math.floor((Date.now() - activityStartTime) / 1000);

      // Check if this activity can award points today (daily limit)
      const completionMap = getCompletionData(courseId);
      const canAwardPointsToday = shouldAwardPoints(
        completionMap,
        currentSectionForTracking?.digest || "",
      );

      // Create a temporary updated completion map if this activity should be marked complete
      let tempCompletionMap = completionMap || new Map();
      // Determine required time for this activity (fallback to 3 seconds)
      const requiredTimeForCurrent = getRequiredTimeForCompletion(
        currentSectionForTracking ?? null,
        currentWordCount,
      );
      const hasMediaContent = !!(
        (currentSectionForTracking as any)?.mediaFiles?.length > 0 ||
        (currentSectionForTracking as any)?.media?.length > 0
      );
      const todayKey = getTodayDateKey();
      const dailyKey = currentSectionForTracking?.digest
        ? getDailyCompletionKey(currentSectionForTracking.digest, todayKey)
        : "";
      const completedToday = wasCompletedToday(
        completionMap,
        currentSectionForTracking?.digest || "",
      );
      console.log("[POINTS_CHECK_NEXT] activity", {
        courseId,
        digest: currentSectionForTracking?.digest || "",
        todayKey,
        dailyKey,
        completedToday,
        canAwardPointsToday,
        timeSpent,
        requiredTimeForCurrent,
        hasMediaContent,
        type: currentSectionForTracking?.type,
      });
      if (
        canAwardPointsToday &&
        timeSpent >= requiredTimeForCurrent &&
        currentSectionForTracking?.type !== "quiz" &&
        currentSectionForTracking?.type !== "feedback" &&
        (!hasMediaContent ||
          (currentSectionForTracking &&
            isAllMediaPlayed(currentSectionForTracking))) &&
        currentSectionForTracking?.digest
      ) {
        // Create a new map with current activity marked as complete for today
        tempCompletionMap = markCompletedToday(
          completionMap || new Map(),
          currentSectionForTracking.digest,
        );
      }

      // Check if next activity is locked USING THE UPDATED COMPLETION MAP
      // We need to temporarily update the store to check the lock status correctly
      const originalCompletionMap = getCompletionData(courseId);
      if (tempCompletionMap !== completionMap) {
        setCompletionData(courseId, tempCompletionMap);
      }

      const lockStatus = checkIfActivityLocked(nextIndex);

      // Restore original map if we changed it
      // CRITICAL: Never fall back to empty Map — use tempCompletionMap (which has
      // the latest state including the current activity) if originalCompletionMap
      // is null (e.g. due to Zustand hydration race)
      if (tempCompletionMap !== completionMap) {
        setCompletionData(courseId, originalCompletionMap || tempCompletionMap);
      }

      if (lockStatus.isLocked) {
        setLockedType(lockStatus.type);
        setLockedSectionTitle(lockStatus.blockingSectionTitle);
        setLockedActivityTitle(lockStatus.blockingActivityTitle);
        setShowLockedDialog(true);
        return;
      }

      // ── PERFORMANCE: Load next page content IMMEDIATELY ──
      // Update URL to reflect new page index
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("page", nextIndex.toString());
      window.history.replaceState({}, "", currentUrl.toString());

      // Load next page based on mode — do this FIRST, before tracking
      const urlHasStreamingMode = mode === "streaming" || !!shortnameParam;
      const shouldUseStreamingForNav =
        useStreaming || urlHasStreamingMode || !!streamingShortname;

      if (shouldUseStreamingForNav && (streamingShortname || shortnameParam)) {
        // Streaming mode needs await (content comes from network)
        loadStreamedPage(nextIndex);
      } else if (courseSource === "indexeddb") {
        loadPageContentFromIDB(nextIndex, courseData);
      } else {
        loadPageContent(nextIndex, courseData);
      }

      // Scroll to top after navigation (with delay to ensure content is rendered)
      setTimeout(() => {
        contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
      }, 50);

      // ── BACKGROUND: Run gamification tracking (non-blocking) ──
      // Track ALL pending media (each gets points with correct digest),
      // then track activity completion.
      {
        const capturedCurrentSection = currentSection;
        const capturedWordCount = currentWordCount;

        // CRITICAL: Snapshot allMediaPlayed SYNCHRONOUSLY before the async IIFE.
        // Once the IIFE yields at its first `await`, React may flush the
        // setCurrentPageIndex(nextIndex) update above, triggering the useEffect
        // that clears mediaPlayedSetRef — which would make isAllMediaPlayed()
        // return false even though all media were played.
        const capturedAllMediaDone = currentSectionForTracking
          ? isAllMediaPlayed(currentSectionForTracking)
          : true;

        // Fire-and-forget: gamification + media tracking runs in background
        (async () => {
          try {
            // ── MEDIA TRACKING: Track ALL pending media on Next click ──
            let mediaToastShown = false;
            if (capturedCurrentSection && courseData) {
              mediaToastShown = await trackAllPendingMedia(
                capturedCurrentSection,
              );
            }

            // Delay between media toast and activity toast so user sees both
            if (mediaToastShown) {
              await new Promise((resolve) => setTimeout(resolve, 2500));
            }

            // Track activity completion (gates on ALL media played)
            const requiredTime = getRequiredTimeForCompletion(
              currentSectionForTracking ?? null,
              capturedWordCount,
            );
            const hasPdfButNotOpenedBg = hasPdfContent && !pdfOpenedRef.current;

            // Check daily completion for background tracking
            const bgCompletionMap = getCompletionData(courseId);
            const canAwardPointsTodayBg = shouldAwardPoints(
              bgCompletionMap,
              currentSectionForTracking?.digest || "",
            );
            const todayKey = getTodayDateKey();
            const dailyKey = currentSectionForTracking?.digest
              ? getDailyCompletionKey(
                  currentSectionForTracking.digest,
                  todayKey,
                )
              : "";
            const completedToday = wasCompletedToday(
              bgCompletionMap,
              currentSectionForTracking?.digest || "",
            );
            console.log("[POINTS_CHECK_BG] activity", {
              courseId,
              digest: currentSectionForTracking?.digest || "",
              todayKey,
              dailyKey,
              completedToday,
              canAwardPointsTodayBg,
              timeSpent,
              requiredTime,
              hasMediaContent,
              hasPdfButNotOpenedBg,
              type: currentSectionForTracking?.type,
            });

            // Always send tracker even with 0 points (engine handles dedup).
            // Activity completes only when ALL media in the section have been played ≥80%.
            // Use pre-async snapshot (capturedAllMediaDone) to avoid race with useEffect.
            const shouldTrack =
              timeSpent >= requiredTime &&
              currentSectionForTracking?.type !== "quiz" &&
              currentSectionForTracking?.type !== "feedback" &&
              (!hasMediaContent || capturedAllMediaDone) &&
              !hasPdfButNotOpenedBg &&
              courseData;

            const previousCompletedCount = getCompletionCount();
            const totalActivities = courseData.sections?.length || 0;

            if (shouldTrack) {
              const activityTitle =
                currentSectionForTracking?.sectionTitle || "Activity";

              const course = {
                id: courseData.id || parseInt(courseId),
                shortname: courseData.shortname || "",
                title: courseData.title || "",
                version: courseData.version || 1,
                gamificationEvents: (courseData as any).gamificationEvents,
              };

              const activity = {
                digest: currentSectionForTracking.digest || "",
                title: activityTitle,
                type: currentSectionForTracking.type || "page",
                gamificationEvents: (currentSectionForTracking as any)
                  .gamificationEvents,
              };

              try {
                const result = await trackActivityCompleted(
                  course,
                  activity,
                  timeSpent,
                );

                // Update completion map in Zustand store - mark as completed today
                const currentCompletionMap =
                  getCompletionData(courseId) || new Map();
                const updatedCompletionMap = markCompletedToday(
                  currentCompletionMap,
                  currentSectionForTracking.digest || "",
                );
                if (currentSectionForTracking.digest) {
                  setCompletionData(courseId, updatedCompletionMap);
                }

                // Refresh points in sidebar
                await refreshPoints();

                // Show the toast with points
                if (result.points > 0) {
                  triggerToast(
                    activityTitle,
                    result.points,
                    courseData?.title || "Course",
                  );
                }

                // Check for badge milestone after activity completion
                const newCompletedCount = previousCompletedCount + 1;
                const badgeAwarded = checkForBadgeMilestone(
                  previousCompletedCount,
                  newCompletedCount,
                  totalActivities,
                );

                if (badgeAwarded) {
                  setTimeout(() => {
                    setAwardedBadge(badgeAwarded);
                    setShowBadgeToast(true);
                  }, 3500);
                }
              } catch (error) {
                console.error(
                  "[handleNextPage] Activity tracking failed in background IIFE:",
                  error,
                );
              }
            }
          } catch (bgError) {
            console.warn(
              "[handleNextPage] Background tracking error:",
              bgError,
            );
          }
        })();
      } // end of background tracking block
    } else {
      // At the last activity - complete it (track, toast, badge), then navigate
      const currentSection = courseData.sections[currentPageIndex];

      // Track last activity completion so badge toast and data are sent
      const timeSpent = Math.floor((Date.now() - activityStartTime) / 1000);
      const completionMap = getCompletionData(courseId);
      const isAlreadyCompleted = currentSection?.digest
        ? completionMap?.get(currentSection.digest) || false
        : false;

      // Check if this activity has media (from module.xml metadata)
      const hasMediaContent = !!(
        (currentSection as any)?.mediaFiles?.length > 0 ||
        (currentSection as any)?.media?.length > 0
      );

      // Safety net: process ALL pending media data for last activity
      // Track media_played on Next click (tracking + toast happen here, not in callbacks)
      // Snapshot allMediaPlayed before async work (same pattern as background tracking)
      const allMediaDoneLast = currentSection
        ? isAllMediaPlayed(currentSection)
        : true;
      let lastMediaToastShown = false;
      if (hasMediaContent && currentSection) {
        lastMediaToastShown = await trackAllPendingMedia(currentSection);
      }

      // Delay between media toast and activity toast so user sees both
      if (lastMediaToastShown) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      const hasPdfButNotOpenedLast = hasPdfContent && !pdfOpenedRef.current;

      const requiredTime = getRequiredTimeForCompletion(
        currentSection,
        currentWordCount,
      );

      // Always send tracker even with 0 points (engine handles dedup).
      // Activity completes only when ALL media in the section have been played ≥80%.
      // allMediaDoneLast was captured before async work above.
      const shouldTrack =
        timeSpent >= requiredTime &&
        currentSection?.type !== "quiz" &&
        currentSection?.type !== "feedback" &&
        (!hasMediaContent || allMediaDoneLast) &&
        !hasPdfButNotOpenedLast &&
        !!currentSection?.digest;

      const previousCompletedCount = getCompletionCount();
      const totalActivities = courseData.sections?.length || 0;

      if (shouldTrack) {
        const activityTitle = currentSection?.title || "Activity";
        const course = {
          id: courseData.id || parseInt(courseId),
          shortname: courseData.shortname || "",
          title: courseData.title || "",
          version: courseData.version || 1,
          gamificationEvents: (courseData as any).gamificationEvents,
        };
        const activity = {
          digest: currentSection.digest || "",
          title: activityTitle,
          type: currentSection.type || "page",
          gamificationEvents: (currentSection as any).gamificationEvents,
        };
        try {
          const result = await trackActivityCompleted(
            course,
            activity,
            timeSpent,
          );
          const currentCompletionMap = getCompletionData(courseId) || new Map();
          const updatedCompletionMap = new Map(currentCompletionMap);
          if (currentSection.digest) {
            updatedCompletionMap.set(currentSection.digest, true);
            setCompletionData(courseId, updatedCompletionMap);
          }
          await refreshPoints();
          const newCompletedCount = previousCompletedCount + 1;
          const badgeAwarded = checkForBadgeMilestone(
            previousCompletedCount,
            newCompletedCount,
            totalActivities,
          );
          const allCompleted = newCompletedCount === totalActivities;

          if (badgeAwarded) {
            exitAfterBadgeCloseRef.current = true;
            if (allCompleted) {
              // All activities completed: show diamond badge toast first, then exit on close
              setAwardedBadge(badgeAwarded);
              setShowBadgeToast(true);
              // Do not show points toast so badge is shown first
            } else {
              // Unordered completion: show points toast, then badge toast after delay
              if (result.points > 0) {
                triggerToast(
                  activityTitle,
                  result.points,
                  courseData?.title || "Course",
                );
              }
              setTimeout(() => {
                setAwardedBadge(badgeAwarded);
                setShowBadgeToast(true);
              }, 3500);
            }
          } else {
            if (result.points > 0) {
              triggerToast(
                activityTitle,
                result.points,
                courseData?.title || "Course",
              );
            }
          }
        } catch (error) {
          console.error(
            "[handleNextPage] Activity tracking failed for last activity:",
            error,
          );
        }
      }

      const currentSectionOrder = currentSection?.sectionOrder;

      if (currentSectionOrder !== undefined) {
        // Find the next section with a different sectionOrder (next module)
        const nextModuleSection = courseData.sections.find(
          (section) =>
            section.sectionOrder !== undefined &&
            section.sectionOrder > currentSectionOrder,
        );

        if (nextModuleSection) {
          // Found next module - navigate to it
          const nextModuleIndex = courseData.sections.findIndex(
            (section) => section.id === nextModuleSection.id,
          );

          if (nextModuleIndex !== -1) {
            // Check if next module is locked
            const lockStatus = checkIfActivityLocked(nextModuleIndex);
            if (lockStatus.isLocked) {
              setLockedType(lockStatus.type);
              setLockedSectionTitle(lockStatus.blockingSectionTitle);
              setLockedActivityTitle(lockStatus.blockingActivityTitle);
              setShowLockedDialog(true);
              return;
            }

            // Load the first activity of the next module
            // CRITICAL: Check URL params to determine streaming mode
            const urlHasStreamingMode =
              mode === "streaming" || !!shortnameParam;
            const shouldUseStreamingForNav =
              useStreaming || urlHasStreamingMode || !!streamingShortname;

            if (
              shouldUseStreamingForNav &&
              (streamingShortname || shortnameParam)
            ) {
              await loadStreamedPage(nextModuleIndex);
            } else if (courseSource === "indexeddb") {
              loadPageContentFromIDB(nextModuleIndex, courseData);
            } else {
              loadPageContent(nextModuleIndex, courseData);
            }

            // Scroll to top after navigation (with delay to ensure content is rendered)
            setTimeout(() => {
              contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
            }, 50);
            return;
          }
        }
      }

      // No next module found - navigate back to course detail page
      // If we're showing a badge toast (Finish with badge), exit only after toast is closed
      if (exitAfterBadgeCloseRef.current) {
        return;
      }
      handleExit();
    }
  };

  const handlePreviousPage = async () => {
    if (
      !courseData ||
      !courseData.sections ||
      courseData.sections.length === 0
    ) {
      return;
    }

    if (currentPageIndex > 0) {
      const prevIndex = currentPageIndex - 1;
      const prevSection = courseData.sections[prevIndex];

      // CRITICAL: Don't allow going back to pretest after it's completed
      // If previous activity is a pretest and we're past it, block navigation
      if (
        prevSection &&
        preTestDetected &&
        prevIndex === preTestIndex &&
        isPreTestCompletedResolved
      ) {
        // Previous activity is a completed pretest - don't allow going back
        setLockedType("activity");
        setLockedSectionTitle("Cannot Go Back");
        setLockedActivityTitle(
          "You cannot return to the pre-test after completing it",
        );
        setShowLockedDialog(true);
        return;
      }

      // Track current activity completion before navigating away (same as Next button)
      await trackCurrentActivityBeforeLeaving();

      const prevIndex_UseInNavigation = prevIndex; // Use the prevIndex computed above

      // Update URL to reflect new page index
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("page", prevIndex_UseInNavigation.toString());
      window.history.replaceState({}, "", currentUrl.toString());

      // Load previous page based on mode
      // CRITICAL: Check URL params to determine streaming mode
      const urlHasStreamingMode = mode === "streaming" || !!shortnameParam;
      const shouldUseStreamingForNav =
        useStreaming || urlHasStreamingMode || !!streamingShortname;

      if (shouldUseStreamingForNav && (streamingShortname || shortnameParam)) {
        await loadStreamedPage(prevIndex_UseInNavigation);
      } else if (courseSource === "indexeddb") {
        loadPageContentFromIDB(prevIndex_UseInNavigation, courseData);
      } else {
        loadPageContent(prevIndex_UseInNavigation, courseData);
      }

      // Scroll to top after navigation (with delay to ensure content is rendered)
      setTimeout(() => {
        contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
      }, 50);
    }
  };

  const handleExit = async () => {
    // Check if user is exiting from pre-test page without completing it
    const isOnPreTestPage =
      preTestDetected && currentPageIndex === preTestIndex;
    const preTestCompleted = preTestQuizId && isPreTestCompletedResolved;

    if (isOnPreTestPage && !preTestCompleted) {
    }

    // CRITICAL: Track the current activity before leaving (same as Next/Previous buttons).
    // Await so that triggerToast (and the Zustand pending store write) completes before
    // router.push(), giving the layout's CourseToastProvider time to set its state.
    await trackCurrentActivityBeforeLeaving();

    // NOTE: Do NOT clear streaming state (setUseStreaming/setStreamingShortname)
    // here. The unmount cleanup effect already handles it. Clearing it before
    // router.push() changes the `skipDownload` prop passed to useCourseData,
    // which re-triggers its useEffect and fires an API call with the numeric
    // courseId (instead of shortname) → 404 error.

    if (courseId) {
      // Get shortname from courseData or streamingShortname
      const shortname =
        courseData?.shortname || streamingShortname || shortnameParam;

      // Build URL with shortname, tag info, and source for proper back navigation
      let url = `/course/${courseId}`;
      const params = [];

      if (shortname) {
        params.push(`shortname=${encodeURIComponent(shortname)}`);
      }
      if (sourceFrom) {
        params.push(`from=${encodeURIComponent(sourceFrom)}`);
      }
      if (tagId) {
        params.push(`tagId=${tagId}`);
      }
      if (tagName) {
        params.push(`tagName=${encodeURIComponent(tagName)}`);
      }

      if (params.length > 0) {
        url += `?${params.join("&")}`;
      }

      router.push(url);
    } else {
      router.push("/course-management");
    }
  };

  const handleActivityClick = async (activityIndex: number) => {
    if (
      !courseData ||
      !courseData.sections ||
      courseData.sections.length === 0
    ) {
      return;
    }

    // Validate activityIndex
    if (activityIndex < 0 || activityIndex >= currentLessonActivities.length) {
      return;
    }

    const activity = currentLessonActivities[activityIndex];
    if (!activity) {
      return;
    }

    // Validate activity.index is within bounds
    if (activity.index < 0 || activity.index >= courseData.sections.length) {
      return;
    }

    // Check if section is password protected
    const targetSection = courseData.sections[activity.index];
    if (targetSection?.password && targetSection.sectionTitle) {
      const isUnlocked = isSectionUnlocked(
        courseId,
        targetSection.sectionTitle,
      );

      if (!isUnlocked) {
        setPasswordProtectedSection({
          title: targetSection.sectionTitle,
          password: targetSection.password,
          targetIndex: activity.index,
        });
        setShowPasswordDialog(true);
        return;
      }
    }

    // CRITICAL: Check if pre-test is completed before allowing navigation to other activities
    if (
      preTestDetected &&
      preTestQuizId &&
      activity.index !== preTestIndex &&
      !isPreTestCompletedResolved
    ) {
      setLockedType("activity");
      setLockedSectionTitle("Pre-test Required");
      setLockedActivityTitle(
        "You must complete the pre-test before accessing course activities",
      );
      setShowLockedDialog(true);
      return;
    }

    // Check if the clicked activity is locked
    const lockStatus = checkIfActivityLocked(activity.index);

    if (lockStatus.isLocked) {
      setLockedType(lockStatus.type);
      setLockedSectionTitle(lockStatus.blockingSectionTitle);
      setLockedActivityTitle(lockStatus.blockingActivityTitle);
      setShowLockedDialog(true);
      return;
    }

    // Track current activity (and pending video) before leaving — same logic as Next button so points are awarded
    if (activity.index !== currentPageIndex) {
      await trackCurrentActivityBeforeLeaving();
    }

    // CRITICAL: Determine the correct loading method based on actual data source
    // Check if we have streamed course data (even if useStreaming state is wrong)
    const hasStreamedData =
      streamedCourseData && streamedCourseData.sections?.length > 0;
    const hasDownloadedData =
      downloadedCourseData && downloadedCourseData.sections?.length > 0;

    // CRITICAL: Check URL params to determine if we should be in streaming mode
    // This handles the case where user navigates back and useStreaming state is reset
    const urlHasStreamingMode = mode === "streaming" || !!shortnameParam;
    const hasStreamingShortname = !!streamingShortname;

    // Use streaming if:
    // 1. useStreaming state is true, OR
    // 2. URL has streaming params, OR
    // 3. We have streamed data but not downloaded data, OR
    // 4. We have streamingShortname available
    const shouldUseStreaming =
      useStreaming ||
      urlHasStreamingMode ||
      (hasStreamedData && !hasDownloadedData) ||
      hasStreamingShortname;

    // Update URL to reflect selected page (same as Next/Previous)
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("page", activity.index.toString());
    window.history.replaceState({}, "", currentUrl.toString());

    // Navigate to the selected activity page
    // CRITICAL: Always use streaming if we have streamingShortname, even if courseData is from downloaded hook
    if (shouldUseStreaming && (streamingShortname || shortnameParam)) {
      await loadStreamedPage(activity.index);
    } else if (courseSource === "indexeddb") {
      loadPageContentFromIDB(activity.index, courseData);
    } else {
      // CRITICAL: Only use loadPageContent if we're sure we have downloaded files
      // If we're in streaming mode but fall through here, it will fail
      if (hasDownloadedData && !hasStreamedData && !urlHasStreamingMode) {
        loadPageContent(activity.index, courseData);
      } else {
        // Fallback: try streaming if we have shortname
        if (streamingShortname || shortnameParam) {
          await loadStreamedPage(activity.index);
        } else {
        }
      }
    }
    // Note: currentActivityIndexInLesson will be automatically updated by useActivityNavigation hook

    // Scroll to top after navigation (with delay to ensure content is rendered)
    setTimeout(() => {
      contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    }, 50);
  };

  // Swipe navigation hook (must be after handleNextPage and handlePreviousPage)
  const { handleTouchStart, handleTouchMove, handleTouchEnd } =
    useCourseSwipeNavigation({
      onSwipeLeft: handleNextPage,
      onSwipeRight: handlePreviousPage,
    });

  // Handle quiz submission with gamification
  const handleQuizSubmit = async (
    score: number,
    timeTaken: number,
    quizData: any,
  ) => {
    if (!courseData) {
      return;
    }

    const currentSection = courseData.sections?.[currentPageIndex];
    if (!currentSection) {
      return;
    }

    // Check if this is a pre-test
    // NOTE: Do NOT mark as attempted here - only mark when results are shown
    // This prevents users from bypassing pre-test by submitting and going back
    const isPreTest = preTestDetected && currentPageIndex === preTestIndex;

    // Get completion count before this quiz is marked complete
    const previousCompletedCount = getCompletionCount();
    const totalActivities = courseData.sections?.length || 0;

    const course = {
      id: courseData.id || parseInt(courseId),
      shortname: courseData.shortname || "",
      title: courseData.title || "",
      version: courseData.version || 1,
      gamificationEvents: (courseData as any).gamificationEvents,
    };

    const activity = {
      digest: currentSection.digest || "",
      title: currentSection.sectionTitle || "Quiz",
      type: "quiz",
      gamificationEvents: (currentSection as any).gamificationEvents,
    };

    // Extract maxScore from quizData (passed from QuizRenderer) or from currentSection
    // Priority: quizData.maxScore > currentSection.quizData.props.maxscore > default 100
    const maxScore =
      quizData?.maxScore ||
      (currentSection as any)?.quizData?.props?.maxscore ||
      (currentSection as any)?.content?.props?.maxscore ||
      100;

    // Extract pass threshold from quiz props (passthreshold) for gamification pass/fail
    const passThreshold = parseInt(
      (currentSection as any)?.quizData?.props?.passthreshold ||
        (currentSection as any)?.content?.props?.passthreshold ||
        "80",
      10,
    );

    // Extract raw score (correctAnswers) from quizData
    // The 'score' parameter is actually scorePercentage, but we need raw score (correctAnswers)
    // Priority: rawScore > correctAnswers > fallback to 0
    const rawScore = quizData?.rawScore || quizData?.correctAnswers || 0;

    // Track quiz attempt (including pre-tests): sends tracker + quiz attempt to backend, awards points
    try {
      const result = await trackQuizAttempt(
        course,
        activity,
        rawScore, // Pass raw score (correctAnswers), not percentage
        timeTaken,
        {
          ...quizData,
          maxScore: maxScore, // Ensure maxScore is set from module.xml props.maxscore
          passThreshold, // From quiz props.passthreshold for gamification pass/fail
        },
      );

      // Mark quiz as completed whenever it passes, even if points are 0
      // (e.g. pass on second attempt on the same day).
      // Keep daily completion marker tied to points-award behavior.
      if (result.passed && activity.digest) {
        const currentCompletionMap = getCompletionData(courseId) || new Map();

        let updatedCompletionMap = new Map(currentCompletionMap);
        updatedCompletionMap.set(activity.digest, true); // Lifetime completion

        // Add today's completion key only when this attempt is points-eligible.
        if (
          result.points > 0 &&
          !wasCompletedToday(currentCompletionMap, activity.digest)
        ) {
          updatedCompletionMap = markCompletedToday(
            currentCompletionMap,
            activity.digest,
          );
        }

        setCompletionData(courseId, updatedCompletionMap);
      }

      // Refresh points in sidebar
      await refreshPoints();

      // Show toast with quiz points (only if not already showing)
      if (result.points > 0) {
        triggerToast(
          currentSection.sectionTitle || "Quiz",
          result.points,
          courseData?.title || "Course",
          "quiz",
        );
      }

      // Check for badge milestone only when quiz passed the threshold
      if (result.passed) {
        const newCompletedCount = getCompletionCount();
        const badgeAwarded = checkForBadgeMilestone(
          previousCompletedCount,
          newCompletedCount,
          totalActivities,
        );

        if (badgeAwarded) {
          // Show badge toast after a delay (wait for activity toast to finish)
          setTimeout(() => {
            setAwardedBadge(badgeAwarded);
            setShowBadgeToast(true);
          }, 3500);
        }
      }
    } catch (error) {}
  };

  // Handle feedback submission with gamification
  const handleFeedbackSubmit = async (feedbackData: any) => {
    if (!courseData) {
      return;
    }

    const currentSection = courseData.sections?.[currentPageIndex];
    if (!currentSection) {
      return;
    }

    // Get completion count before this feedback is marked complete
    const previousCompletedCount = getCompletionCount();
    const totalActivities = courseData.sections?.length || 0;

    const course = {
      id: courseData.id || parseInt(courseId),
      shortname: courseData.shortname || "",
      title: courseData.title || "",
      version: courseData.version || 1,
      gamificationEvents: (courseData as any).gamificationEvents,
    };

    const activity = {
      digest: currentSection.digest || "",
      title: currentSection.sectionTitle || "Feedback",
      type: "feedback",
      gamificationEvents: (currentSection as any).gamificationEvents,
    };

    const timeTaken = Math.floor((Date.now() - activityStartTime) / 1000);

    try {
      const result = await trackFeedback(course, activity, timeTaken);

      // Update completion map in Zustand store
      // Only award points if not already completed today (daily limit)
      const currentCompletionMap = getCompletionData(courseId) || new Map();
      if (
        activity.digest &&
        result.points > 0 &&
        !wasCompletedToday(currentCompletionMap, activity.digest)
      ) {
        // Mark as completed for today
        const updatedCompletionMap = markCompletedToday(
          currentCompletionMap,
          activity.digest,
        );
        setCompletionData(courseId, updatedCompletionMap);
      }

      // Refresh points in sidebar
      await refreshPoints();

      // Show toast with feedback points
      if (result.points > 0) {
        triggerToast(
          currentSection.sectionTitle || "Feedback",
          result.points,
          courseData?.title || "Course",
          "feedback",
        );

        // Check for badge milestone after feedback completion
        const newCompletedCount = previousCompletedCount + 1;
        const badgeAwarded = checkForBadgeMilestone(
          previousCompletedCount,
          newCompletedCount,
          totalActivities,
        );

        if (badgeAwarded) {
          // Show badge toast after a delay (wait for activity toast to finish)
          setTimeout(() => {
            setAwardedBadge(badgeAwarded);
            setShowBadgeToast(true);
          }, 3500);
        }
      }
    } catch (error) {}
  };

  // Loading states: only full-screen load when we have no course data yet.
  // Once we have courseData, keep showing content (e.g. quiz results) even if loading flips true on refetch.
  // CRITICAL FIX: Removed `!user` gate. AuthProvider already handles auth redirects.
  // The `!user` check blocked rendering during Zustand hydration, preventing offline
  // course loading even when IndexedDB had the data ready. The course viewer should
  // render as soon as course data is available, regardless of user hydration state.
  const showFullScreenLoading = checkingMode || (loading && !rawCourseData);

  if (showFullScreenLoading) {
    if (downloading) {
      return (
        <PageLoading
          text="Loading course..."
          subText="This may take a few moments"
        />
      );
    }
    if (checkingMode) {
      return <PageLoading text="Loading course..." />;
    }
    if (useStreaming && streamingLoading) {
      return <PageLoading text="Streaming course..." />;
    }
    return <PageLoading />;
  }

  if (!loading && (error || !courseData)) {
    const isOfflineError =
      !courseData &&
      (error?.includes("offline") ||
        error?.includes("internet") ||
        error?.includes("connection") ||
        (error && !navigator.onLine));

    console.log("[CourseViewer] 🔍 Error state check:", {
      hasError: !!error,
      hasCourseData: !!courseData,
      isOnline: navigator.onLine,
      loading: loading,
      error: error,
      isOfflineError: isOfflineError,
      courseId: courseId,
      courseSource: courseSource,
    });

    if (isOfflineError) {
      console.log("[CourseViewer] ❌ Showing OfflineError component");
      return (
        <div className="min-h-screen w-full">
          <OfflineError
            message={
              error ||
              "You are offline and this course is not available offline."
            }
            courseId={courseId}
            showDownloadOption={true}
          />
        </div>
      );
    }

    console.log("[CourseViewer] ❌ Showing generic error");
    // Generic error
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-sm max-w-md">
          <p className="text-red-600 font-medium mb-4">
            {error || "Course not found"}
          </p>
          <BackButton
            onClick={handleExit}
            variant="outline"
            label="Back to Courses"
            iconSize="sm"
          />
        </div>
      </div>
    );
  }

  // Safe access to current section with bounds checking
  const currentSection =
    courseData?.sections &&
    currentPageIndex >= 0 &&
    currentPageIndex < courseData.sections.length
      ? courseData.sections[currentPageIndex]
      : null;

  // Detect info-section from course activity HTML (e.g. <info-section type="feedback">)
  // Use case-insensitive check and match tag with optional whitespace/attributes
  const isInfoSection = !!(
    typeof currentContent === "string" &&
    currentContent.length > 0 &&
    /<info-section[\s>]|<\/info-section>/i.test(currentContent)
  );
  // If no valid section, check if we're still loading or if it's truly an error
  if (!currentSection) {
    // If courseData exists but section is null, might be out of bounds - show error
    if (
      courseData &&
      courseData.sections &&
      currentPageIndex >= courseData.sections.length
    ) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center">
          <div className="text-center bg-white p-8 rounded-lg shadow-sm">
            <p className="text-red-600 font-medium mb-4">
              Invalid course section
            </p>
            <BackButton
              onClick={handleExit}
              variant="outline"
              label="Back to Courses"
              iconSize="sm"
            />
          </div>
        </div>
      );
    }

    // Otherwise, still loading - show loading screen
    return <PageLoading />;
  }

  return (
    <div
      className="flex flex-col fixed inset-0 h-dvh md:h-screen md:relative md:inset-auto z-40 bg-white overflow-hidden pb-14 md:pb-0"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}>
      {/* Badge Awarded Toast */}
      {awardedBadge && (
        <BadgeAwardedToast
          show={showBadgeToast}
          badgeType={awardedBadge}
          courseTitle={courseData?.title || "Course"}
          onClose={() => {
            setShowBadgeToast(false);
            setAwardedBadge(null);
            if (exitAfterBadgeCloseRef.current) {
              exitAfterBadgeCloseRef.current = false;
              handleExit();
            }
          }}
        />
      )}
      {/* Media Download Dialog */}
      <MediaDownloadDialog
        open={showMediaPrompt}
        onOpenChange={setShowMediaPrompt}
        missingMedia={missingMedia}
        onDownload={handleDownloadMedia}
        downloadingMedia={downloadingMedia}
        downloadProgress={mediaDownloadProgress}
      />
      {/* Locked Activity Dialog */}
      <LockedActivityDialog
        open={showLockedDialog}
        onOpenChange={setShowLockedDialog}
        lockedType={lockedType}
        currentSectionTitle={lockedSectionTitle}
        currentActivityTitle={lockedActivityTitle}
        isInActivityViewer={true}
        sequencing={courseData?.sequencing}
      />
      {/* Password Dialog */}
      {passwordProtectedSection && (
        <SectionPasswordDialog
          open={showPasswordDialog}
          onOpenChange={setShowPasswordDialog}
          sectionTitle={passwordProtectedSection.title}
          correctPassword={passwordProtectedSection.password}
          onUnlock={() => {
            // Unlock the section (this stores it in localStorage)
            unlockSection(courseId, passwordProtectedSection.title);

            // Verify it was stored
            const verifyUnlocked = isSectionUnlocked(
              courseId,
              passwordProtectedSection.title,
            );

            // Navigate to the target activity
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set(
              "page",
              passwordProtectedSection.targetIndex.toString(),
            );
            window.history.replaceState({}, "", currentUrl.toString());

            // Load the page
            const urlHasStreamingMode =
              mode === "streaming" || !!shortnameParam;
            const shouldUseStreamingForNav =
              useStreaming || urlHasStreamingMode || !!streamingShortname;

            if (
              shouldUseStreamingForNav &&
              (streamingShortname || shortnameParam)
            ) {
              loadStreamedPage(passwordProtectedSection.targetIndex);
            } else if (courseSource === "indexeddb") {
              loadPageContentFromIDB(
                passwordProtectedSection.targetIndex,
                courseData!,
              );
            } else {
              loadPageContent(
                passwordProtectedSection.targetIndex,
                courseData!,
              );
            }

            // Scroll to top
            setTimeout(() => {
              contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
            }, 50);
          }}
        />
      )}
      {/* Header */}
      <div className="shrink-0   md:z-99999 bg-white">
        <CourseHeader
          id="course-header"
          title={currentSection?.sectionTitle || "Module"}
          onBack={handleExit}
          // onMenuClick={() => setSidebarOpen(true)}
        />
      </div>
      {/* Desktop Sidebar Menu (Overlay) - commented out for now */}
      {/* <CourseViewerSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} /> */}
      {/* Activity Tabs */}
      <div className="shrink-0   md:z-99999 ">
        <ActivityTabs
          id="activity-tabs"
          activities={currentLessonActivities}
          currentIndex={currentActivityIndexInLesson}
          onActivityClick={handleActivityClick}
          isActivityLocked={(activityIndex) =>
            checkIfActivityLocked(activityIndex).isLocked
          }
        />
      </div>
      {/* Main Content Area - Scrollable (sits between header/tabs and course nav) */}
      <div
        ref={contentScrollRef}
        className="flex-1 min-h-0  overscroll-contain">
        <div
          id="course-content"
          className="w-full max-h-screen overflow-y-auto  ">
          {/* Render Quiz, Feedback, or Regular Content */}
          {currentSection?.type === "quiz" &&
          (currentSection?.quizData || (currentSection as any)?.content) ? (
            (() => {
              const isPreTest =
                preTestDetected && currentPageIndex === preTestIndex;
              const quizDataObj =
                currentSection.quizData || (currentSection as any).content;
              console.log(
                `[CourseViewer] 🎮 Rendering QuizRenderer — isPreTest: ${isPreTest}, quizId: ${quizDataObj?.id}, preTestQuizId: ${preTestQuizId}, currentPageIndex: ${currentPageIndex}, preTestIndex: ${preTestIndex}, passing onPreTestComplete: ${!!handlePreTestComplete}`,
              );
              return (
                <QuizRenderer
                  key={`quiz-${currentPageIndex}-${currentSection.digest}`}
                  quizData={{
                    ...quizDataObj,
                    digest: currentSection.digest,
                    courseShortname: courseData?.shortname,
                  }}
                  questionHtml={currentContent}
                  onComplete={handleNextPage}
                  onQuizSubmit={handleQuizSubmit}
                  isPreTest={isPreTest}
                  onPreTestComplete={handlePreTestComplete}
                  serverUrl={useStreaming ? streamingServerUrl : undefined}
                  courseId={
                    useStreaming
                      ? undefined
                      : courseSource === "indexeddb"
                        ? courseId
                        : undefined
                  }
                />
              );
            })()
          ) : currentSection?.type === "feedback" &&
            (currentSection?.quizData || (currentSection as any)?.content) ? (
            <FeedbackRenderer
              key={`feedback-${currentPageIndex}-${currentSection.digest}`}
              feedbackData={
                currentSection.quizData || (currentSection as any).content
              }
              questionHtml={currentContent}
              onComplete={handleNextPage}
              onFeedbackSubmit={handleFeedbackSubmit}
            />
          ) : (
            <div className="overflow-y-auto   ">
              <HtmlContentRenderer
                html={currentContent}
                courseId={
                  useStreaming
                    ? undefined
                    : courseSource === "indexeddb"
                      ? courseId
                      : undefined
                }
                mediaFiles={
                  useStreaming
                    ? streamingMediaFiles?.map((m) => ({
                        filename: m.filename,
                        downloadUrl: m.downloadUrl,
                        digest: m.digest,
                        filesize: m.filesize,
                        length: m.length,
                      }))
                    : undefined
                }
                allCourseMedia={
                  useStreaming
                    ? streamingAllMedia?.map((m) => ({
                        filename: m.filename,
                        downloadUrl: m.downloadUrl,
                        digest: m.digest,
                        filesize: m.filesize,
                        length: m.length,
                      }))
                    : undefined
                }
                serverUrl={useStreaming ? streamingServerUrl : undefined}
                shortname={
                  useStreaming ? streamingShortname || undefined : undefined
                }
                onVideoTracking={(filename, timeWatched, duration) => {
                  const decodedFilename = decodeURIComponent(filename);
                  // Accumulate in pending media map (supports multiple videos)
                  pendingMediaMapRef.current.set(decodedFilename, {
                    filename,
                    timeWatched,
                    duration,
                    mediaType: "video",
                  });

                  // Mark this specific media as played when ≥80% threshold
                  const videoPct =
                    duration > 0 ? (timeWatched / duration) * 100 : 0;
                  if (videoPct >= 80) {
                    mediaPlayedSetRef.current.add(decodedFilename);
                  }
                }}
                onAudioTracking={(filename, timeWatched, duration) => {
                  const decodedFilename = decodeURIComponent(filename);
                  // Accumulate in pending media map (supports multiple audios)
                  pendingMediaMapRef.current.set(decodedFilename, {
                    filename,
                    timeWatched,
                    duration,
                    mediaType: "audio",
                  });

                  // Mark this specific media as played when ≥80% threshold
                  const pct = duration > 0 ? (timeWatched / duration) * 100 : 0;
                  if (pct >= 80) {
                    mediaPlayedSetRef.current.add(decodedFilename);
                  }
                }}
                onVideoComplete={(filename, timeWatched, duration) => {
                  // Video finished playing (100%) — track immediately
                  handleMediaFullCompletion(
                    "video",
                    filename,
                    timeWatched,
                    duration,
                  );
                }}
                onAudioComplete={(filename, timeWatched, duration) => {
                  // Audio finished playing (100%) — track immediately
                  handleMediaFullCompletion(
                    "audio",
                    filename,
                    timeWatched,
                    duration,
                  );
                }}
                onNext={handleNextPage}
                digest={currentSection?.digest}
                onHasSlidesChange={handleSlidesChange}
                onPdfOpen={handlePdfOpen}
              />{" "}
            </div>
          )}
        </div>
      </div>
      {/* Navigation Footer - Show if:
          - Activity doesn't have slides (normal case), OR
          - Activity has slides AND user is on first slide (show Previous to go to prev activity), OR
          - Activity has slides AND user is on last slide (show Next to go to next activity)
          - BUT hide if currently viewing a pretest
          - info-section can still render nav when section type is feedback (handled by second condition)
      */}
      {(!(hasSlidesWithNavigation || htmlHasSlides) ||
        isOnFirstSlide ||
        isOnLastSlide) &&
        !(preTestDetected && currentPageIndex === preTestIndex) &&
        (isInfoSection ||
          (currentSection?.type !== "quiz" &&
            currentSection?.type !== "feedback")) && (
          <CourseNavigation
            id="course-navigation"
            currentPage={currentPageIndex}
            totalPages={courseData?.sections?.length || 0}
            onPrevious={handlePreviousPage}
            onNext={handleNextPage}
            canGoPrevious={
              currentPageIndex > 0 &&
              !(
                preTestDetected &&
                currentPageIndex - 1 === preTestIndex &&
                isPreTestCompletedResolved
              )
            }
            canGoNext={!!courseData?.sections && courseData.sections.length > 0}
            nextLabel={
              courseData?.sections &&
              currentPageIndex >= courseData.sections.length - 1
                ? "Finish"
                : "Next"
            }
            currentActivityInSection={currentActivityIndexInLesson + 1}
            totalActivitiesInSection={currentLessonActivities.length}
            isOnFirstSlide={
              hasSlidesWithNavigation || htmlHasSlides
                ? isOnFirstSlide
                : undefined
            }
            isOnLastSlide={
              hasSlidesWithNavigation || htmlHasSlides
                ? isOnLastSlide
                : undefined
            }
          />
        )}
    </div>
  );
}
