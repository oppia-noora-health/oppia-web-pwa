"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "../ui/button";

export type BadgeType = "silver" | "gold" | "diamond";

interface BadgeAwardedToastProps {
  show: boolean;
  badgeType: BadgeType;
  courseTitle: string;
  onClose: () => void;
  duration?: number;
}

// Get badge image path
const getBadgeImagePath = (type: BadgeType): string => {
  switch (type) {
    case "diamond":
      return "/points/badges/daimond.svg";
    case "gold":
      return "/points/badges/gold.svg";
    case "silver":
      return "/points/badges/silver.svg";
    default:
      return "/points/badges/silver.svg";
  }
};

// Get badge label
const getBadgeLabel = (type: BadgeType): string => {
  switch (type) {
    case "diamond":
      return "Diamond Badge";
    case "gold":
      return "Gold Badge";
    case "silver":
      return "Silver Badge";
    default:
      return "Badge";
  }
};

// Get badge description
const getBadgeDescription = (type: BadgeType): string => {
  switch (type) {
    case "diamond":
      return "You completed 100% of the course!";
    case "gold":
      return "You completed 66% of the course!";
    case "silver":
      return "You completed 33% of the course!";
    default:
      return "Keep going!";
  }
};

// Get badge background gradient
const getBadgeGradient = (type: BadgeType): string => {
  switch (type) {
    case "diamond":
      return "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
    case "gold":
      return "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)";
    case "silver":
      return "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)";
    default:
      return "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)";
  }
};

export function BadgeAwardedToast({
  show,
  badgeType,
  courseTitle,
  onClose,
  duration = 5000, // Longer duration for badge celebration
}: BadgeAwardedToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      // Play sound effect (offline-safe, from public/audio)
      try {
        const audio = new Audio("/audio/sound_gamification_points.wav");
        audio
          .play()
          .then(() => {})
          .catch((err) => {});
      } catch (e) {}

      // Trigger animation
      setIsVisible(true);

      // Auto-hide after duration
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for exit animation
      }, duration);

      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [show, duration, onClose]);

  if (!show && !isVisible) {
    return null;
  }

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center transition-all duration-300 ease-out ${
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      style={{ zIndex: 9999 }}>
      {/* Backdrop */}
      <div
        className={`absolute  inset-0 bg-black/50 transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Toast Content */}
      <div
        className={`relative  transform transition-all duration-500 ease-out ${
          isVisible ? "scale-100 translate-y-0" : "scale-75 translate-y-8"
        }`}>
        <div className="relative rounded-3xl bg-secondary shadow-2xl p-6 min-w-[320px] max-w-[400px] text-center overflow-hidden">
          {/* Close Button X */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors z-20"
            aria-label="Close">
            <svg
              className="w-5 h-5 "
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
          <div className="relative z-10">
            {/* Badge Icon with animation */}
            <div className="mb-4 flex justify-center">
              <div className={`relative `}>
                <Image
                  src={getBadgeImagePath(badgeType)}
                  alt={getBadgeLabel(badgeType)}
                  width={100}
                  height={100}
                  className="object-contain drop-shadow-lg"
                />
                {/* Glow effect */}
              </div>
            </div>

            {/* Badge Awarded Text */}
            <h2 className=" text-xl  mb-1"> Badge Awarded! </h2>

            {/* Badge Name */}
            <h3 className=" text-2xl font-medium mb-2">
              {getBadgeLabel(badgeType)}
            </h3>

            {/* Description */}
            <p className="/90 text-sm mb-3">{getBadgeDescription(badgeType)}</p>

            {/* Course Title */}
            <p className="/70 text-xs line-clamp-2">{courseTitle}</p>

            {/* Continue Button */}
            <Button
              onClick={handleClose}
              className="mt-4 px-6 py-2  transition-colors">
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
