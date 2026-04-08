import React, { useState, useEffect } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { BookOpen, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import CourseUpdateButton from "@/components/CourseUpdateButton";
import { Icon } from "@iconify/react";
import { useActivityCompletionStore, useDownloadStore } from "@/store/useStore";
import { useAuthenticatedApi } from "@/hooks/useAuthenticatedApi";
import { courseDownloadService } from "@/services/courseDownloadService";
import { useLanguageStore } from "@/store/useLanguageStore";
import { translations } from "@/locales";
import { isOnline } from "@/utils/networkUtils";

interface CourseCardProps {
  courseId: string;
  title: string;
  shortname: string;
  version: number | string;
  downloadUrl?: string;
  isDownloaded?: boolean;
  hasUpdate?: boolean;
  remoteVersion?: number;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onMenuClick?: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchMove: () => void;
  onUpdateComplete?: () => void;
  onPointsEarned?: (points: number, title: string) => void;
  totalActivities?: number;
  sectionDigests?: string[];
  status?: string;
  statusMessage?: string | null;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  courseId,
  title,
  shortname,
  version,
  downloadUrl,
  isDownloaded = true,
  hasUpdate = false,
  remoteVersion,
  onClick,
  onContextMenu,
  onMenuClick,
  onTouchStart,
  onTouchEnd,
  onTouchMove,
  onUpdateComplete,
  onPointsEarned,
  totalActivities,
  sectionDigests,
  status,
  statusMessage,
}) => {
  const { language } = useLanguageStore();
  const t = translations[language as keyof typeof translations];
  // Subscribe to raw persisted completion object to avoid selector instability
  const completionObj = useActivityCompletionStore(
    (state) =>
      (state.completionData && (state.completionData as any)[courseId]) || null,
  ) as Record<string, boolean> | null;

  const completionMap = React.useMemo(() => {
    return completionObj ? new Map(Object.entries(completionObj)) : null;
  }, [completionObj]);

  let completedCount = 0;
  if (completionMap && sectionDigests && sectionDigests.length > 0) {
    completedCount = sectionDigests.reduce(
      (sum, d) => sum + (completionMap.get(d) ? 1 : 0),
      0,
    );
  } else if (completionMap) {
    completionMap.forEach((v) => {
      if (v) completedCount++;
    });
  }

  const total = totalActivities || (sectionDigests ? sectionDigests.length : 0);
  const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const api = useAuthenticatedApi();
  const { setDownloadProgress, clearDownloadProgress } = useDownloadStore();
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateCompleted, setUpdateCompleted] = useState(false);
  const [busyDialogOpen, setBusyDialogOpen] = useState(false);
  const [busyMessage, setBusyMessage] = useState("");
  const [online, setOnline] = useState(isOnline());

  // Detect busy states (updating or reset/update via statusMessage)
  const downloadProgress = useDownloadStore(
    (s) => s.downloads.get(courseId.toString()) || null,
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

  const handleCardClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Block navigation when card is busy
    if (isBusy) {
      const msg = getBusyMessage();
      setBusyMessage(msg);
      setBusyDialogOpen(true);
      return;
    }

    // If the update dialog is already open, ignore card clicks to avoid
    // immediately reopening it when modal buttons bubble events.
    if (showUpdateDialog) return;
    if (!updateCompleted && hasUpdate && remoteVersion !== undefined) {
      setShowUpdateDialog(true);
      return;
    }
    onClick();
  };

  const performUpdate = async () => {
    if (!downloadUrl) {
      setShowUpdateDialog(false);
      return;
    }

    try {
      setIsUpdating(true);
      setDownloadProgress(courseId.toString(), {
        courseId: courseId.toString(),
        phase: "downloading",
        progress: 1,
        message: t.course.updatingCourse,
      });

      const authenticatedUrl = api.buildUrl(downloadUrl);
      const versionToDownload = remoteVersion
        ? Number(remoteVersion)
        : Number(version);

      await courseDownloadService.downloadCourseWithProgress(
        authenticatedUrl,
        Number(courseId),
        shortname,
        versionToDownload,
        (phase: string, progress: number, message: string) => {
          setDownloadProgress(courseId.toString(), {
            courseId: courseId.toString(),
            phase: phase as any,
            progress,
            message,
          });
        },
        true,
      );

      setDownloadProgress(courseId.toString(), {
        courseId: courseId.toString(),
        phase: "complete",
        progress: 100,
        message: t.course.updateSuccess,
      });
      setTimeout(() => {
        clearDownloadProgress(courseId.toString());
        setIsUpdating(false);
        setShowUpdateDialog(false);
        setUpdateCompleted(true);
        if (onUpdateComplete) onUpdateComplete();
      }, 1500);
    } catch (err) {
      setDownloadProgress(courseId.toString(), {
        courseId: courseId.toString(),
        phase: "error",
        progress: 0,
        message: err instanceof Error ? err.message : t.error.updateFailed,
      });
      setTimeout(() => {
        clearDownloadProgress(courseId.toString());
        setIsUpdating(false);
      }, 2000);
    }
  };

  return (
    <Card
      key={courseId}
      className="cursor-pointer pl-2 pt-2 hover:shadow-lg transition-shadow relative overflow-hidden"
      onClick={handleCardClick}
      onContextMenu={onContextMenu}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}>
      <CardHeader className="pb-3">
        {/* 3-Dot Menu Button - only show when course is downloaded */}
        {isDownloaded && onMenuClick && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              onMenuClick(e);
            }}
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            aria-label="Course options">
            <MoreVertical className="w-5 h-5" />
          </Button>
        )}

        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6 text-cyan-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 leading-snug pr-8">
              {title}
            </h3>
          </div>
        </div>

        {/* Update Button - Shows only when update is available */}
        {!updateCompleted && hasUpdate && (
          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            <CourseUpdateButton
              courseId={Number(courseId)}
              shortname={shortname}
              localVersion={version}
              remoteVersion={remoteVersion}
              downloadUrl={downloadUrl}
              onUpdateComplete={onUpdateComplete}
              onPointsEarned={onPointsEarned}
              courseTitle={title}
              version={Number(version)}
            />
          </div>
        )}

        {/* Draft ribbon (left) */}
        {status === "draft" && (
          <div className="absolute top-3 left-[-20px]  -rotate-45 origin-center bg-pink-600 text-white text-xs text font-semibold pr-7 pl-6  text-start py-0.5 shadow-sm whitespace-nowrap">
            Draft
          </div>
        )}

        {/* Inline status message (reset / update activity) — shown in place of Downloaded */}
        {statusMessage && (
          <div
            className={`mt-2 flex items-center gap-2 text-sm font-medium ${
              statusMessage.toLowerCase().includes("failed")
                ? "text-red-600"
                : statusMessage.includes("...")
                  ? "text-cyan-600"
                  : "text-green-600"
            }`}>
            <Icon
              icon={
                statusMessage.toLowerCase().includes("failed")
                  ? "mdi:alert-circle"
                  : statusMessage.includes("...")
                    ? "mdi:loading"
                    : "mdi:check-circle"
              }
              className={`w-5 h-5 ${statusMessage.includes("...") ? "animate-spin" : ""}`}
            />
            <span>{statusMessage}</span>
          </div>
        )}
      </CardHeader>
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
              {t.course.updateAvailableTitle}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {t.course.updateAvailableMessage}
            </p>
            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  performUpdate();
                }}>
                {t.pwa.updateNow}
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
                {t.course.continueToCourse}
              </Button>
              <Button
                variant="ghost"
                className="px-4 py-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUpdateDialog(false);
                }}>
                {t.common.cancel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
