"use client";

import { useAuthStore, useActivityCompletionStore } from "@/store/useStore";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  preCacheStaticPagesOnLogin,
  cachePageWithDependencies,
} from "@/utils/pageCaching";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PageLoading } from "@/components/Loading";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { CourseCard } from "@/components/course/CourseCard";
import { CourseContextMenu } from "@/components/course/CourseContextMenu";
import MediaDownloadDialog from "@/components/course/MediaDownloadDialog";
import { useContextMenu } from "@/hooks/useContextMenu";

import { useTour } from "@/hooks/useTour";
import { getHomePageTour } from "@/config/tourSteps";
import { useTranslation } from "@/hooks/useTranslation";
import { activityTrackingService } from "@/services/activityTrackingService";
import { clearCourseGamificationData } from "@/utils/gamificationIDB";
import {
  clearPreTestForCourse,
  syncPreTestFromTrackers,
} from "@/utils/preTestStorage";
import { clearLastVisitedActivity } from "@/utils/lastActivityStorage";
import { getCourseFromIDB } from "@/utils/courseStorageIDB";
import { clearCachedActivityTracking } from "@/utils/offlineStorageIDB";
import {
  useInstalledCourses,
  type InstalledCourse,
} from "@/hooks/useInstalledCourses";
import { ActivityCompletionToast } from "@/components/course/ActivityCompletionToast";
import {
  getMissingMedia,
  downloadAllMissingMedia,
} from "@/services/mediaDownloadService";
import type { Media, MediaDownloadProgress } from "@/types/media";
import type { MediaNotice } from "@/hooks/useMediaDownload";
import { Search, X } from "lucide-react";

export default function CoursePage() {
  const { isAuthenticated } = useAuthStore();
  const { setCompletionData, getCompletionData } = useActivityCompletionStore();
  const router = useRouter();
  const { installedCourses, loading, removeCourse, refetch } =
    useInstalledCourses();

  const { t } = useTranslation();
  const {
    contextMenu,
    handleContextMenu,
    handleLongPressStart,
    handleLongPressEnd,
    closeContextMenu,
  } = useContextMenu<InstalledCourse & { isDownloaded?: boolean }>();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<InstalledCourse | null>(
    null,
  );
  const [isNavigating, setIsNavigating] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastData, setToastData] = useState({
    activityTitle: "",
    pointsEarned: 0,
  });
  const [cardStatuses, setCardStatuses] = useState<Record<string, string>>({});
  const [mediaPromptOpen, setMediaPromptOpen] = useState(false);
  const [mediaPromptCourseId, setMediaPromptCourseId] = useState<string | null>(
    null,
  );
  const [missingMedia, setMissingMedia] = useState<Media[]>([]);
  const [downloadingMedia, setDownloadingMedia] = useState(false);
  const [mediaDownloadProgress, setMediaDownloadProgress] =
    useState<MediaDownloadProgress | null>(null);
  const [mediaNotice, setMediaNotice] = useState<MediaNotice | null>(null);
  const mediaDownloadInFlightRef = useRef(false);

  // Hydration guard: prevents SSR/prerendering from reaching SidebarTrigger
  // (which requires SidebarProvider only available on the client).
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Tour setup - Home page specific tour
  const { startTour, hasCompletedTour } = useTour("home-page");

  // Note: Auth redirect is handled by AuthProvider, no need to duplicate here

  // Pre-cache settings, privacy, profile, about/help when user visits /course (for offline access)
  useEffect(() => {
    if (isAuthenticated && navigator.onLine) {
      preCacheStaticPagesOnLogin().catch((err) => void 0);
    }
  }, [isAuthenticated]);

  // Pre-cache downloaded course detail pages so offline navigation works reliably.
  useEffect(() => {
    if (!navigator.onLine || installedCourses.length === 0) return;

    const cacheCoursePages = async () => {
      for (const course of installedCourses) {
        const basePath = `/course/${course.courseId}`;
        try {
          await cachePageWithDependencies(basePath);
          await cachePageWithDependencies(`${basePath}?from=course`);
        } catch (error) {
          // Ignore individual caching failures to avoid blocking the UI.
        }
      }
    };

    cacheCoursePages().catch((err) => void 0);
  }, [installedCourses]);
  // Auto-trigger tour for first-time visitors
  useEffect(() => {
    if (isAuthenticated && !loading && !hasCompletedTour()) {
      // Delay tour slightly to ensure page is fully rendered
      const timer = setTimeout(() => {
        const tourSteps = getHomePageTour();
        startTour(tourSteps);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, loading, hasCompletedTour, startTour]);

  const handleCourseClick = async (courseId: string) => {
    if (isNavigating) return; // Prevent double clicks

    try {
      const missing = await getMissingMedia(courseId);
      if (missing.length > 0) {
        setMediaPromptCourseId(courseId);
        setMissingMedia(missing);
        setMediaPromptOpen(true);
        return;
      }
    } catch {
      // If verification fails, continue to course page where a second guard exists.
    }

    setIsNavigating(true);

    router.push(`/course/${courseId}?from=course`);

    // Reset after navigation attempt
    setTimeout(() => setIsNavigating(false), 1000);
  };

  const handleDownloadMissingMediaFromCoursePage = async () => {
    if (!mediaPromptCourseId) return;
    if (mediaDownloadInFlightRef.current || downloadingMedia) return;

    if (!navigator.onLine) {
      setMediaNotice({
        open: true,
        title: t("media.gateOfflineTitle"),
        message: t("media.gateOfflineDownloadAlert"),
        tone: "warning",
      });
      return;
    }

    setDownloadingMedia(true);
    mediaDownloadInFlightRef.current = true;
    setMediaPromptOpen(false);

    try {
      await downloadAllMissingMedia(mediaPromptCourseId, (progress) =>
        setMediaDownloadProgress(progress),
      );

      const remaining = await getMissingMedia(mediaPromptCourseId);
      setMissingMedia(remaining);

      if (remaining.length > 0) {
        setMediaPromptOpen(true);
        setMediaNotice({
          open: true,
          title: t("media.gateDownloadRequiredTitle"),
          message: t("media.gateMissingAfterDownload"),
          tone: "warning",
        });
        return;
      }

      setMediaNotice({
        open: true,
        title: t("success.downloaded"),
        message: t("media.gateReadyDesc"),
        tone: "success",
      });

      setIsNavigating(true);
      router.push(`/course/${mediaPromptCourseId}?from=course`);
      setTimeout(() => setIsNavigating(false), 1000);
    } catch {
      setMediaNotice({
        open: true,
        title: t("error.downloadFailed"),
        message: t("media.downloadFailedMediaAlert"),
        tone: "error",
      });
      setMediaPromptOpen(true);
    } finally {
      setDownloadingMedia(false);
      setMediaDownloadProgress(null);
      mediaDownloadInFlightRef.current = false;
    }
  };

  const handleMenuClick = (e: React.MouseEvent, course: InstalledCourse) => {
    e.stopPropagation();
    handleContextMenu(e, course);
  };

  const handlePointsEarned = (points: number, title: string) => {
    setToastData({
      activityTitle: title,
      pointsEarned: points,
    });
    setShowToast(true);
  };

  const handleDeleteCourse = async () => {
    if (!selectedCourse) return;

    try {
      const { deleteCourseFromIDB } = await import("@/utils/courseStorageIDB");
      const { deleteAllCourseMedia } =
        await import("@/services/mediaDownloadService");

      // Delete course files from IndexedDB
      await deleteCourseFromIDB(selectedCourse.courseId);

      // Delete media files from Cache Storage
      await deleteAllCourseMedia(selectedCourse.courseId);

      removeCourse(selectedCourse.courseId);
    } catch (error) {
    } finally {
      setDeleteDialogOpen(false);
      setSelectedCourse(null);
    }
  };

  const handleResetCourse = async () => {
    if (!selectedCourse) {
      return;
    }

    try {
      // Show in-progress status on the card
      setCardStatuses((prev) => ({
        ...prev,
        [selectedCourse.courseId]: "Resetting...",
      }));

      // Store empty completion map in Zustand so useCourseModules skips
      // the /activity API call on next open — all activities appear incomplete
      setCompletionData(selectedCourse.courseId, new Map());

      // Clear local gamification IDB data for this course so points can be re-earned
      await clearCourseGamificationData(parseInt(selectedCourse.courseId));

      // Set a reset flag so the gamification engine skips the API completion
      // check (old completed=true trackers would block points otherwise)
      localStorage.setItem(`course_reset_${selectedCourse.courseId}`, "true");

      // Clear pre-test attempts & results-shown flags so pre-test appears undone
      clearPreTestForCourse(selectedCourse.courseId);

      // Clear cached activity tracking so fresh API data is fetched
      await clearCachedActivityTracking(selectedCourse.shortname);

      // Clear last-visited-activity bookmark so user starts fresh
      clearLastVisitedActivity(selectedCourse.courseId);

      // Show success status on the card, then auto-clear
      setCardStatuses((prev) => ({
        ...prev,
        [selectedCourse.courseId]: "Reset",
      }));
      setTimeout(() => {
        setCardStatuses((prev) => {
          const next = { ...prev };
          delete next[selectedCourse.courseId];
          return next;
        });
      }, 5000);
    } catch (error) {
      if (selectedCourse) {
        setCardStatuses((prev) => ({
          ...prev,
          [selectedCourse.courseId]: "Reset failed",
        }));
        setTimeout(() => {
          setCardStatuses((prev) => {
            const next = { ...prev };
            delete next[selectedCourse.courseId];
            return next;
          });
        }, 5000);
      }
    } finally {
      setResetDialogOpen(false);
      setSelectedCourse(null);
    }
  };

  /**
   * Update activity tracking for a course:
   * Re-fetches from /activity API and stores in Zustand so the course
   * detail page uses fresh completion data on next open.
   */
  const handleUpdateActivity = async () => {
    if (!selectedCourse || !selectedCourse.shortname) return;

    try {
      // Check if offline - update requires server communication
      if (!navigator.onLine) {
        setCardStatuses((prev) => ({
          ...prev,
          [selectedCourse.courseId]: "No internet connection",
        }));
        setTimeout(() => {
          setCardStatuses((prev) => {
            const next = { ...prev };
            delete next[selectedCourse.courseId];
            return next;
          });
        }, 5000);
        setUpdateDialogOpen(false);
        setSelectedCourse(null);
        return;
      }

      // Show in-progress status on the card
      setCardStatuses((prev) => ({
        ...prev,
        [selectedCourse.courseId]: "Updating...",
      }));

      // Clear cached activity tracking so fresh API data is fetched
      await clearCachedActivityTracking(selectedCourse.shortname);

      // Fetch fresh tracking data from API
      const trackingData =
        await activityTrackingService.getCourseActivityTracking(
          selectedCourse.shortname,
        );

      // Build new completion map from API data
      const newCompletionMap =
        activityTrackingService.createCompletionMap(trackingData);

      // Update Zustand store
      setCompletionData(selectedCourse.courseId, newCompletionMap);

      // Verify it was stored
      const verifyStored = getCompletionData(selectedCourse.courseId);

      // Clear the course-reset flag so the gamification engine resumes
      // checking the /activity API for double-award prevention
      localStorage.removeItem(`course_reset_${selectedCourse.courseId}`);

      // Sync pre-test localStorage flags from the fresh API tracker data
      // so the pre-test modal reflects what the server knows
      try {
        const courseRecord = await getCourseFromIDB(selectedCourse.courseId);
        const sections = courseRecord?.structure?.sections;
        if (sections) {
          syncPreTestFromTrackers(
            selectedCourse.courseId,
            sections,
            trackingData.trackers,
          );
        }
      } catch (_) {
        // Non-critical — pretest sync failure doesn't block the update
      }

      // Show success status on the card, then auto-clear
      setCardStatuses((prev) => ({
        ...prev,
        [selectedCourse.courseId]: "Updated Activity",
      }));
      setTimeout(() => {
        setCardStatuses((prev) => {
          const next = { ...prev };
          delete next[selectedCourse.courseId];
          return next;
        });
      }, 5000);
    } catch (error) {
      if (selectedCourse) {
        setCardStatuses((prev) => ({
          ...prev,
          [selectedCourse.courseId]: "Update failed",
        }));
        setTimeout(() => {
          setCardStatuses((prev) => {
            const next = { ...prev };
            delete next[selectedCourse.courseId];
            return next;
          });
        }, 5000);
      }
    } finally {
      setUpdateDialogOpen(false);
      setSelectedCourse(null);
    }
  };

  // Filter courses based on search query
  const filteredCourses = installedCourses.filter((course) => {
    const searchLower = searchQuery.toLowerCase();
    const courseTitle = (
      course.structure?.title || course.shortname
    ).toLowerCase();
    const courseShortname = course.shortname.toLowerCase();

    return (
      courseTitle.includes(searchLower) || courseShortname.includes(searchLower)
    );
  });

  if (!hydrated) {
    return <PageLoading />;
  }

  // Show loading while fetching courses
  if (loading) {
    return (
      <div className="min-h-screen w-full h-full">
        <header className="bg-white border-b px-4 md:px-6 py-4 md:shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="md:hidden" />
              <div>
                <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
                  {t("navigation.home")}
                </h1>
                <p className="text-sm text-gray-600 hidden md:block">
                  {t("course.downloadedCourses")}
                </p>
              </div>
            </div>
          </div>
        </header>
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          <div className="text-center py-12">
            <PageLoading />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full h-full">
      {/* Header */}
      <header className="bg-white border-b px-4 md:px-6 py-4 md:shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="md:hidden" />
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
                {t("navigation.home")}
              </h1>
              <p className="text-sm text-gray-600 hidden md:block">
                {t("course.downloadedCourses")}
              </p>
            </div>
          </div>

          {installedCourses.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Search courses">
                <Search className="w-5 h-5 text-gray-700" />
              </button>

              {/* Dropdown Panel */}
              {isSearchOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900">
                        Search Courses
                      </h3>
                      <button
                        onClick={() => setIsSearchOpen(false)}
                        className="p-1 hover:bg-gray-100 rounded">
                        <X className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Search by course name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                    />

                    {searchQuery && (
                      <p className="text-sm text-gray-600 mt-3 mb-2">
                        Found {filteredCourses.length} of{" "}
                        {installedCourses.length} courses
                      </p>
                    )}

                    <div className="mt-3 max-h-64 overflow-y-auto">
                      {filteredCourses.length === 0 ? (
                        <p className="text-sm text-gray-500 py-2">
                          {searchQuery
                            ? "No courses match your search"
                            : "Start typing to search"}
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {filteredCourses.map((course) => (
                            <li key={course.courseId}>
                              <button
                                onClick={() => {
                                  handleCourseClick(course.courseId);
                                  setIsSearchOpen(false);
                                  setSearchQuery("");
                                }}
                                className="w-full text-left px-3 py-2 rounded hover:bg-cyan-50 transition-colors text-sm text-gray-800 hover:text-cyan-700">
                                {course.structure?.title || course.shortname}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div id="home-page-content" className="p-4 md:p-6 max-w-7xl mx-auto">
        {installedCourses.length === 0 ? (
          <EmptyState
            imageSrc="/home/calander.svg"
            imageAlt={t("course.noCourses")}
            title={t("course.noCourses")}
            description={[
              t("course.noCoursesDescription"),
              t("courseManagement.subtitle"),
            ]}
            actionLabel={t("courseManagement.title")}
            onAction={() => router.push("/course-management")}
          />
        ) : (
          <div>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  {t("course.downloadedCourses")} ({installedCourses.length})
                </h2>
                <Button
                  variant="outline"
                  onClick={() => router.push("/course-management")}
                  size="sm">
                  {t("courseManagement.title")}
                </Button>
              </div>
              <p className="text-sm text-gray-600">
                {t("course.offlineAccessDescription")}
              </p>
            </div>

            {filteredCourses.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">{t("course.noCourses")}</p>
                <p className="text-gray-500 text-sm mt-1">
                  {searchQuery
                    ? `No courses match your search for "${searchQuery}". Try a different search term.`
                    : "All your downloaded courses are displayed above."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCourses.map((course) => {
                  // Read persisted draft list from localStorage (if available)
                  let persistedDraft = false;
                  try {
                    const DRAFT_KEY = "noora_draft_courses_v1";
                    if (typeof window !== "undefined") {
                      const raw = localStorage.getItem(DRAFT_KEY);
                      if (raw) {
                        const arr: string[] = JSON.parse(raw);
                        persistedDraft = arr.includes(String(course.courseId));
                      }
                    }
                  } catch (e) {
                    // ignore
                  }

                  const statusFromStructure =
                    course.structure?.status || (course as any).status;
                  const statusToShow =
                    statusFromStructure ||
                    (persistedDraft ? "draft" : undefined);

                  return (
                    <CourseCard
                      key={course.courseId}
                      courseId={course.courseId}
                      title={course.structure?.title || course.shortname}
                      shortname={course.shortname}
                      version={course.version}
                      downloadUrl={course.downloadUrl}
                      hasUpdate={Boolean(course.hasUpdate)}
                      remoteVersion={course.remoteVersion}
                      onClick={() => handleCourseClick(course.courseId)}
                      onContextMenu={(e) => handleContextMenu(e, course)}
                      onMenuClick={(e) => handleMenuClick(e, course)}
                      onTouchStart={(e) => handleLongPressStart(e, course)}
                      onTouchEnd={handleLongPressEnd}
                      onTouchMove={handleLongPressEnd}
                      onUpdateComplete={() => refetch()}
                      onPointsEarned={handlePointsEarned}
                      totalActivities={course.structure?.totalPages}
                      sectionDigests={
                        course.structure?.sections?.map((s: any) => s.digest) ||
                        []
                      }
                      status={statusToShow}
                      statusMessage={cardStatuses[course.courseId] || null}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <CourseContextMenu<InstalledCourse & { isDownloaded?: boolean }>
          position={{ x: contextMenu.x, y: contextMenu.y }}
          data={contextMenu.data}
          onDelete={(course) => {
            setSelectedCourse(course);
            setDeleteDialogOpen(true);
            closeContextMenu();
          }}
          onReset={(course) => {
            setSelectedCourse(course);
            setResetDialogOpen(true);
            closeContextMenu();
          }}
          onUpdate={(course) => {
            setSelectedCourse(course);
            setUpdateDialogOpen(true);
            closeContextMenu();
          }}
        />
      )}

      <MediaDownloadDialog
        open={mediaPromptOpen}
        onOpenChange={setMediaPromptOpen}
        missingMedia={missingMedia}
        onDownload={handleDownloadMissingMediaFromCoursePage}
        downloadingMedia={downloadingMedia}
        downloadProgress={mediaDownloadProgress}
        mediaNotice={mediaNotice}
        onMediaNoticeClose={() => setMediaNotice(null)}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t("course.deleteCourse")}
        description={`${t("course.deleteConfirm")} ${t(
          "course.deleteDescription",
        )}`}
        confirmText={t("common.delete")}
        variant="destructive"
        onConfirm={handleDeleteCourse}
      />

      {/* Reset Confirmation Dialog */}
      <ConfirmationDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        title={t("course.resetCourse")}
        description={`${t("course.resetConfirm")} ${t(
          "course.resetDescription",
        )}`}
        confirmText={t("common.reset")}
        variant="warning"
        onConfirm={handleResetCourse}
      />

      {/* Update Activity Confirmation Dialog */}
      <ConfirmationDialog
        open={updateDialogOpen}
        onOpenChange={setUpdateDialogOpen}
        title={t("course.updateActivity")}
        description={t("course.updateActivityDescription")}
        confirmText={t("course.updateActivity")}
        variant="default"
        onConfirm={handleUpdateActivity}
      />
      <ActivityCompletionToast
        show={showToast}
        activityTitle={toastData.activityTitle}
        pointsEarned={toastData.pointsEarned}
        onClose={() => setShowToast(false)}
        completionType="course"
        courseTitle={toastData.activityTitle}
      />
    </div>
  );
}
