"use client";

import { useAuthStore, useActivityCompletionStore } from "@/store/useStore";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BackButton } from "@/components/ui/back-button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/Loading";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { TagCourseCard } from "@/components/course/TagCourseCard";
import { CourseContextMenu } from "@/components/course/CourseContextMenu";
import { useContextMenu } from "@/hooks/useContextMenu";
import { useTagCourses, type Course } from "@/hooks/useTagCourses";
import { useInstalledCourses } from "@/hooks/useInstalledCourses";
import { useCourseDownloadStatus } from "@/hooks/useCourseDownloadStatus";
import { useCourseDownload } from "@/hooks/useCourseDownload";
// TEMPORARILY DISABLED: Course update functionality
// import { useCourseUpdateChecker } from "@/hooks/useCourseUpdateChecker";
import { getLocalizedText } from "@/utils/localization";
import { useTour } from "@/hooks/useTour";
import { getTagCoursesTour } from "@/config/tourSteps";
import { activityTrackingService } from "@/services/activityTrackingService";
import { useGamification } from "@/hooks/useGamification";
import { ActivityCompletionToast } from "@/components/course/ActivityCompletionToast";
import { clearCourseGamificationData } from "@/utils/gamificationIDB";
import {
  clearPreTestForCourse,
  syncPreTestFromTrackers,
} from "@/utils/preTestStorage";
import { clearLastVisitedActivity } from "@/utils/lastActivityStorage";
import { getCourseFromIDB } from "@/utils/courseStorageIDB";
import { clearCachedActivityTracking } from "@/utils/offlineStorageIDB";
import { logCourseDownloadError } from "@/utils/courseDownloadErrorLogger";

interface CourseWithDownloadStatus extends Course {
  isDownloaded: boolean;
}

export default function TagCoursesPage() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const tagId = params?.tagId as string;
  const tagName = searchParams?.get("name") || "Courses";

  const { tagCourses, loading, error } = useTagCourses(tagId);
  const { installedCourses, refetch: refetchInstalledCourses } =
    useInstalledCourses();
  const [isNavigating, setIsNavigating] = useState(false);
  const { isDownloaded, markAsDownloaded, markAsDeleted } =
    useCourseDownloadStatus(tagCourses);
  const { downloadCourse } = useCourseDownload();
  // TEMPORARILY DISABLED: Course update functionality
  // const { updates, isChecking } = useCourseUpdateChecker(); // Check for updates
  const {
    contextMenu,
    handleContextMenu,
    handleLongPressStart,
    handleLongPressEnd,
    closeContextMenu,
  } = useContextMenu<CourseWithDownloadStatus>();
  const { trackCourseDownload } = useGamification();
  const { setCompletionData, getCompletionData } = useActivityCompletionStore();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastData, setToastData] = useState({
    activityTitle: "",
    pointsEarned: 0,
  });
  const [cardStatuses, setCardStatuses] = useState<Record<string, string>>({});

  // Tour setup - Tag Courses page (one-time only)
  const { startTour, hasCompletedTour } = useTour("tag-courses");

  // Note: Auth redirect is handled by AuthProvider, no need to duplicate here

  // Auto-trigger tour for first-time visitors
  useEffect(() => {
    if (
      isAuthenticated &&
      !loading &&
      tagCourses.length > 0 &&
      !hasCompletedTour()
    ) {
      const timer = setTimeout(() => {
        const tourSteps = getTagCoursesTour();
        startTour(tourSteps);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [
    isAuthenticated,
    loading,
    tagCourses.length,
    hasCompletedTour,
    startTour,
  ]);

  // Persist draft course IDs from this tag into localStorage (merge with existing)
  useEffect(() => {
    try {
      if (!loading && tagCourses && tagCourses.length > 0) {
        const DRAFT_KEY = "noora_draft_courses_v1";
        const existing =
          typeof window !== "undefined"
            ? localStorage.getItem(DRAFT_KEY)
            : null;
        const existingSet = new Set<string>(
          existing && existing.length ? JSON.parse(existing) : [],
        );
        let changed = false;
        tagCourses.forEach((c) => {
          if (c.status === "draft") {
            const idStr = String(c.id);
            if (!existingSet.has(idStr)) {
              existingSet.add(idStr);
              changed = true;
            }
          }
        });
        if (changed && typeof window !== "undefined") {
          localStorage.setItem(
            DRAFT_KEY,
            JSON.stringify(Array.from(existingSet)),
          );
        }
      }
    } catch (err) {}
  }, [tagCourses, loading]);

  const handleCourseClick = (course: Course) => {
    if (isNavigating) return;

    setIsNavigating(true);
    router.push(
      `/course/${course.id}?shortname=${encodeURIComponent(
        course.shortname,
      )}&tagId=${tagId}&tagName=${encodeURIComponent(tagName)}`,
    );
    setTimeout(() => setIsNavigating(false), 1500);
  };

  const handleViewCourse = (e: React.MouseEvent, course: Course) => {
    e.stopPropagation();
    if (isNavigating) return;
    setIsNavigating(true);
    // Navigate to course detail page (modules/activities) - same as card click
    // Pass shortname, tagId, and tagName in query for proper back navigation
    router.push(
      `/course/${course.id}?shortname=${encodeURIComponent(
        course.shortname,
      )}&tagId=${tagId}&tagName=${encodeURIComponent(tagName)}`,
    );
    setTimeout(() => setIsNavigating(false), 1500);
  };

  const handleDownloadFromMenu = async (
    courseData: CourseWithDownloadStatus,
  ) => {
    closeContextMenu();
    if (!courseData.url) return;

    try {
      await downloadCourse(
        courseData.id,
        courseData.shortname,
        courseData.version,
        courseData.url,
      );
      markAsDownloaded(courseData.id);

      // Track course download for gamification (50 points reward)
      // Convert CourseWithDownloadStatus to gamification Course type
      const gamificationCourse = {
        id: courseData.id,
        shortname: courseData.shortname,
        title:
          getLocalizedText(courseData.title, user?.language) ||
          courseData.shortname,
        version: courseData.version,
      };

      const result = await trackCourseDownload(gamificationCourse);

      // Show toast notification with points earned
      if (result.points > 0) {
        setToastData({
          activityTitle: gamificationCourse.title,
          pointsEarned: result.points,
        });
        setShowToast(true);
      }
    } catch (error) {
      await logCourseDownloadError({
        user: user
          ? {
              id: user.id,
              username: user.username,
            }
          : null,
        course: {
          id: courseData.id,
          shortname: courseData.shortname,
          version: courseData.version,
          downloadUrl: courseData.url,
        },
        tagId,
        tagName,
        error,
      });

      setCardStatuses((prev) => ({
        ...prev,
        [String(courseData.id)]: "Download failed",
      }));

      setTimeout(() => {
        setCardStatuses((prev) => {
          const next = { ...prev };
          delete next[String(courseData.id)];
          return next;
        });
      }, 5000);
    }
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
      await deleteCourseFromIDB(selectedCourse.id.toString());

      // Delete media files from Cache Storage
      await deleteAllCourseMedia(selectedCourse.id.toString());

      // Mark as deleted to update UI
      markAsDeleted(selectedCourse.id);
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
      const courseIdStr = String(selectedCourse.id);

      // Show in-progress status on the card
      setCardStatuses((prev) => ({ ...prev, [courseIdStr]: "Resetting..." }));

      // Store empty completion map in Zustand so useCourseModules skips
      // the /activity API call on next open — all activities appear incomplete
      setCompletionData(courseIdStr, new Map());

      // Clear local gamification IDB data for this course so points can be re-earned
      await clearCourseGamificationData(selectedCourse.id);

      // Set a reset flag so the gamification engine skips the API completion
      // check (old completed=true trackers would block points otherwise)
      localStorage.setItem(`course_reset_${courseIdStr}`, "true");

      // Clear pre-test attempts & results-shown flags so pre-test appears undone
      clearPreTestForCourse(courseIdStr);

      // Clear cached activity tracking so fresh API data is fetched
      await clearCachedActivityTracking(selectedCourse.shortname);

      // Clear last-visited-activity bookmark so user starts fresh
      clearLastVisitedActivity(courseIdStr);

      // Show success status on the card, then auto-clear
      setCardStatuses((prev) => ({ ...prev, [courseIdStr]: "Reset" }));
      setTimeout(() => {
        setCardStatuses((prev) => {
          const next = { ...prev };
          delete next[courseIdStr];
          return next;
        });
      }, 5000);
    } catch (error) {
      const courseIdStr = String(selectedCourse.id);
      setCardStatuses((prev) => ({ ...prev, [courseIdStr]: "Reset failed" }));
      setTimeout(() => {
        setCardStatuses((prev) => {
          const next = { ...prev };
          delete next[courseIdStr];
          return next;
        });
      }, 5000);
    } finally {
      setResetDialogOpen(false);
      setSelectedCourse(null);
    }
  };

  const handleUpdateActivity = async () => {
    if (!selectedCourse || !selectedCourse.shortname) return;

    try {
      const courseIdStr = String(selectedCourse.id);

      // Check if offline - update requires server communication
      if (!navigator.onLine) {
        setCardStatuses((prev) => ({
          ...prev,
          [courseIdStr]: "No internet connection",
        }));
        setTimeout(() => {
          setCardStatuses((prev) => {
            const next = { ...prev };
            delete next[courseIdStr];
            return next;
          });
        }, 5000);
        setUpdateDialogOpen(false);
        setSelectedCourse(null);
        return;
      }

      // Show in-progress status on the card
      setCardStatuses((prev) => ({ ...prev, [courseIdStr]: "Updating..." }));

      // Clear cached activity tracking so fresh API data is fetched
      await clearCachedActivityTracking(selectedCourse.shortname);

      const trackingData =
        await activityTrackingService.getCourseActivityTracking(
          selectedCourse.shortname,
        );

      const newCompletionMap =
        activityTrackingService.createCompletionMap(trackingData);

      console.log(
        `[UPDATE_ACTIVITY] Updating Zustand for course ${courseIdStr} with ${newCompletionMap.size} completed activities`,
        Array.from(newCompletionMap.entries()).slice(0, 5),
      );

      setCompletionData(courseIdStr, newCompletionMap);

      // Verify it was stored
      const verifyStored = getCompletionData(courseIdStr);
      console.log(
        `[UPDATE_ACTIVITY] Verification: Zustand now has ${verifyStored?.size || 0} activities for course ${courseIdStr}`,
      );

      localStorage.removeItem(`course_reset_${courseIdStr}`);

      // Sync pre-test localStorage flags from the fresh API tracker data
      // so the pre-test modal reflects what the server knows
      try {
        const courseRecord = await getCourseFromIDB(courseIdStr);
        const sections = courseRecord?.structure?.sections;
        if (sections) {
          syncPreTestFromTrackers(courseIdStr, sections, trackingData.trackers);
        }
      } catch (_) {
        // Non-critical — pretest sync failure doesn't block the update
      }

      // Show success status on the card, then auto-clear
      setCardStatuses((prev) => ({
        ...prev,
        [courseIdStr]: "Updated Activity",
      }));
      setTimeout(() => {
        setCardStatuses((prev) => {
          const next = { ...prev };
          delete next[courseIdStr];
          return next;
        });
      }, 5000);
    } catch (error) {
      const courseIdStr = String(selectedCourse?.id);
      setCardStatuses((prev) => ({ ...prev, [courseIdStr]: "Update failed" }));
      setTimeout(() => {
        setCardStatuses((prev) => {
          const next = { ...prev };
          delete next[courseIdStr];
          return next;
        });
      }, 5000);
    } finally {
      setUpdateDialogOpen(false);
      setSelectedCourse(null);
    }
  };

  if (!user) {
    return <PageLoading />;
  }
  if (isNavigating) {
    return <PageLoading text="Loading..." />;
  }

  return (
    <div className="min-h-screen w-full h-full">
      {/* Header */}
      <header className="border-b px-4 md:px-6 py-6">
        <div className="flex items-center gap-3 mb-4">
          <BackButton
            onClick={() => router.push("/course-management")}
            label="Back"
            iconSize="md"
          />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
            {tagName}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {tagCourses.length} {tagCourses.length === 1 ? "course" : "courses"}{" "}
            available
          </p>
        </div>
      </header>
      {/* Main Content */}
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {loading ? (
          // Loading Skeleton
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : error ? (
          // Error State
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded">
              Retry
            </button>
          </div>
        ) : tagCourses.length === 0 ? (
          // Empty State
          <div className="bg-white rounded-lg p-8 text-center shadow-sm">
            <p className="text-gray-600 text-lg mb-2">No courses available</p>
            <p className="text-gray-500 text-sm">
              There are no courses in this category.
            </p>
          </div>
        ) : (
          // Course Grid
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tagCourses.map((course) => {
              const installed = installedCourses.find(
                (c) =>
                  c.courseId?.toString() === course.id?.toString() ||
                  c.shortname === course.shortname,
              );
              return (
                <TagCourseCard
                  key={course.id}
                  course={course}
                  isDownloaded={isDownloaded(course.id)}
                  onClick={() => handleCourseClick(course)}
                  onViewClick={(e) => handleViewCourse(e, course)}
                  onContextMenu={(e) =>
                    handleContextMenu(e, {
                      ...course,
                      isDownloaded: isDownloaded(course.id),
                    })
                  }
                  onMenuClick={(e) => {
                    e.stopPropagation();
                    handleContextMenu(e, {
                      ...course,
                      isDownloaded: isDownloaded(course.id),
                    });
                  }}
                  onTouchStart={(e) =>
                    handleLongPressStart(e, {
                      ...course,
                      isDownloaded: isDownloaded(course.id),
                    })
                  }
                  onTouchEnd={handleLongPressEnd}
                  onTouchMove={handleLongPressEnd}
                  onDownloadComplete={() => {
                    markAsDownloaded(course.id);
                    refetchInstalledCourses();
                  }}
                  onPointsEarned={handlePointsEarned}
                  courseTitle={
                    getLocalizedText(course.title, user?.language) ||
                    course.shortname
                  }
                  localVersion={installed?.version}
                  remoteVersion={course.version}
                  status={course.status}
                  statusMessage={cardStatuses[String(course.id)] || null}
                />
              );
            })}
          </div>
        )}
      </div>
      {/* Context Menu */}
      {contextMenu && (
        <CourseContextMenu<CourseWithDownloadStatus>
          position={{ x: contextMenu.x, y: contextMenu.y }}
          data={contextMenu.data}
          onDownload={handleDownloadFromMenu}
          onDelete={(course) => {
            closeContextMenu();
            setSelectedCourse(course);
            setDeleteDialogOpen(true);
          }}
          onReset={(course) => {
            closeContextMenu();
            setSelectedCourse(course);
            setResetDialogOpen(true);
          }}
          onUpdate={(course) => {
            closeContextMenu();
            setSelectedCourse(course);
            setUpdateDialogOpen(true);
          }}
        />
      )}
      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Course"
        description={`Are you sure you want to delete "${
          selectedCourse
            ? getLocalizedText(selectedCourse.title, selectedCourse.shortname)
            : ""
        }"? This will remove all downloaded content and cannot be undone.`}
        confirmText="Delete"
        onConfirm={handleDeleteCourse}
        variant="destructive"
      />
      {/* Reset Confirmation Dialog */}
      <ConfirmationDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        title="Reset Course Progress"
        description={`Are you sure you want to reset all progress for "${
          selectedCourse
            ? getLocalizedText(selectedCourse.title, selectedCourse.shortname)
            : ""
        }"? This will clear all your activity data for this course and cannot be undone.`}
        confirmText="Reset"
        onConfirm={handleResetCourse}
        variant="warning"
      />
      {/* Update Activity Confirmation Dialog */}
      <ConfirmationDialog
        open={updateDialogOpen}
        onOpenChange={setUpdateDialogOpen}
        title="Update Course Activity"
        description="This will refresh your activity completion data for this course."
        confirmText="Update"
        onConfirm={handleUpdateActivity}
        variant="default"
      />
      {/* Course Download Toast Notification */}
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
