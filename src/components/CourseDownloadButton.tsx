"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Icon } from "@iconify/react";
import { Download, WifiOff, Video, AlertCircle } from "lucide-react";
import { useDownloadStore, type DownloadPhase } from "@/store/useStore";
import { courseDownloadService } from "@/services/courseDownloadService";
import { useAuthenticatedApi } from "@/hooks/useAuthenticatedApi";
import { isOnline } from "@/utils/networkUtils";
import { getCourseMedia } from "@/services/mediaDownloadService";
import { useLanguageStore } from "@/store/useLanguageStore";
import { translations } from "@/locales";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Media } from "@/types/media";
import { useGamification } from "@/hooks/useGamification";
import { useStorageQuotaStore } from "@/store/storageQuotaStore";
interface CourseDownloadButtonProps {
  courseId: number;
  shortname: string;
  version: number;
  downloadUrl: string | undefined;
  isDownloaded: boolean;
  onDownloadComplete?: () => void;
  onPointsEarned?: (points: number, title: string) => void;
  courseTitle?: string;
  className?: string;
  /** When set, replaces the "Downloaded" label with this message (e.g. "Resetting...", "Reset") */
  statusMessage?: string | null;
}

export default function CourseDownloadButton({
  courseId,
  shortname,
  version,
  downloadUrl,
  isDownloaded,
  onDownloadComplete,
  onPointsEarned,
  courseTitle,
  className = "",
  statusMessage,
}: CourseDownloadButtonProps) {
  const api = useAuthenticatedApi();
  const { language } = useLanguageStore();
  const t = translations[language as keyof typeof translations];
  const { setDownloadProgress, getDownloadProgress, clearDownloadProgress } =
    useDownloadStore();
  const { trackCourseDownload } = useGamification();
  const downloadState = getDownloadProgress(courseId.toString());

  const [isDownloading, setIsDownloading] = useState(false);
  const [online, setOnline] = useState(isOnline());
  const [localProgress, setLocalProgress] = useState<{
    phase: DownloadPhase;
    progress: number;
    message: string;
  } | null>(null);

  // Media download prompt state
  const [showMediaPrompt, setShowMediaPrompt] = useState(false);
  const [courseMediaFiles, setCourseMediaFiles] = useState<Media[]>([]);
  const [downloadingMedia, setDownloadingMedia] = useState(false);
  const [mediaProgress, setMediaProgress] = useState<{
    filename: string;
    progress: number;
  } | null>(null);

  // Cancel download state
  const controllerRef = useRef<AbortController | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // Monitor online/offline status
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

  // Clear download state on unmount or when already downloaded
  useEffect(() => {
    return () => {
      // Only clear if download is complete or error
      const state = getDownloadProgress(courseId.toString());
      if (state && (state.phase === "complete" || state.phase === "error")) {
        clearDownloadProgress(courseId.toString());
      }
    };
  }, [courseId, clearDownloadProgress, getDownloadProgress]);

  // Reset local state when isDownloaded changes
  useEffect(() => {
    if (isDownloaded) {
      setIsDownloading(false);
      setLocalProgress(null);
      clearDownloadProgress(courseId.toString());
    }
  }, [isDownloaded, courseId, clearDownloadProgress]);

  const handleDownload = async () => {
    if (!downloadUrl) {
      setDownloadProgress(courseId.toString(), {
        courseId: courseId.toString(),
        phase: "error",
        progress: 0,
        message: "No download URL available for this course",
        error: "No download URL available",
      });

      setTimeout(() => {
        clearDownloadProgress(courseId.toString());
      }, 3000);
      return;
    }

    try {
      setIsDownloading(true);

      // Set local progress IMMEDIATELY - show loading bar instantly
      const initialProgress = {
        phase: "downloading" as DownloadPhase,
        progress: 1,
        message: "Preparing download...",
      };
      setLocalProgress(initialProgress);

      // Also set in store
      setDownloadProgress(courseId.toString(), {
        courseId: courseId.toString(),
        ...initialProgress,
      });

      // Build authenticated URL
      const authenticatedUrl = api.buildUrl(downloadUrl);

      // Create an AbortController so user can cancel the download
      const controller = new AbortController();
      controllerRef.current = controller;

      // Download with progress tracking (pass controller so service can cancel)
      await courseDownloadService.downloadCourseWithProgress(
        authenticatedUrl,
        courseId,
        shortname,
        version,
        (phase: string, progress: number, message: string) => {
          const progressData = {
            phase: phase as DownloadPhase,
            progress,
            message,
          };
          setLocalProgress(progressData);
          setDownloadProgress(courseId.toString(), {
            courseId: courseId.toString(),
            ...progressData,
          });
        },
        true, // isDownloaded: true for explicit download
        controller,
      );

      // Cleanup controller ref on successful completion
      controllerRef.current = null;

      // CRITICAL FIX: Pre-cache the course view page BEFORE marking download as complete.
      // Previously this ran as a deferred fire-and-forget iframe (15+ seconds), meaning
      // the user could go offline before the page shell/chunks were cached, causing
      // the course viewer to fail offline. Now we use cachePageWithDependencies which
      // fetches the HTML and all referenced JS/CSS chunks synchronously.
      const preCachingProgress = {
        phase: "installing" as DownloadPhase,
        progress: 95,
        message: "Caching for offline use...",
      };
      setLocalProgress(preCachingProgress);
      setDownloadProgress(courseId.toString(), {
        courseId: courseId.toString(),
        ...preCachingProgress,
      });

      if (navigator.onLine) {
        try {
          const { cachePageWithDependencies } =
            await import("@/utils/pageCaching");
          const baseUrl = window.location.origin;

          // Cache the course detail page, viewer page, AND the course list page.
          // The list page (/course) is needed so the user can navigate back to
          // their downloaded courses while offline.
          const pagesToCache = [
            `${baseUrl}/course/${courseId}`,
            `${baseUrl}/course/${courseId}/view`,
            `${baseUrl}/course`,
          ];

          await Promise.all(
            pagesToCache.map(async (url) => {
              try {
                await cachePageWithDependencies(url);
              } catch (err) {
                console.warn(
                  `[CourseDownload] ⚠️ Pre-cache failed for ${url}:`,
                  err,
                );
                // Non-fatal: course content is in IndexedDB, page shell is nice-to-have
              }
            }),
          );
        } catch (err) {
          console.warn("[CourseDownload] Pre-cache setup failed:", err);
          // Non-fatal - IndexedDB has the course data
        }
      }

      // Success
      const completeProgress = {
        phase: "complete" as DownloadPhase,
        progress: 100,
        message: "Course installed successfully!",
      };
      setLocalProgress(completeProgress);
      setDownloadProgress(courseId.toString(), {
        courseId: courseId.toString(),
        ...completeProgress,
      });

      // Check for media files that need to be downloaded
      try {
        const mediaFiles = await getCourseMedia(courseId.toString());

        const undownloadedMedia = mediaFiles.filter((m) => !m.downloaded);
        const downloadedCount = mediaFiles.length - undownloadedMedia.length;

        if (undownloadedMedia.length > 0) {
          setCourseMediaFiles(undownloadedMedia);

          // Use setTimeout to ensure state updates are processed
          setTimeout(() => {
            setShowMediaPrompt(true);
          }, 100);
        } else {
        }
      } catch (mediaError) {}

      try {
        const gamificationCourse = {
          id: courseId,
          shortname,
          title: courseTitle || shortname,
          version,
        };

        const result = await trackCourseDownload(gamificationCourse);

        // Notify parent component about points earned
        if (result.points > 0 && onPointsEarned) {
          onPointsEarned(result.points, courseTitle || shortname);
        } else {
        }
      } catch (gamificationError) {}

      // Clear progress after a delay
      setTimeout(() => {
        setLocalProgress(null);
        clearDownloadProgress(courseId.toString());
        setIsDownloading(false);
        if (onDownloadComplete) {
          onDownloadComplete();
        }
      }, 2000);
    } catch (error: unknown) {
      // Handle user-initiated abort
      const isAbort =
        (error as any)?.name === "AbortError" ||
        (error instanceof DOMException && error.name === "AbortError");
      if (isAbort) {
        const cancelProgress = {
          phase: "error" as DownloadPhase,
          progress: 0,
          message: "Download cancelled",
        };
        setLocalProgress(cancelProgress);
        setDownloadProgress(courseId.toString(), {
          courseId: courseId.toString(),
          ...cancelProgress,
        });
        setTimeout(() => {
          setLocalProgress(null);
          clearDownloadProgress(courseId.toString());
          setIsDownloading(false);
        }, 1000);
        controllerRef.current = null;
        return;
      }

      const isQuotaExceeded =
        error instanceof Error && error.name === "QuotaExceededError";
      if (isQuotaExceeded) {
        useStorageQuotaStore.getState().setShowStorageQuotaDialog(true);
      }
      const errorProgress = {
        phase: "error" as DownloadPhase,
        progress: 0,
        message: error instanceof Error ? error.message : "Download failed",
      };
      setLocalProgress(errorProgress);
      setDownloadProgress(courseId.toString(), {
        courseId: courseId.toString(),
        ...errorProgress,
        error: error instanceof Error ? error.message : "Download failed",
      });

      // Clear error after delay
      setTimeout(() => {
        setLocalProgress(null);
        clearDownloadProgress(courseId.toString());
        setIsDownloading(false);
      }, 3000);
      controllerRef.current = null;
    }
  };

  // Handle media download
  const handleMediaDownload = async () => {
    if (courseMediaFiles.length === 0) return;

    // Check if online before downloading
    if (!online) {
      alert("You need an internet connection to download media files.");
      return;
    }

    setDownloadingMedia(true);
    setShowMediaPrompt(false);

    try {
      const { downloadAllMissingMedia } =
        await import("@/services/mediaDownloadService");

      // Create a controller so media downloads can be cancelled
      const controller = new AbortController();
      controllerRef.current = controller;

      const result = await downloadAllMissingMedia(
        courseId.toString(),
        (progress) => {
          setMediaProgress({
            filename: progress.filename,
            progress: progress.progress,
          });
        },
        controller.signal,
      );

      // Clear media files list and progress
      setCourseMediaFiles([]);
      setMediaProgress(null);

      // Show success/failure message
      if (result.failed > 0) {
        alert(
          `⚠️ Downloaded ${result.success} of ${
            result.success + result.failed
          } media files.\n${
            result.failed
          } file(s) failed - please check your internet connection and try again.`,
        );
      } else {
      }
    } catch (error) {
      // Handle user-initiated abort
      const isAbort =
        (error as any)?.name === "AbortError" ||
        (error instanceof DOMException && error.name === "AbortError");
      if (!isAbort) {
        alert(
          "Failed to download media files. Please check your internet connection and try again.",
        );
        // Re-show the prompt on error
        setShowMediaPrompt(true);
      }
    } finally {
      setDownloadingMedia(false);
      controllerRef.current = null;
    }
  };

  // Calculate total media size
  const totalMediaSize = courseMediaFiles.reduce(
    (sum, m) => sum + (m.fileSize || 0),
    0,
  );

  // Render the button content based on state
  const renderButtonContent = () => {
    // If already downloaded, show downloaded state (or override with statusMessage)
    if (isDownloaded && !localProgress && !downloadState) {
      // If a status override is provided (e.g. "Resetting...", "Reset"), show it instead
      if (statusMessage) {
        const isBusy = statusMessage.includes("...");
        const isFailed = statusMessage.toLowerCase().includes("failed");
        const colorClass = isFailed
          ? "text-red-600"
          : isBusy
            ? "text-cyan-600"
            : "text-green-600";
        const icon = isFailed
          ? "mdi:alert-circle"
          : isBusy
            ? "mdi:loading"
            : "mdi:check-circle";
        return (
          <div
            className={`flex items-center gap-2 text-sm font-medium ${colorClass}`}>
            <Icon
              icon={icon}
              className={`w-5 h-5 ${isBusy ? "animate-spin" : ""}`}
            />
            <span>{statusMessage}</span>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
          <Icon icon="mdi:check-circle" className="w-5 h-5" />
          <span>Downloaded</span>
        </div>
      );
    }

    // Show progress bar during download/install (use local state for instant feedback)
    const activeProgress = localProgress || downloadState;
    if (activeProgress && (isDownloading || activeProgress.phase !== "idle")) {
      const { phase, progress, message } = activeProgress;

      return (
        <div className={`space-y-2 ${className}`}>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {phase === "downloading" && (
                <Icon
                  icon="mdi:download"
                  className="w-4 h-4 animate-pulse text-cyan-600"
                />
              )}
              {phase === "installing" && (
                <Icon
                  icon="mdi:cog"
                  className="w-4 h-4 animate-spin text-cyan-600"
                />
              )}
              {phase === "complete" && (
                <Icon
                  icon="mdi:check-circle"
                  className="w-4 h-4 text-green-600"
                />
              )}
              {phase === "error" && (
                <Icon
                  icon="mdi:alert-circle"
                  className="w-4 h-4 text-red-600"
                />
              )}
              <span className="font-medium text-gray-700">
                {phase === "downloading" && t.download.downloading}
                {phase === "installing" && t.download.extracting}
                {phase === "complete" && t.download.complete}
                {phase === "error" && t.download.error}
              </span>
            </div>
            {phase === "installing" && (
              <span className="text-sm text-gray-600 font-medium">
                {progress}%
              </span>
            )}
          </div>

          <Progress
            value={progress}
            className={`h-2 ${
              phase === "error"
                ? "[&>div]:bg-red-600 bg-red-100"
                : phase === "complete"
                  ? "[&>div]:bg-green-600"
                  : "[&>div]:bg-cyan-600"
            }`}
          />

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">{message}</p>
            {/* Show cancel button during active download/install phases */}
            {(phase === "downloading" || phase === "installing") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Open confirmation dialog instead of aborting immediately

                  setCancelDialogOpen(true);
                }}
                className="text-red-600 hover:bg-red-50">
                Cancel
              </Button>
            )}
          </div>
        </div>
      );
    }

    // Default: show download buttons
    return (
      <>
        {/* Mobile: Text link */}
        <Button
          onClick={handleDownload}
          disabled={!downloadUrl || !online}
          variant="ghost"
          className="md:hidden text-cyan-500 hover:text-cyan-600 hover:bg-cyan-50 p-0 h-auto font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            !online
              ? "Download requires internet connection"
              : !downloadUrl
                ? "Download URL not available"
                : ""
          }>
          {!online ? (
            <WifiOff className="w-4 h-4 mr-1" />
          ) : (
            <Download className="w-4 h-4 mr-1" />
          )}
          {!online ? "Offline" : "Download Course"}
        </Button>

        {/* Desktop: Button with icon */}
        <Button
          onClick={handleDownload}
          disabled={!downloadUrl || !online}
          variant="outline"
          className="hidden md:flex w-full items-center gap-2 border-cyan-600 text-cyan-600 hover:bg-cyan-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            !online
              ? "Download requires internet connection"
              : !downloadUrl
                ? "Download URL not available"
                : ""
          }>
          {!online ? (
            <WifiOff className="w-4 h-4" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>{!online ? t.buttons.offline : t.buttons.download}</span>
        </Button>
      </>
    );
  };

  return (
    <>
      {/* Render the main button content */}
      {renderButtonContent()}
      {/* Media Download Prompt Dialog - ALWAYS rendered so it shows regardless of button state */}
      <AlertDialog
        open={showMediaPrompt}
        onOpenChange={(open) => {
          setShowMediaPrompt(open);
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-cyan-500" />
              {t.download.downloadVideosTitle}
            </AlertDialogTitle>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                This course contains{" "}
                <strong>
                  {courseMediaFiles.length} video
                  {courseMediaFiles.length > 1 ? "s" : ""}
                </strong>{" "}
                that can be downloaded for offline viewing.
              </p>
              {courseMediaFiles.length > 0 && (
                <div className="bg-gray-50 rounded-md p-3 max-h-40 overflow-y-auto">
                  <ul className="space-y-1 text-sm">
                    {courseMediaFiles.slice(0, 5).map((media, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <Video className="w-3 h-3 text-gray-400" />
                        <span className="truncate flex-1">
                          {media.filename}
                        </span>
                        {media.fileSize && (
                          <span className="text-gray-500 text-xs ml-auto shrink-0">
                            {(media.fileSize / (1024 * 1024)).toFixed(1)} MB
                          </span>
                        )}
                      </li>
                    ))}
                    {courseMediaFiles.length > 5 && (
                      <li className="text-gray-500 text-xs italic">
                        ...and {courseMediaFiles.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              )}
              <p className="text-xs text-gray-600">
                Total size:{" "}
                <strong>
                  {(totalMediaSize / (1024 * 1024)).toFixed(1)} MB
                </strong>
              </p>
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Without downloading, videos will only play when online.
              </p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.buttons.downloadLater}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMediaDownload}
              className="bg-cyan-500 hover:bg-cyan-600">
              <Download className="w-4 h-4 mr-2" />
              {t.buttons.downloadVideos}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Cancel confirmation dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.dialog?.cancelDownloadTitle || "Cancel Download?"}
            </AlertDialogTitle>
            <div className="text-sm text-gray-600 mt-2">
              {t.dialog?.cancelDownloadMessage ||
                "Are you sure you want to cancel the download? Partial data will be discarded and you'll need to start again."}
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setCancelDialogOpen(false);
              }}>
              {t.dialog?.keepDownload || "Keep Download"}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                // Show immediate canceling message
                setLocalProgress({
                  phase: "error",
                  progress: 0,
                  message: t.dialog?.cancellingMessage || "Cancelling...",
                });
                setDownloadProgress(courseId.toString(), {
                  courseId: courseId.toString(),
                  phase: "error",
                  progress: 0,
                  message: t.dialog?.cancellingMessage || "Cancelling...",
                });
                // Abort the active controller if present
                if (controllerRef.current) {
                  controllerRef.current.abort();
                }
                setCancelDialogOpen(false);
              }}>
              {t.dialog?.confirmCancel || "Yes, cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Media Download Progress Indicator */}
      {downloadingMedia && mediaProgress && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm z-50 border border-gray-200">
          <div className="flex items-start gap-3">
            <Video className="w-5 h-5 text-cyan-500 animate-pulse shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 mb-1">
                {t.download.downloadingVideos}
              </p>
              <p className="text-xs text-gray-600 truncate mb-2">
                {mediaProgress.filename}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-cyan-500 h-full transition-all duration-300 ease-out"
                  style={{ width: `${mediaProgress.progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {mediaProgress.progress.toFixed(0)}%
              </p>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Open confirmation dialog for media cancel

                  setCancelDialogOpen(true);
                }}
                className="text-red-600 hover:bg-red-50">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
