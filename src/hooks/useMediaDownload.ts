import { useState, useEffect } from "react";
import {
  getMissingMedia,
  downloadAllMissingMedia,
} from "@/services/mediaDownloadService";
import type { Media, MediaDownloadProgress } from "@/types/media";

export function useMediaDownload(
  courseId: string | null,
  courseSource: string | null
) {
  const [missingMedia, setMissingMedia] = useState<Media[]>([]);
  const [showMediaPrompt, setShowMediaPrompt] = useState(false);
  const [downloadingMedia, setDownloadingMedia] = useState(false);
  const [mediaDownloadProgress, setMediaDownloadProgress] =
    useState<MediaDownloadProgress | null>(null);

  useEffect(() => {
    const checkMissingMedia = async () => {
      // Only check if course is loaded from IndexedDB
      if (!courseId || courseSource !== "indexeddb") return;

      try {
        const missing = await getMissingMedia(courseId);

        if (missing.length > 0) {
          setMissingMedia(missing);
        } else {}
      } catch (error) {}
    };

    checkMissingMedia();
  }, [courseId, courseSource]);

  const handleDownloadMedia = async () => {
    if (!courseId) return;

    // Check if online before downloading
    if (!navigator.onLine) {
      alert("You need an internet connection to download media files.");
      return;
    }

    setDownloadingMedia(true);
    setShowMediaPrompt(false);

    try {
      const result = await downloadAllMissingMedia(courseId, (progress) => {
        setMediaDownloadProgress(progress);
      });

      setMissingMedia([]);
      setMediaDownloadProgress(null);

      if (result.failed > 0) {
        alert(
          `⚠️ Downloaded ${result.success} of ${
            result.success + result.failed
          } media files.\n${
            result.failed
          } file(s) failed - please check your internet connection and try again.`
        );
      } else {
        alert(
          `✅ All ${result.success} media file(s) downloaded successfully! Videos and audio are now available offline.`
        );
      }
    } catch (error) {
      alert(
        "❌ Failed to download media files. Please check your internet connection and try again."
      );
    } finally {
      setDownloadingMedia(false);
    }
  };

  return {
    missingMedia,
    showMediaPrompt,
    setShowMediaPrompt,
    downloadingMedia,
    mediaDownloadProgress,
    handleDownloadMedia,
  };
}
