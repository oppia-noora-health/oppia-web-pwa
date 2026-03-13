"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TourWelcomeDialogProps {
  onStartTour: () => void;
  onSkipTour: () => void;
}

export function TourWelcomeDialog({
  onStartTour,
  onSkipTour,
}: TourWelcomeDialogProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Check if user has seen the tour prompt
    const hasSeenPrompt = localStorage.getItem("tour_prompt_shown");
    const tourPreference = localStorage.getItem("tour_preference");

    // Show prompt only on first login and if no preference is set
    if (!hasSeenPrompt && !tourPreference) {
      setTimeout(() => {
        setOpen(true);
        localStorage.setItem("tour_prompt_shown", "true");
      }, 1000);
    }
  }, []);

  const handleStartTour = () => {
    localStorage.setItem("tour_preference", "accepted");
    setOpen(false);

    // Start tour immediately, no navigation needed (already on /course)
    setTimeout(() => {
      onStartTour();
    }, 300);
  };

  const handleSkipTour = () => {
    localStorage.setItem("tour_preference", "skipped");
    setOpen(false);
    onSkipTour();
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="max-w-2xl w-[90vw] p-8 gap-6">
        <AlertDialogHeader className="space-y-4">
          <div className="flex items-center justify-center mb-2">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-5xl">🎓</span>
            </div>
          </div>

          <AlertDialogTitle className="text-3xl font-bold text-center">
            Welcome to Noora Academy!
          </AlertDialogTitle>

          <AlertDialogDescription className="text-center text-lg space-y-4 text-foreground/80">
            <p className="text-xl font-medium">
              We&apos;re excited to have you here! 🎉
            </p>
            <p>
              Would you like a quick guided tour to help you get started?
              We&apos;ll show you how to:
            </p>
            <ul className="text-left space-y-2 max-w-md mx-auto">
              <li className="flex items-start gap-3">
                <span className="text-2xl">📚</span>
                <span>Browse and download courses for offline learning</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-2xl">📊</span>
                <span>Track your progress and performance</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-2xl">🏆</span>
                <span>Earn points and achievements</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-2xl">🎬</span>
                <span>Access videos, quizzes, and interactive content</span>
              </li>
            </ul>
            <p className="text-sm italic">
              (The tour takes just 2 minutes and you can skip it anytime)
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={handleSkipTour}
            className="text-base py-6 sm:w-1/2 w-full">
            Skip Tour - I&apos;ll explore on my own
          </Button>
          <Button
            onClick={handleStartTour}
            className="text-base py-6 sm:w-1/2 w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
            Start Tour - Show me around! 🚀
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
