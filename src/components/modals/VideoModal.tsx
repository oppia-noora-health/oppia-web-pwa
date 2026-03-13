"use client";

import { X, RotateCcw, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef, useState, useEffect } from "react";

interface VideoModalProps {
  isOpen: boolean;
  videoUrl: string;
  videoTitle: string;
  posterUrl?: string;
  hasError?: boolean;
  onClose: () => void;
  onError: () => void;
  onNext?: () => void;
  onVideoComplete?: (timeWatched: number, duration: number) => void;
  onThresholdReached?: (
    filename: string,
    timeWatched: number,
    duration: number,
  ) => void;
  onNextWithVideoData?: (
    filename: string,
    timeWatched: number,
    duration: number,
  ) => void;
  filename?: string;
}

/**
 * Modal component for playing videos with controls
 * Supports both online streaming and offline playback
 * Shows Repeat/Next buttons when video completes
 */
export default function VideoModal({
  isOpen,
  videoUrl,
  videoTitle,
  posterUrl,
  hasError = false,
  onClose,
  onError,
  onNext,
  onVideoComplete,
  onThresholdReached,
  onNextWithVideoData,
  filename,
}: VideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [timeWatched, setTimeWatched] = useState(0);
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const thresholdReportedRef = useRef(false);
  const hasEverSeekedRef = useRef(false);

  // Track video time
  useEffect(() => {
    if (!isOpen) {
      setVideoCompleted(false);
      setTimeWatched(0);
      thresholdReportedRef.current = false;
      hasEverSeekedRef.current = false;
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    // Track when user starts seeking/dragging
    const handleSeeking = () => {
      hasEverSeekedRef.current = true;
    };

    const handleTimeUpdate = () => {
      // Only count progress if:
      // 1. User has NEVER seeked/dragged (not just currently not seeking)
      // 2. Video is actually playing (not paused)
      // 3. We haven't already reached the 80% threshold
      if (hasEverSeekedRef.current || video.paused) {
        return;
      }

      const currentTime = video.currentTime;
      const duration = video.duration || 0;
      setTimeWatched(currentTime);

      if (
        !thresholdReportedRef.current &&
        duration > 0 &&
        currentTime / duration >= 0.8 &&
        onThresholdReached &&
        filename
      ) {
        thresholdReportedRef.current = true;
        onThresholdReached(filename, currentTime, duration);
      }
    };

    const handleEnded = () => {
      setVideoCompleted(true);
      setTimeWatched(video.duration);

      // Notify parent about completion
      if (onVideoComplete) {
        onVideoComplete(video.duration, video.duration);
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("seeking", handleSeeking);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("seeking", handleSeeking);
      video.removeEventListener("ended", handleEnded);
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    };
  }, [isOpen, onVideoComplete, onThresholdReached, filename]);

  /**
   * Report final timeWatched on exit. Fires before onClose so the parent
   * can capture the data before the modal resets.
   * Used for interval-mode scoring (points per X seconds watched).
   * For threshold mode, processMediaPlayback ignores if already scored.
   */
  const reportExitTime = () => {
    if (
      onThresholdReached &&
      filename &&
      videoRef.current &&
      !hasEverSeekedRef.current &&
      timeWatched > 0
    ) {
      const duration = videoRef.current.duration || 0;
      if (duration > 0) {
        onThresholdReached(filename, timeWatched, duration);
      }
    }
  };

  const handleExit = () => {
    reportExitTime();
    onClose();
  };

  const handleRepeat = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      setVideoCompleted(false);
    }
  };

  const handleNext = () => {
    // Report final timeWatched for interval-mode scoring
    reportExitTime();

    // If video was completed and we have tracking callback, send the data
    if (videoCompleted && onNextWithVideoData && filename && videoRef.current) {
      onNextWithVideoData(filename, timeWatched, videoRef.current.duration);
    }

    if (onNext) {
      onNext();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-99999 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleExit}>
      <div
        className="relative w-full max-w-5xl mx-4 bg-black rounded-lg overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-linear-to-b from-black/80 to-transparent p-4 flex items-center justify-between">
          <h3 className="text-white font-medium text-lg truncate pr-4">
            {videoTitle}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExit}
            className="text-white hover:bg-white/20 shrink-0">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Video Player */}
        <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
          {hasError ? (
            <div className="w-full h-full flex items-center justify-center text-white p-8">
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-4">
                  Internet Required
                </h3>
                <p className="mb-6">
                  This video needs an active internet connection to play.
                </p>
                <Button onClick={onClose}>Close</Button>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                src={videoUrl}
                poster={posterUrl}
                controls
                autoPlay
                className="w-full h-full"
                style={{ maxHeight: "85vh" }}
                onLoadStart={() => void 0}
                onCanPlay={() => void 0}
                onError={(e) => {
                  onError();
                }}
              />

              {/* Completion Actions - Show after video ends */}
              {videoCompleted && (
                <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex gap-4 z-20">
                  <Button
                    onClick={handleRepeat}
                    className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md px-6 py-3 text-base font-semibold flex items-center gap-2">
                    <RotateCcw className="w-5 h-5" />
                    Repeat
                  </Button>
                  {onNext && (
                    <Button
                      onClick={handleNext}
                      className="bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-700 hover:to-pink-600 text-white px-6 py-3 text-base font-semibold flex items-center gap-2">
                      Next
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Close hint */}
        {!videoCompleted && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/60 text-sm">
            Press ESC or click outside to close
          </div>
        )}
      </div>
    </div>
  );
}
