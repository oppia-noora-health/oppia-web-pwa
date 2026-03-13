import { useState, useEffect, useCallback } from "react";

export interface VideoModalState {
  isOpen: boolean;
  videoUrl: string;
  videoTitle: string;
  posterUrl?: string;
  hasError?: boolean;
}

export interface UnavailableMediaModalState {
  isOpen: boolean;
  mediaName: string;
  mediaType: "video" | "audio" | "pdf";
  downloadUrl?: string;
  retrying: boolean;
}

/**
 * Custom hook to manage media modals state and handlers
 * Handles video playback modal and unavailable media modal
 */
export function useMediaModals() {
  const [videoModal, setVideoModal] = useState<VideoModalState>({
    isOpen: false,
    videoUrl: "",
    videoTitle: "",
    hasError: false,
  });

  const [unavailableMediaModal, setUnavailableMediaModal] =
    useState<UnavailableMediaModalState>({
      isOpen: false,
      mediaName: "",
      mediaType: "video",
      retrying: false,
    });

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Handle ESC key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (videoModal.isOpen) {
          setVideoModal({ isOpen: false, videoUrl: "", videoTitle: "" });
        }
        if (unavailableMediaModal.isOpen) {
          setUnavailableMediaModal({
            isOpen: false,
            mediaName: "",
            mediaType: "video",
            retrying: false,
          });
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [videoModal.isOpen, unavailableMediaModal.isOpen]);

  // Retry loading media when network becomes available
  const handleRetryMedia = useCallback(async () => {
    if (!isOnline || !unavailableMediaModal.downloadUrl) {
      return;
    }

    setUnavailableMediaModal((prev) => ({ ...prev, retrying: true }));

    try {
      // Try to fetch the media to verify it's accessible
      const response = await fetch(unavailableMediaModal.downloadUrl, {
        method: "HEAD",
      });

      if (response.ok) {
        // Media is available, open it in video modal
        if (unavailableMediaModal.mediaType === "video") {
          setUnavailableMediaModal({
            isOpen: false,
            mediaName: "",
            mediaType: "video",
            retrying: false,
          });
          setVideoModal({
            isOpen: true,
            videoUrl: unavailableMediaModal.downloadUrl,
            videoTitle: unavailableMediaModal.mediaName,
          });
        } else {
          // For other media types, open in new tab
          window.open(unavailableMediaModal.downloadUrl, "_blank");
          setUnavailableMediaModal({
            isOpen: false,
            mediaName: "",
            mediaType: "video",
            retrying: false,
          });
        }
      } else {
        throw new Error("Media still not accessible");
      }
    } catch (error) {
      setUnavailableMediaModal((prev) => ({ ...prev, retrying: false }));
    }
  }, [
    isOnline,
    unavailableMediaModal.downloadUrl,
    unavailableMediaModal.mediaType,
    unavailableMediaModal.mediaName,
  ]);

  const openVideoModal = useCallback(
    (url: string, title: string, posterUrl?: string) => {
      setVideoModal({
        isOpen: true,
        videoUrl: url,
        videoTitle: title,
        posterUrl,
        hasError: false,
      });
    },
    []
  );

  const closeVideoModal = useCallback(() => {
    setVideoModal({ isOpen: false, videoUrl: "", videoTitle: "" });
  }, []);

  const setVideoError = useCallback(() => {
    setVideoModal((prev) => ({ ...prev, hasError: true }));
  }, []);

  const openUnavailableMediaModal = useCallback(
    (name: string, type: "video" | "audio" | "pdf", downloadUrl?: string) => {
      setUnavailableMediaModal({
        isOpen: true,
        mediaName: name,
        mediaType: type,
        downloadUrl,
        retrying: false,
      });
    },
    []
  );

  const closeUnavailableMediaModal = useCallback(() => {
    setUnavailableMediaModal({
      isOpen: false,
      mediaName: "",
      mediaType: "video",
      retrying: false,
    });
  }, []);

  return {
    videoModal,
    unavailableMediaModal,
    isOnline,
    handleRetryMedia,
    openVideoModal,
    closeVideoModal,
    setVideoError,
    openUnavailableMediaModal,
    closeUnavailableMediaModal,
  };
}
