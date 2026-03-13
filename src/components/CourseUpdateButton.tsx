/**
 * CourseUpdateButton Component
 * Shows "Update Available" badge and handles course re-download when updates are detected
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Icon } from "@iconify/react";
import { RefreshCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDownloadStore, type DownloadPhase } from "@/store/useStore";
import { courseDownloadService } from "@/services/courseDownloadService";
import { useAuthenticatedApi } from "@/hooks/useAuthenticatedApi";
import { getCourseUpdateStatus } from "@/services/courseVersionService";
import { useLanguageStore } from "@/store/useLanguageStore";
import { translations } from "@/locales";
import { useGamification } from "@/hooks/useGamification";

interface CourseUpdateButtonProps {
  courseId: number;
  shortname: string;
  localVersion: string | number;
  remoteVersion?: number;
  downloadUrl: string | undefined;
  onUpdateComplete?: () => void;
  onUpdateStart?: () => void;
  onUpdateEnd?: () => void;
  onPointsEarned?: (points: number, title: string) => void;
  courseTitle?: string;
  version?: number;
  className?: string;
}

export default function CourseUpdateButton({
  courseId,
  shortname,
  localVersion,
  remoteVersion: propRemoteVersion,
  downloadUrl,
  onUpdateComplete,
  onUpdateStart,
  onUpdateEnd,
  onPointsEarned,
  courseTitle,
  version,
  className = "",
}: CourseUpdateButtonProps) {
  const api = useAuthenticatedApi();
  const { language } = useLanguageStore();
  const t = translations[language as keyof typeof translations];
  const { setDownloadProgress, getDownloadProgress, clearDownloadProgress } =
    useDownloadStore();
  const { trackCourseDownload } = useGamification();

  const [hasUpdate, setHasUpdate] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const updateCompletedRef = useRef(false);

  const downloadState = getDownloadProgress(courseId.toString());

  // Check for updates on mount or when props change
  useEffect(() => {
    // Skip re-checking if update was already completed successfully
    if (updateCompletedRef.current) {
      return;
    }

    async function checkUpdate() {
      // If remoteVersion is provided as prop, use it directly
      if (propRemoteVersion !== undefined) {
        const localVersionNum = Number(localVersion);
        const remoteVersionNum = Number(propRemoteVersion);
        const hasUpdateValue = remoteVersionNum > localVersionNum;

        // Detailed debug logging for version comparison

        setHasUpdate(hasUpdateValue);
        setRemoteVersion(hasUpdateValue ? String(propRemoteVersion) : null);
        setCheckingUpdate(false);

        if (hasUpdateValue) {
        }
        return;
      }

      // Otherwise, fetch from API (fallback for backward compatibility)
      try {
        const updateStatus = await getCourseUpdateStatus(
          courseId.toString(),
          shortname,
          localVersion,
        );

        setHasUpdate(updateStatus.hasUpdate);
        setRemoteVersion(
          updateStatus.remoteVersion
            ? String(updateStatus.remoteVersion)
            : null,
        );
        setCheckingUpdate(false);

        if (updateStatus.hasUpdate) {
        } else {
        }
      } catch (error) {
        setCheckingUpdate(false);
      }
    }

    checkUpdate();
  }, [courseId, shortname, localVersion, propRemoteVersion]);

  const handleUpdateClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmUpdate = async () => {
    setShowConfirmDialog(false);

    if (!downloadUrl) {
      return;
    }

    try {
      setIsUpdating(true);
      onUpdateStart?.();

      // Set initial progress
      setDownloadProgress(courseId.toString(), {
        courseId: courseId.toString(),
        phase: "downloading" as DownloadPhase,
        progress: 1,
        message: t.course.updatingCourse,
      });

      // Build authenticated URL
      const authenticatedUrl = api.buildUrl(downloadUrl);

      // Use remoteVersion if available, otherwise fallback to localVersion
      const versionToDownload = remoteVersion
        ? Number(remoteVersion)
        : propRemoteVersion
          ? Number(propRemoteVersion)
          : Number(localVersion);

      // Download with progress tracking (this will replace the existing course)
      await courseDownloadService.downloadCourseWithProgress(
        authenticatedUrl,
        courseId,
        shortname,
        versionToDownload,
        (phase: string, progress: number, message: string) => {
          setDownloadProgress(courseId.toString(), {
            courseId: courseId.toString(),
            phase: phase as DownloadPhase,
            progress,
            message,
          });
        },
        true, // isDownloaded: true for updates
      );

      // Success - clear progress and update state
      setDownloadProgress(courseId.toString(), {
        courseId: courseId.toString(),
        phase: "complete" as DownloadPhase,
        progress: 100,
        message: t.course.updateSuccess,
      });

      // Track course update for gamification (award points)
      try {
        const gamificationCourse = {
          id: courseId,
          shortname,
          title: courseTitle || shortname,
          version: versionToDownload,
        };

        const result = await trackCourseDownload(gamificationCourse);

        // Notify parent component about points earned
        if (result.points > 0 && onPointsEarned) {
          onPointsEarned(result.points, courseTitle || shortname);
        }
      } catch (gamificationError) {
        // Log but don't fail the update if gamification fails
        console.error(
          "[CourseUpdateButton] Gamification tracking failed:",
          gamificationError,
        );
      }

      setTimeout(() => {
        clearDownloadProgress(courseId.toString());
        setIsUpdating(false);
        setHasUpdate(false);
        updateCompletedRef.current = true;
        onUpdateEnd?.();

        // Call completion callback
        if (onUpdateComplete) {
          onUpdateComplete();
        }
      }, 2000);
    } catch (error) {
      setDownloadProgress(courseId.toString(), {
        courseId: courseId.toString(),
        phase: "error" as DownloadPhase,
        progress: 0,
        message: t.error.updateFailed,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      setTimeout(() => {
        clearDownloadProgress(courseId.toString());
        setIsUpdating(false);
        onUpdateEnd?.();
      }, 3000);
    }
  };

  // Don't show anything if no update available or still checking
  if (checkingUpdate || !hasUpdate) {
    return null;
  }

  // Show progress if updating
  if (downloadState && downloadState.phase !== "complete") {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {downloadState.message || t.course.updatingCourse}
          </span>
          <span className="text-sm text-muted-foreground">
            {Math.round(downloadState.progress)}%
          </span>
        </div>
        <Progress value={downloadState.progress} className="h-2" />
      </div>
    );
  }

  return (
    <>
      <div className={`flex items-center  w-fit gap-2 ${className}`}>
        <Button
          size="sm"
          variant="outline"
          onClick={handleUpdateClick}
          disabled={isUpdating}
          className="gap-1">
          <RefreshCcw className="h-4 w-4" />
          {t.pwa.updateNow}
        </Button>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.course.updateAvailableTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.course.updateAvailableMessage}
              <div className="mt-2 space-y-1"></div>
              <p className="mt-3">{t.course.updateDialogDetails}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUpdate}>
              {t.pwa.updateNow}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
