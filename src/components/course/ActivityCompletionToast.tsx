"use client";

import { useEffect, useState, useRef } from "react";
import { useLanguageStore } from "@/store/useLanguageStore";
import { translations } from "@/locales";

interface ActivityCompletionToastProps {
  show: boolean;
  activityTitle: string;
  courseTitle: string;
  pointsEarned: number;
  onClose: () => void;
  duration?: number;
  completionType?: "activity" | "course" | "media" | "quiz" | "feedback";
}

export function ActivityCompletionToast({
  show,

  courseTitle,
  pointsEarned,
  onClose,
  duration = 3000,
  completionType = "activity",
}: ActivityCompletionToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const hasPlayedSound = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playSoundRef = useRef(false);
  const { language } = useLanguageStore();

  const t = translations[language as keyof typeof translations];
  const toastLabel =
    completionType === "course"
      ? t.notifications.courseDownloaded
      : completionType === "media"
        ? t.notifications.mediaCompleted
        : completionType === "quiz"
          ? t.notifications.quizAttempted
          : completionType === "feedback"
            ? t.notifications.feedbackSubmitted
            : t.notifications.activityCompleted;

  // Track the last show state to detect transitions
  const prevShowRef = useRef(false);

  useEffect(() => {
    // Only play sound when transitioning from false to true (not on every render)
    const isShowing = show && !prevShowRef.current;

    if (show) {
      // Play sound effect only once when toast first appears
      if (isShowing && !playSoundRef.current) {
        try {
          // Stop any existing audio first
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
          }

          const audio = new Audio("/audio/sound_gamification_points.wav");
          audioRef.current = audio;

          // Mark that we're playing sound for this show cycle
          playSoundRef.current = true;
          hasPlayedSound.current = true;

          audio
            .play()
            .then(() => {})
            .catch((err) => {});
        } catch (e) {}
      }

      // Trigger animation
      setIsVisible(true);

      // Auto-hide after duration
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for exit animation
      }, duration);

      prevShowRef.current = true;
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      // Reset flags when toast is hidden
      playSoundRef.current = false;
      hasPlayedSound.current = false;
      prevShowRef.current = false;
      // Clean up audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    }
    // Remove onClose from dependencies to prevent re-running when callback changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, duration]);

  if (!show && !isVisible) {
    return null;
  }

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`fixed bottom-24 md:bottom-6 left-1/2 transform -translate-x-1/2 transition-all duration-300 ease-out ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
      }`}
      style={{ maxWidth: "calc(100vw - 3rem)", zIndex: 9999 }}>
      <div
        className="relative bg-linear-to-r from-pink-600 to-pink-500 rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-4 min-w-[320px] md:min-w-[400px]"
        style={{
          background: "linear-gradient(135deg, #A8356B 0%, #D94A7E 100%)",
        }}>
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          aria-label="Close">
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Content */}
        <div className="flex-1 text-white">
          <h3 className="text-white text-lg mb-1">{toastLabel}</h3>
          <p className="text-white text-sm font-normal  line-clamp-1">
            {courseTitle}
          </p>
        </div>
        {/* Points Badge */}
        <div className="relative ">
          <div className="  text-center  -mb-6 text-6xl font-bold text-white/90">
            {pointsEarned}
          </div>

          <div className="relative  bg-[url('/course/notification/earned.svg')] aspect-80/30 bg-no-repeat bg-contain  md:px-8 px-4 py-4  transform rotate-2">
            <div className=" text-sm md:text-lg text-black -rotate-[4.21deg] font-medium ">
              {t.notifications.earned}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
