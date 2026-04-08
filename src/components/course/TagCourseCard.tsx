import React, { useState, useCallback, useEffect } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Eye, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import CourseDownloadButton from "@/components/CourseDownloadButton";
import CourseUpdateButton from "@/components/CourseUpdateButton";
import { useAuthenticatedApi } from "@/hooks/useAuthenticatedApi";
import { courseDownloadService } from "@/services/courseDownloadService";
import { useDownloadStore } from "@/store/useStore";
import { getLocalizedText } from "@/utils/localization";
import { isOnline } from "@/utils/networkUtils";
import { useTranslation } from "@/hooks/useTranslation";
import type { Course } from "@/hooks/useTagCourses";

interface TagCourseCardProps {
  course: Course;
  isDownloaded: boolean;
  onClick: () => void;
  onViewClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onMenuClick: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchMove: () => void;
  onDownloadComplete: () => void;
  onPointsEarned?: (points: number, title: string) => void;
  courseTitle?: string;
  localVersion?: number | string;
  remoteVersion?: number;
  status?: string;
  statusMessage?: string | null;
}

export const TagCourseCard: React.FC<TagCourseCardProps> = ({
  course,
  isDownloaded,
  onClick,
  onViewClick,
  onContextMenu,
  onMenuClick,
  onTouchStart,
  onTouchEnd,
  onTouchMove,
  onDownloadComplete,
  onPointsEarned,
  courseTitle,
  localVersion,
  remoteVersion,
  status,
  statusMessage,
}) => {
  const [online, setOnline] = useState(isOnline());
  const { t } = useTranslation();
  const api = useAuthenticatedApi();
  const { setDownloadProgress, clearDownloadProgress } = useDownloadStore();
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateCompleted, setUpdateCompleted] = useState(false);
  const [busyDialogOpen, setBusyDialogOpen] = useState(false);
  const [busyMessage, setBusyMessage] = useState("");

  // Determine if the card is "busy" (downloading, resetting, updating)
  const downloadProgress = useDownloadStore(
    (s) => s.downloads.get(String(course.id)) || null,
  );
  const isDownloading =
    downloadProgress &&
    downloadProgress.phase !== "idle" &&
    downloadProgress.phase !== "complete" &&
    downloadProgress.phase !== "error";
  const isBusy =
    isUpdating ||
    isDownloading ||
    (statusMessage != null && statusMessage.includes("..."));

  const getBusyMessage = () => {
    const downloadInProgress =
      isDownloading ||
      downloadProgress?.phase === "downloading" ||
      downloadProgress?.phase === "installing";

    if (!online && downloadInProgress) {
      return "You are offline. Course download is paused. Reconnect to continue.";
    }

    if (statusMessage?.includes("Resetting")) {
      return "Course is being reset. Please wait.";
    }
    if (statusMessage?.includes("Updating")) {
      return "Activity is being updated. Please wait.";
    }
    if (downloadInProgress) {
      return "Course is downloading. Please wait.";
    }
    if (isUpdating) {
      return "Course is being updated. Please wait.";
    }
    return "Please wait until the current operation finishes.";
  };

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Auto-close busy dialog when process finishes
  useEffect(() => {
    if (busyDialogOpen && !isBusy) {
      setBusyDialogOpen(false);
    }
  }, [isBusy, busyDialogOpen]);

  const performUpdate = async () => {
    const downloadUrl = course.url || course.download_url;
    if (!downloadUrl) {
      setShowUpdateDialog(false);
      return;
    }

    try {
      setShowUpdateDialog(false);
      setIsUpdating(true);
      setDownloadProgress(String(course.id), {
        courseId: String(course.id),
        phase: "downloading",
        progress: 1,
        message: t("course.updatingCourse"),
      });

      const authenticatedUrl = api.buildUrl(downloadUrl);
      const versionToDownload = remoteVersion
        ? Number(remoteVersion)
        : Number(localVersion || course.version);

      await courseDownloadService.downloadCourseWithProgress(
        authenticatedUrl,
        course.id,
        course.shortname,
        versionToDownload,
        (phase: string, progress: number, message: string) => {
          setDownloadProgress(String(course.id), {
            courseId: String(course.id),
            phase: phase as any,
            progress,
            message,
          });
        },
        true,
      );

      setDownloadProgress(String(course.id), {
        courseId: String(course.id),
        phase: "complete",
        progress: 100,
        message: t("course.updateSuccess"),
      });

      setTimeout(() => {
        clearDownloadProgress(String(course.id));
        setIsUpdating(false);
        setShowUpdateDialog(false);
        setUpdateCompleted(true);
        onDownloadComplete();
      }, 1500);
    } catch (err) {
      setDownloadProgress(String(course.id), {
        courseId: String(course.id),
        phase: "error",
        progress: 0,
        message: err instanceof Error ? err.message : t("error.updateFailed"),
      });
      setTimeout(() => {
        clearDownloadProgress(String(course.id));
        setIsUpdating(false);
      }, 2000);
    }
  };
  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Block navigation when card is busy
    if (isBusy) {
      const msg = getBusyMessage();
      setBusyMessage(msg);
      setBusyDialogOpen(true);
      return;
    }

    if (
      !updateCompleted &&
      isDownloaded &&
      localVersion !== undefined &&
      remoteVersion !== undefined &&
      Number(remoteVersion) > Number(localVersion)
    ) {
      setShowUpdateDialog(true);
      return;
    }
    onClick();
  };

  return (
    <Card
      onClick={handleCardClick}
      onContextMenu={onContextMenu}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      className="hover:shadow-md transition-shadow border border-gray-200 bg-white cursor-pointer group relative overflow-hidden">
      <CardHeader className="p-6  space-y-3 relative">
        {/* 3-Dot Menu Button - only show when course is downloaded */}
        {isDownloaded && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onMenuClick}
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            aria-label="Course options">
            <MoreVertical className="w-5 h-5" />
          </Button>
        )}

        {/* Course Badge */}
        {/* <div className="hidden md:inline-flex items-center gap-2 self-start">
          <span className="px-3 py-1 bg-cyan-50 text-cyan-600 text-xs font-medium rounded-full border border-cyan-200">
            Course {course.id}
          </span>
        </div> */}

        {/* Course Title */}
        <h3 className="text-base font-medium md:font-semibold text-gray-900 leading-snug pr-8">
          {getLocalizedText(course.title, course.shortname)}
        </h3>

        {/* Draft ribbon (slanted top-right) */}
        {course.status === "draft" && (
          <div
            aria-hidden
            className="absolute top-2 -left-16 md:-left-16 transform -rotate-45 origin-center bg-pink-600 text-white  text-xs font-semibold px-16 py-0.5 shadow-sm whitespace-nowrap">
            Draft
          </div>
        )}

        {/* Publisher */}
        <p className="text-sm text-gray-600">
          {t("course.publisherLabel")}:{" "}
          {course.organisation || t("common.appName")}
        </p>

        {/* Action Buttons */}
        <div
          className="flex flex-col  mt-auto gap-2"
          onClick={(e) => e.stopPropagation()}>
          {/* View Course - only show when online or when course is downloaded (offline: hide for non-downloaded) */}
          {(online || isDownloaded) && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                // Block if card is busy
                if (isBusy) {
                  const msg = getBusyMessage();
                  setBusyMessage(msg);
                  setBusyDialogOpen(true);
                  return;
                }
                // If installed and remoteVersion > localVersion, show modal
                if (
                  !updateCompleted &&
                  isDownloaded &&
                  localVersion !== undefined &&
                  remoteVersion !== undefined &&
                  Number(remoteVersion) > Number(localVersion)
                ) {
                  setShowUpdateDialog(true);
                  return;
                }
                onViewClick(e);
              }}
              variant="outline"
              className="w-full flex items-center gap-2 border-cyan-600 text-cyan-600 hover:bg-cyan-50">
              <Eye className="w-4 h-4" />
              <span>{t("buttons.viewCourse")}</span>
            </Button>
          )}

          {/* Show update button if course is installed and remoteVersion/localVersion available */}
          {!updateCompleted &&
            isDownloaded &&
            remoteVersion !== undefined &&
            localVersion !== undefined && (
              <div onClick={(e) => e.stopPropagation()}>
                <CourseUpdateButton
                  courseId={course.id}
                  shortname={course.shortname}
                  localVersion={localVersion}
                  remoteVersion={remoteVersion}
                  downloadUrl={course.url || course.download_url}
                  onUpdateStart={() => setIsUpdating(true)}
                  onUpdateEnd={() => setIsUpdating(false)}
                  onUpdateComplete={onDownloadComplete}
                  onPointsEarned={onPointsEarned}
                  courseTitle={courseTitle}
                  version={course.version}
                />
              </div>
            )}

          {/* Download button stays mounted even after download so media prompt persists */}
          {!isUpdating && (
            <div
              onClick={(e) => {
                e.stopPropagation();
              }}>
              <CourseDownloadButton
                courseId={course.id}
                shortname={course.shortname}
                version={course.version}
                downloadUrl={course.url || course.download_url}
                isDownloaded={isDownloaded}
                onDownloadComplete={onDownloadComplete}
                onPointsEarned={onPointsEarned}
                courseTitle={courseTitle}
                statusMessage={statusMessage}
              />
            </div>
          )}
        </div>

        {/* Busy dialog — shown when user clicks during reset / update / download */}
        {busyDialogOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
            onClick={(e) => {
              e.stopPropagation();
              setBusyDialogOpen(false);
            }}>
            <div
              className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 text-center"
              onClick={(e) => e.stopPropagation()}>
              <p className="text-sm text-gray-700">{busyMessage}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={(e) => {
                  e.stopPropagation();
                  setBusyDialogOpen(false);
                }}>
                OK
              </Button>
            </div>
          </div>
        )}

        {/* Update confirmation dialog */}
        {showUpdateDialog && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}>
            <div
              className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-2">
                {t("course.updateAvailableTitle")}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {t("course.updateAvailableMessage")}
              </p>
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    performUpdate();
                  }}>
                  {t("pwa.updateNow")}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowUpdateDialog(false);
                    // Continue to course
                    onClick();
                  }}>
                  {t("course.continueToCourse")}
                </Button>
                <Button
                  variant="ghost"
                  className="px-4 py-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowUpdateDialog(false);
                  }}>
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardHeader>
    </Card>
  );
};
