import { useState, useEffect, useRef, useCallback } from "react";
import {
  getMissingMedia,
  downloadAllMissingMedia,
} from "@/services/mediaDownloadService";
import type { Media, MediaDownloadProgress } from "@/types/media";
import { useLanguageStore } from "@/store/useLanguageStore";
import { translations } from "@/locales";

export type MediaGateStatus =
  | "idle"
  | "checking"
  | "ready-no-missing"
  | "blocked-missing"
  | "downloading"
  | "error";

export interface MediaNotice {
  open: boolean;
  title: string;
  message: string;
  tone: "success" | "warning" | "error";
}

export function useMediaDownload(
  courseId: string | null,
  courseSource: string | null,
) {
  const { language } = useLanguageStore();
  const locale =
    translations[language as keyof typeof translations] || translations.en;
  const mediaText = locale.media || translations.en.media;

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [missingMedia, setMissingMedia] = useState<Media[]>([]);
  const [mediaGateStatus, setMediaGateStatus] =
    useState<MediaGateStatus>("idle");
  const [mediaGateError, setMediaGateError] = useState<string | null>(null);
  const [showMediaPrompt, setShowMediaPrompt] = useState(false);
  const [downloadingMedia, setDownloadingMedia] = useState(false);
  const [mediaDownloadProgress, setMediaDownloadProgress] =
    useState<MediaDownloadProgress | null>(null);
  const [mediaNotice, setMediaNotice] = useState<MediaNotice | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const checkMissingMedia = useCallback(async () => {
    // Only check if course is loaded from IndexedDB
    if (!courseId || courseSource !== "indexeddb") {
      setMissingMedia([]);
      setMediaGateError(null);
      setMediaGateStatus("ready-no-missing");
      return;
    }

    setMediaGateStatus("checking");
    setMediaGateError(null);

    try {
      const missing = await getMissingMedia(courseId);

      setMissingMedia(missing);
      setMediaGateStatus(
        missing.length > 0 ? "blocked-missing" : "ready-no-missing",
      );
    } catch (error) {
      setMediaGateError(mediaText.gateCouldNotVerify);
      // Fail closed so user cannot open course when verification fails.
      setMediaGateStatus("error");
    }
  }, [courseId, courseSource, mediaText.gateCouldNotVerify]);

  useEffect(() => {
    checkMissingMedia();
  }, [checkMissingMedia]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (courseId && courseSource === "indexeddb" && !downloadingMedia) {
        void checkMissingMedia();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
      setDownloadingMedia(false);
      setMediaGateError(mediaText.gateOfflineReconnectError);
      setMediaGateStatus("blocked-missing");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [
    checkMissingMedia,
    courseId,
    courseSource,
    downloadingMedia,
    mediaText.gateOfflineReconnectError,
  ]);

  const handleDownloadMedia = async () => {
    if (!courseId) return;

    // Check if online before downloading
    if (!isOnline) {
      setMediaNotice({
        open: true,
        title: mediaText.gateOfflineTitle,
        message: mediaText.gateOfflineDownloadAlert,
        tone: "warning",
      });
      setMediaGateError(mediaText.gateOfflineDownloadInline);
      setMediaGateStatus("blocked-missing");
      return;
    }

    setDownloadingMedia(true);
    setMediaGateStatus("downloading");
    setMediaGateError(null);
    setShowMediaPrompt(false);

    try {
      const controller = new AbortController();
      controllerRef.current = controller;

      const result = await downloadAllMissingMedia(
        courseId,
        (progress) => {
          setMediaDownloadProgress(progress);
        },
        controller.signal,
      );

      const remainingMissing = await getMissingMedia(courseId);
      setMissingMedia(remainingMissing);
      setMediaDownloadProgress(null);

      if (remainingMissing.length === 0) {
        setMediaGateError(null);
        setMediaGateStatus("ready-no-missing");
      } else {
        setMediaGateError(mediaText.gateMissingAfterDownload);
        setMediaGateStatus("blocked-missing");
      }

      if (result.failed > 0) {
        setMediaNotice({
          open: true,
          title: mediaText.gateDownloadRequiredTitle,
          message: `Downloaded ${result.success} of ${
            result.success + result.failed
          } media files. ${result.failed} file(s) failed. ${mediaText.downloadFailedMediaAlert}`,
          tone: "warning",
        });
      } else {
        setMediaNotice({
          open: true,
          title: locale.success?.downloaded || "Downloaded successfully",
          message: `All ${result.success} media file(s) were downloaded successfully.`,
          tone: "success",
        });
      }
    } catch (error) {
      const isAbort =
        (error as any)?.name === "AbortError" ||
        (error instanceof DOMException && error.name === "AbortError");

      if (isAbort || !isOnline) {
        setMediaGateError(mediaText.gateConnectionLost);
        setMediaGateStatus("blocked-missing");
        return;
      }

      setMediaNotice({
        open: true,
        title: locale.error?.downloadFailed || "Download failed",
        message: mediaText.downloadFailedMediaAlert,
        tone: "error",
      });
      setMediaGateError(mediaText.gateDownloadFailedGeneric);
      setMediaGateStatus("error");
    } finally {
      controllerRef.current = null;
      setDownloadingMedia(false);
    }
  };

  return {
    isOnline,
    missingMedia,
    mediaGateStatus,
    mediaGateError,
    showMediaPrompt,
    setShowMediaPrompt,
    downloadingMedia,
    mediaDownloadProgress,
    mediaNotice,
    closeMediaNotice: () => setMediaNotice(null),
    handleDownloadMedia,
    refreshMissingMedia: checkMissingMedia,
  };
}
