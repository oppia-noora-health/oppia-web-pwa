"use client";

import { useAuthStore, useActivityCompletionStore } from "@/store/useStore";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BackButton } from "@/components/ui/back-button";
import { PageLoading } from "@/components/Loading";
import { CourseModuleHeader } from "@/components/course/CourseModuleHeader";
import { CourseCompletionBadge } from "@/components/course/CourseCompletionBadge";
import { LessonCard } from "@/components/course/LessonCard";
import MediaDownloadDialog from "@/components/course/MediaDownloadDialog";
import LockedActivityDialog from "@/components/course/LockedActivityDialog";
import PreTestModal from "@/components/course/PreTestModal";
import SectionPasswordDialog from "@/components/course/SectionPasswordDialog";
import {
  isSectionUnlocked,
  unlockSection,
} from "@/utils/sectionPasswordStorage";
import { useCourseModules } from "@/hooks/useCourseModules";
import { useMediaDownload } from "@/hooks/useMediaDownload";
import { useTranslation } from "@/hooks/useTranslation";
import { useTour } from "@/hooks/useTour";
import { useCompletionDataWithRehydration } from "@/hooks/useZustandRehydration";
import { getCourseDetailsTour } from "@/config/tourSteps";
import { loadCourseFromIDB } from "@/utils/courseLoaderIDB";
import { isCourseDownloaded } from "@/utils/courseStorageIDB";
import { getLocalizedText } from "@/utils/localization";
import { preCacheCourseViewPage } from "@/utils/pageCaching";
import {
  hasAttemptedPreTest,
  isPreTestTitle,
  isPreTestCompleted,
} from "@/utils/preTestStorage";
import { activityTrackingService } from "@/services/activityTrackingService";
import { getLastVisitedActivity } from "@/utils/lastActivityStorage";
import type { SequencingType } from "@/services/courseDownloadService";
import { Play } from "lucide-react";

export default function CourseModulesPage() {
  const { user, isAuthenticated } = useAuthStore();
  const { getCompletionData } = useActivityCompletionStore();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const courseId = params.id as string;
  const shortnameFromUrl = searchParams?.get("shortname");
  const tagId = searchParams?.get("tagId");
  const sourceFrom = searchParams?.get("from");
  const tagName = searchParams?.get("tagName");
  const { t } = useTranslation();

  // State to track if course is downloaded (checked before calling useCourseModules)
  const [isDownloadedCheck, setIsDownloadedCheck] = useState<boolean | null>(
    null,
  );
  const [checkingDownload, setCheckingDownload] = useState(true);

  // Pre-test state
  const [showPreTestModal, setShowPreTestModal] = useState(false);
  const [preTestQuizId, setPreTestQuizId] = useState<string | number | null>(
    null,
  );
  const [preTestIndex, setPreTestIndex] = useState<number | null>(null);
  const preTestDetectionRunRef = useRef(false);

  // Resume functionality state
  const [hasResume, setHasResume] = useState(false);
  const [lastVisitedInfo, setLastVisitedInfo] = useState<{
    activityTitle: string;
    lessonTitle: string;
  } | null>(null);

  // Check if course was explicitly downloaded (isDownloaded flag is true)
  // Not just cached for viewing (which would have isDownloaded: false)
  useEffect(() => {
    async function checkIfDownloaded() {
      try {
        const isDownloaded = await isCourseDownloaded(courseId);
        setIsDownloadedCheck(isDownloaded);
      } catch (error) {
        setIsDownloadedCheck(false);
      } finally {
        setCheckingDownload(false);
      }
    }
    checkIfDownloaded();
  }, [courseId]);

  // Check for last visited activity on mount
  useEffect(() => {
    const lastActivity = getLastVisitedActivity(courseId);
    if (lastActivity) {
      setHasResume(true);
      setLastVisitedInfo({
        activityTitle: lastActivity.activityTitle,
        lessonTitle: lastActivity.lessonTitle,
      });
    }
  }, [courseId]);

  // Check for last visited activity on mount
  useEffect(() => {
    const lastActivity = getLastVisitedActivity(courseId);
    if (lastActivity) {
      setHasResume(true);
      setLastVisitedInfo({
        activityTitle: lastActivity.activityTitle,
        lessonTitle: lastActivity.lessonTitle,
      });
    }
  }, [courseId]);

  // Detect if user is coming back from viewer page
  const [isReturningFromViewer, setIsReturningFromViewer] = useState(false);

  useEffect(() => {
    // Check if user is navigating back from /view page
    const referrer = document.referrer;
    const isFromViewer = referrer.includes(`/course/${courseId}/view`);

    // Also check Performance Navigation API for back navigation
    const navigation = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming;
    const isBackNavigation = navigation?.type === "back_forward";

    if (isFromViewer || (isBackNavigation && referrer.includes("/view"))) {
      setIsReturningFromViewer(true);

      // Clear the flag after fetch completes (useCourseModules will handle the refresh)
      // Keep it true long enough for the hook to detect it
      const timer = setTimeout(() => {
        setIsReturningFromViewer(false);
      }, 2000); // Keep flag for 2 seconds to ensure hook processes it

      return () => clearTimeout(timer);
    }
  }, [courseId]);

  // Use streaming mode if course is not downloaded and shortname is available
  const shouldUseStreaming = isDownloadedCheck === false && !!shortnameFromUrl;

  const { loading, courseData, lessons, error, downloading, courseSource } =
    useCourseModules(courseId, {
      skipDownload: shouldUseStreaming,
      shortname: shortnameFromUrl,
      forceRefresh: isReturningFromViewer, // Pass flag to force refresh
    });

  const {
    isOnline,
    missingMedia,
    mediaGateStatus,
    mediaGateError,
    showMediaPrompt,
    setShowMediaPrompt,
    downloadingMedia,
    mediaDownloadProgress,
    mediaNotice,
    closeMediaNotice,
    handleDownloadMedia,
    refreshMissingMedia,
  } = useMediaDownload(courseId, courseSource);

  // Log completion data on mount and when it changes
  // Use rehydration hook to ensure Zustand persist middleware has loaded data
  const { isRehydrated, completionData, completionCount } =
    useCompletionDataWithRehydration(courseId);

  useEffect(() => {
    if (!isRehydrated) {
      return;
    }
  }, [courseId, completionCount, completionData, isRehydrated]);

  // Check if course is downloaded (from IndexedDB or localStorage)
  const isDownloaded = courseSource === "indexeddb" || courseSource === "cache";

  const isDownloadedCourseSource =
    courseSource === "indexeddb" || courseSource === "cache";

  const isMediaBlockedForDownloadedCourse =
    !shouldUseStreaming &&
    isDownloadedCourseSource &&
    (mediaGateStatus === "checking" ||
      mediaGateStatus === "blocked-missing" ||
      mediaGateStatus === "downloading" ||
      mediaGateStatus === "error");

  // Get shortname from courseData or URL params (for streaming mode)
  const shortname = courseData?.shortname || shortnameFromUrl;

  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(
    new Set(),
  );

  // Locked activity dialog state
  const [showLockedDialog, setShowLockedDialog] = useState(false);
  const [lockedType, setLockedType] = useState<"section" | "activity">(
    "activity",
  );
  const [lockedSectionTitle, setLockedSectionTitle] = useState<string>("");
  const [lockedActivityTitle, setLockedActivityTitle] = useState<string>("");
  const [clickedActivityTitle, setClickedActivityTitle] = useState<string>("");

  // Password dialog state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordProtectedSection, setPasswordProtectedSection] = useState<{
    title: string;
    password: string;
    activityIndex: number;
  } | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const ensureMediaGateBeforeViewerOpen = (): boolean => {
    if (!isMediaBlockedForDownloadedCourse) {
      return true;
    }

    if (mediaGateStatus === "blocked-missing") {
      setShowMediaPrompt(true);
    }

    return false;
  };

  /**
   * Check if a target page index is locked based on sequencing type
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

    const sequencing = ((courseData as any).sequencing ||
      "none") as SequencingType;

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

  // Tour setup - Course Details page (one-time only)
  const { startTour, hasCompletedTour } = useTour("course-details");

  // Pre-test modal handlers
  const handlePreTestCancel = () => {
    setShowPreTestModal(false);

    // Navigate to course management page
    // If tag info exists, go to tag-specific page, otherwise go to course home
    if (tagId && tagName) {
      const url = `/course-management/${tagId}?name=${encodeURIComponent(tagName)}`;
      router.push(url);
    } else {
      router.push("/course-management");
    }
  };

  const handlePreTestOpen = () => {
    if (!ensureMediaGateBeforeViewerOpen()) {
      return;
    }

    setShowPreTestModal(false);

    // DO NOT mark as attempted here - only mark when quiz is submitted and results are shown
    // This prevents users from bypassing pre-test by just opening it and going back

    // Navigate to course viewer with pre-test page
    // Include shortname and other params for streaming mode to work immediately
    const params = [`page=${preTestIndex}`];

    // Add shortname if available (needed for streaming mode)
    // Use shortnameFromUrl first (from URL params) as it's immediately available
    // Fallback to shortname (from courseData) if available
    const shortnameToUse = shortnameFromUrl || shortname;
    if (shortnameToUse) {
      params.push(`shortname=${encodeURIComponent(shortnameToUse)}`);
    }

    // Add mode=streaming if using streaming mode
    if (shouldUseStreaming) {
      params.push(`mode=streaming`);
    }

    // Add pretest completion status (opening pretest = not done yet)
    params.push(`pretestDone=0`);

    // Add tag info if available
    if (tagId) {
      params.push(`tagId=${tagId}`);
    }
    if (tagName) {
      params.push(`tagName=${encodeURIComponent(tagName)}`);
    }

    const viewUrl = `/course/${courseId}/view?${params.join("&")}`;
    // CRITICAL: Always use window.location.href — navigator.onLine is unreliable
    window.location.href = viewUrl;
  };

  // Note: Auth redirect is handled by AuthProvider, no need to duplicate here

  // Auto-trigger tour for first-time visitors
  useEffect(() => {
    if (
      isAuthenticated &&
      !loading &&
      courseData &&
      lessons.length > 0 &&
      !hasCompletedTour()
    ) {
      const timer = setTimeout(() => {
        const tourSteps = getCourseDetailsTour();
        startTour(tourSteps);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [
    isAuthenticated,
    loading,
    courseData,
    lessons.length,
    hasCompletedTour,
    startTour,
  ]);

  // Pre-cache view page when course detail page loads (for offline access)
  // CRITICAL: Skip caching if user is returning from viewer page (forceRefresh)
  useEffect(() => {
    // Don't cache if user is returning from viewer - they want fresh data
    if (isReturningFromViewer) {
      return;
    }

    if (!loading && courseData && isDownloaded && navigator.onLine) {
      // Small delay to not block initial render
      const timer = setTimeout(() => {
        preCacheCourseViewPage(courseId, shortname || undefined);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [
    loading,
    courseData,
    isDownloaded,
    courseId,
    shortname,
    isReturningFromViewer,
  ]);

  // Pre-test detection
  useEffect(() => {
    // Skip if detection has already run (prevents re-triggering on courseData refresh)
    if (preTestDetectionRunRef.current) {
      return;
    }

    // Don't check pre-test if user is navigating to viewer page
    // Check if we're currently on the detail page (not viewer)
    const currentPath =
      typeof window !== "undefined" ? window.location.pathname : "";
    const isOnViewerPage = currentPath.includes("/view");

    if (isOnViewerPage) {
      return;
    }

    if (!loading && courseData && courseData.sections) {
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
            // Mark detection as run to prevent re-triggering
            preTestDetectionRunRef.current = true;

            const pretestDigest = section.digest;
            const shortnameToUse = shortname;

            // Check /activity API first: if ANY pretest attempt exists on server, don't show modal
            const checkAndShowModal = async () => {
              if (pretestDigest && shortnameToUse) {
                try {
                  const response =
                    await activityTrackingService.getCourseActivityTracking(
                      shortnameToUse,
                    );

                  // Check if ANY attempt exists (regardless of pass/fail status)
                  const hasAnyAttempt = response.trackers.some(
                    (tracker) =>
                      tracker.digest === pretestDigest &&
                      tracker.type === "quiz",
                  );

                  if (hasAnyAttempt) {
                    return; // Don't show modal if any attempt exists
                  }
                } catch (e) {}
              }

              // Check THREE fallbacks before showing modal:
              // 1. localStorage pre-test flags (attempted / results_shown)
              // 2. Zustand completion store (has digest marked as completed)
              const attemptedLocal = hasAttemptedPreTest(courseId, quizId);
              const isCompletedLocal = isPreTestCompleted(courseId, quizId);
              const completionMap = getCompletionData(courseId);
              const attemptedInZustand = pretestDigest
                ? completionMap?.get(pretestDigest) || false
                : false;

              if (attemptedLocal || isCompletedLocal || attemptedInZustand) {
                return;
              }

              // CRITICAL OFFLINE FIX: When offline and API is unreachable, don't force pretest modal
              // User will see pretest in the viewer page if needed, but don't block detail page access
              if (!navigator.onLine) {
                return;
              }

              setPreTestQuizId(quizId);
              setPreTestIndex(i);
              setShowPreTestModal(true);
            };
            void checkAndShowModal();

            // Stop after finding the first pre-test
            break;
          } else {
          }
        }
      }
    } else {
    }
  }, [loading, courseData, courseId]);

  const toggleLesson = (lessonId: string) => {
    setExpandedLessons((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(lessonId)) {
        newSet.delete(lessonId);
      } else {
        newSet.add(lessonId);
      }
      return newSet;
    });
  };

  // Helper: synchronously check if pretest is completed from all local sources
  // Passed as query param so the viewer page can trust this offline
  const isPretestDone = (): boolean => {
    if (!preTestQuizId || preTestIndex === null) return true; // no pretest = done
    const attemptedLocal = hasAttemptedPreTest(courseId, preTestQuizId);
    const completedLocal = isPreTestCompleted(courseId, preTestQuizId);
    const digest = courseData?.sections?.[preTestIndex]?.digest;
    const completionMap = getCompletionData(courseId);
    const zustandDone = digest ? completionMap?.get(digest) || false : false;
    return attemptedLocal || completedLocal || zustandDone;
  };

  const handleActivityClick = async (activityId: string) => {
    if (!ensureMediaGateBeforeViewerOpen()) {
      return;
    }

    if (!courseData) {
      return;
    }

    const activityIndex = courseData.sections.findIndex(
      (section) => section.id === activityId,
    );

    if (activityIndex !== -1) {
      const targetSection = courseData.sections[activityIndex];

      // Check if section is password protected
      if (targetSection?.password && targetSection.sectionTitle) {
        const isUnlocked = isSectionUnlocked(
          courseId,
          targetSection.sectionTitle,
        );

        if (!isUnlocked) {
          setPasswordProtectedSection({
            title: targetSection.sectionTitle,
            password: targetSection.password,
            activityIndex,
          });
          setShowPasswordDialog(true);
          return;
        }
      }

      // Check if this activity is locked
      const lockStatus = checkIfActivityLocked(activityIndex);

      if (lockStatus.isLocked) {
        setLockedType(lockStatus.type);
        setLockedSectionTitle(lockStatus.blockingSectionTitle);
        setLockedActivityTitle(lockStatus.blockingActivityTitle);
        setClickedActivityTitle(targetSection.title || "this activity");
        setShowLockedDialog(true);
        return;
      }

      // Build view URL - use streaming mode if course is not downloaded
      // Use shortnameFromUrl first (immediately available) as fallback to shortname
      const shortnameToUse = shortnameFromUrl || shortname;
      const params = [`page=${activityIndex}`];

      // Add shortname and mode if using streaming (needed for fast loading)
      if (shouldUseStreaming && shortnameToUse) {
        params.push(`mode=streaming`);
        params.push(`shortname=${encodeURIComponent(shortnameToUse)}`);
      }

      // Add pretest completion status so viewer page knows offline
      params.push(`pretestDone=${isPretestDone() ? "1" : "0"}`);

      // Add tag info for proper back navigation
      if (tagId) {
        params.push(`tagId=${tagId}`);
      }
      if (tagName) {
        params.push(`tagName=${encodeURIComponent(tagName)}`);
      }

      const url = `/course/${courseId}/view?${params.join("&")}`;

      const baseViewUrl = `/course/${courseId}/view?${params.filter((p) => p.startsWith("page=") || p.startsWith("mode=") || p.startsWith("shortname=")).join("&")}`;

      // Set navigating state so user sees feedback immediately (works offline too)
      if (!isNavigating) setIsNavigating(true);

      // Pre-cache the view page before navigating (if online)
      // CRITICAL: Skip caching if user is returning from viewer page
      if (navigator.onLine && !isReturningFromViewer) {
        try {
          await fetch(baseViewUrl, { cache: "reload" });
        } catch (e) {
          // Fetch failed, but continue with navigation
        }
      }

      // CRITICAL: Always use window.location.href for viewer navigation.
      // navigator.onLine is unreliable (returns true when DNS fails / network
      // is down). router.push loses query params when the RSC payload fetch
      // fails, causing the viewer to default to page 0 (pre-test).
      window.location.href = url;
    } else {
    }
  };

  const handleBack = () => {
    // Navigate back to the source page
    if (sourceFrom === "course") {
      // User came from /course (downloaded courses list)
      router.push("/course");
    } else if (tagId && tagName) {
      // User came from /course-management/[tagId]
      router.push(
        `/course-management/${tagId}?name=${encodeURIComponent(tagName)}`,
      );
    } else {
      // Fallback to course management if no clear source
      router.push("/course-management");
    }
  };

  const handleResume = () => {
    if (!ensureMediaGateBeforeViewerOpen()) {
      return;
    }

    const lastActivity = getLastVisitedActivity(courseId);
    if (!lastActivity) return;

    // Build URL based on mode - use params array for consistency
    const params = [`page=${lastActivity.activityIndex}`];

    // Use shortname from lastActivity or current context
    const shortnameToUse =
      lastActivity.shortname || shortnameFromUrl || shortname;

    // Add streaming params if needed
    if (
      (lastActivity.mode === "streaming" || shouldUseStreaming) &&
      shortnameToUse
    ) {
      params.push(`mode=streaming`);
      params.push(`shortname=${encodeURIComponent(shortnameToUse)}`);
    }

    // Add pretest completion status so viewer page knows offline
    params.push(`pretestDone=${isPretestDone() ? "1" : "0"}`);

    // Add tag info
    if (tagId) {
      params.push(`tagId=${tagId}`);
    }
    if (tagName) {
      params.push(`tagName=${encodeURIComponent(tagName)}`);
    }

    const url = `/course/${courseId}/view?${params.join("&")}`;
    // CRITICAL: Always use window.location.href — navigator.onLine is unreliable
    window.location.href = url;
  };

  // Show loading while checking if course is downloaded or while loading course data
  if (!user || checkingDownload || loading) {
    if (downloading) {
      return <PageLoading text={t("common.loading")} />;
    }
    if (isNavigating) {
      return <PageLoading text={t("common.loading")} />;
    }
    return <PageLoading />;
  }

  if (error || !courseData) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-sm">
          <p className="text-red-600 font-medium mb-4">
            {error || t("course.noCourses")}
          </p>
          <BackButton
            onClick={handleBack}
            variant="outline"
            label={t("common.back")}
            iconSize="sm"
          />
        </div>
      </div>
    );
  }

  if (isMediaBlockedForDownloadedCourse && mediaGateStatus === "checking") {
    return <PageLoading />;
  }

  // Calculate total completion from all lessons
  const totalCompletedActivities = lessons.reduce(
    (sum, lesson) => sum + lesson.activitiesCompleted,
    0,
  );
  const totalActivities = lessons.reduce(
    (sum, lesson) => sum + lesson.totalActivities,
    0,
  );

  return (
    <div className="min-h-screen w-full">
      {/* Locked Activity Dialog */}
      <MediaDownloadDialog
        open={showMediaPrompt}
        onOpenChange={setShowMediaPrompt}
        missingMedia={missingMedia}
        onDownload={handleDownloadMedia}
        downloadingMedia={downloadingMedia}
        downloadProgress={mediaDownloadProgress}
        mediaNotice={mediaNotice}
        onMediaNoticeClose={closeMediaNotice}
      />

      <LockedActivityDialog
        open={showLockedDialog}
        onOpenChange={setShowLockedDialog}
        lockedType={lockedType}
        currentSectionTitle={lockedSectionTitle}
        currentActivityTitle={lockedActivityTitle}
        isInActivityViewer={false}
        clickedActivityTitle={clickedActivityTitle}
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
            if (!ensureMediaGateBeforeViewerOpen()) {
              return;
            }

            // Unlock the section (this stores it in localStorage)
            unlockSection(courseId, passwordProtectedSection.title);

            // Navigate to the activity
            const shortnameToUse = shortnameFromUrl || shortname;
            const params = [`page=${passwordProtectedSection.activityIndex}`];

            if (shouldUseStreaming && shortnameToUse) {
              params.push(`mode=streaming`);
              params.push(`shortname=${encodeURIComponent(shortnameToUse)}`);
            }

            if (tagId) {
              params.push(`tagId=${tagId}`);
            }
            if (tagName) {
              params.push(`tagName=${encodeURIComponent(tagName)}`);
            }

            // Add pretest completion status so viewer page knows offline
            params.push(`pretestDone=${isPretestDone() ? "1" : "0"}`);

            const url = `/course/${courseId}/view?${params.join("&")}`;
            // CRITICAL: Always use window.location.href — navigator.onLine is unreliable
            window.location.href = url;
          }}
        />
      )}
      {/* Pre-test Modal */}
      {showPreTestModal && (
        <PreTestModal
          onCancel={handlePreTestCancel}
          onOpen={handlePreTestOpen}
        />
      )}
      {/* Header */}
      <header className="bg-white border-b px-4 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <BackButton
            onClick={handleBack}
            label={t("common.back")}
            iconSize="md"
          />
        </div>
      </header>
      {/* Main Content */}
      <div id="course-info" className="max-w-4xl mx-auto px-4 py-6">
        {isMediaBlockedForDownloadedCourse && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm text-amber-900 font-medium">
              {mediaGateStatus === "checking"
                ? t("media.gateCheckBeforeOpen")
                : mediaGateStatus === "downloading"
                  ? t("media.gateBannerDownloading")
                  : !isOnline
                    ? t("media.gateBannerOffline").replace(
                        "{count}",
                        String(missingMedia.length),
                      )
                    : t("media.gateBannerMissing").replace(
                        "{count}",
                        String(missingMedia.length),
                      )}
            </p>
            {mediaGateError ? (
              <p className="mt-2 text-xs text-red-700">{mediaGateError}</p>
            ) : null}
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={handleDownloadMedia}
                disabled={
                  mediaGateStatus === "checking" ||
                  mediaGateStatus === "downloading" ||
                  downloadingMedia ||
                  !isOnline
                }
                className="inline-flex items-center justify-center rounded-md bg-cyan-600 text-white px-3 py-2 text-sm font-medium hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed">
                {!isOnline
                  ? t("media.gateReconnectToDownload")
                  : mediaGateStatus === "downloading" || downloadingMedia
                    ? t("media.gateDownloadingShort")
                    : t("media.gateDownloadMissingMedia")}
              </button>
              <button
                onClick={refreshMissingMedia}
                disabled={mediaGateStatus === "downloading" || downloadingMedia}
                className="inline-flex items-center justify-center rounded-md border border-amber-400 bg-white text-amber-900 px-3 py-2 text-sm font-medium hover:bg-amber-100 disabled:opacity-60 disabled:cursor-not-allowed">
                {t("media.gateRecheck")}
              </button>
            </div>
          </div>
        )}

        <CourseModuleHeader
          title={courseData.title}
          totalActivities={courseData.totalPages}
          totalLessons={lessons.length}
        />

        {/* Course Completion Badge */}
        <CourseCompletionBadge
          completedActivities={totalCompletedActivities}
          totalActivities={totalActivities}
        />

        {/* Resume Button */}
        {hasResume && lastVisitedInfo && (
          <div className="mb-4">
            <button
              onClick={handleResume}
              className="w-full bg-[#C51957] text-white py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium">
              <Play className="w-5 h-5" fill="currentColor" />
              <span className="text-base">
                {t("course.resume")}{" "}
                <span className="font-semibold">
                  {lastVisitedInfo.activityTitle}
                </span>
              </span>
            </button>
          </div>
        )}

        {/* Lessons List */}
        <div id="course-sections" className="space-y-3 lg:gap-4">
          {lessons.map((lesson, index) => (
            <LessonCard
              key={lesson.id}
              id={index === 0 ? "activity-item" : undefined}
              lesson={lesson}
              isExpanded={expandedLessons.has(lesson.id)}
              onToggle={() => toggleLesson(lesson.id)}
              onActivityClick={handleActivityClick}
              courseId={courseId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
