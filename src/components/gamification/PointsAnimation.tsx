"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Star, Award } from "lucide-react";

export interface PointsAnimationProps {
  points: number;
  message?: string;
  duration?: number;
  onComplete?: () => void;
}

export function PointsAnimation({
  points,
  message,
  duration = 2000,
  onComplete,
}: PointsAnimationProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Play sound effect (offline-safe, from public/audio)
    try {
      const audio = new Audio("/audio/sound_gamification_points.wav");
      audio
        .play()
        .then(() => {})
        .catch((err) => {});
    } catch (e) {}

    // Trigger animation on mount
    setShow(true);

    const timer = setTimeout(() => {
      setShow(false);
      // Wait for exit animation to complete before calling onComplete
      setTimeout(() => {
        onComplete?.();
      }, 500); // Match exit animation duration
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, points, message, onComplete]);

  if (points <= 0) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="points-animation"
          initial={{ opacity: 0, scale: 0.5, y: -50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 50 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-9999 pointer-events-none">
          <div className="bg-linear-to-br from-cyan-500 to-cyan-600 text-white rounded-2xl shadow-2xl px-8 py-6 flex items-center gap-4 min-w-[300px]">
            {/* Icon */}
            <motion.div
              animate={{
                rotate: [0, -10, 10, -10, 0],
                scale: [1, 1.1, 1.1, 1.1, 1],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                repeatDelay: 0.5,
              }}>
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <Trophy className="w-8 h-8" />
              </div>
            </motion.div>

            {/* Content */}
            <div className="flex-1">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="text-3xl font-bold flex items-center gap-2">
                <span>+{points}</span>
                <Star className="w-6 h-6 fill-yellow-300 text-yellow-300" />
              </motion.div>
              {message && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-sm text-white/90 mt-1">
                  {message}
                </motion.p>
              )}
            </div>
          </div>

          {/* Confetti particles */}
          {points >= 50 && (
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{
                    x: 0,
                    y: 0,
                    opacity: 1,
                    scale: 1,
                  }}
                  animate={{
                    x: (Math.random() - 0.5) * 200,
                    y: Math.random() * 150 + 50,
                    opacity: 0,
                    scale: 0,
                    rotate: Math.random() * 360,
                  }}
                  transition={{
                    duration: 1,
                    delay: 0.3 + i * 0.05,
                    ease: "easeOut",
                  }}
                  className="absolute top-1/2 left-1/2">
                  <Award className="w-4 h-4 text-yellow-400" />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Hook to manage points animations
 */
export function usePointsAnimation() {
  const [animation, setAnimation] = useState<PointsAnimationProps | null>(null);

  const showPoints = (points: number, message?: string, duration?: number) => {
    setAnimation({
      points,
      message,
      duration,
      onComplete: () => setAnimation(null),
    });
  };

  const AnimationComponent = animation ? (
    <PointsAnimation {...animation} />
  ) : null;

  return { showPoints, PointsAnimation: AnimationComponent };
}
