"use client";

import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";

interface CourseNavigationProps {
  currentPage: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  id?: string;
  currentActivityInSection?: number;
  totalActivitiesInSection?: number;
  isOnFirstSlide?: boolean;
  isOnLastSlide?: boolean;
  nextLabel?: string;
}

export default function CourseNavigation({
  currentPage,
  totalPages,
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
  id,
  currentActivityInSection,
  totalActivitiesInSection,
  isOnFirstSlide,
  isOnLastSlide,
  nextLabel = "Next",
}: CourseNavigationProps) {
  // Use section-specific counts if provided, otherwise fall back to total
  const displayCurrent = currentActivityInSection ?? currentPage + 1;
  const displayTotal = totalActivitiesInSection ?? totalPages;

  // Determine button visibility based on slide position
  const showPrevious =
    isOnFirstSlide !== undefined
      ? isOnFirstSlide // Show Previous when on first slide
      : canGoPrevious; // Normal behavior when no slides
  const showNext =
    isOnLastSlide !== undefined
      ? isOnLastSlide // Show Next when on last slide
      : canGoNext; // Normal behavior when no slides

  return (
    <div
      id={id}
      className="w-full shrink-0 border-t bg-white border-white/20 backdrop-blur-sm px-3 py-3 md:px-4 md:py-4 fixed bottom-0 left-0 right-0 md:sticky md:bottom-0 z-20">
      <div className="max-w-4xl mx-auto grid grid-cols-3 items-center gap-1.5 md:gap-2">
        {/* Left column: Previous button or empty space */}
        <div className="flex justify-start">
          {showPrevious ? (
            <BackButton
              variant="outline"
              onClick={onPrevious}
              disabled={!canGoPrevious}
              label="Previous"
              iconSize="sm"
              className="border-gray-300 shrink-0 text-xs md:text-sm py-2 md:py-2.5 px-2 md:px-3"
            />
          ) : (
            <div className="w-0" />
          )}
        </div>

        {/* Center column: Activity numbers (always centered) */}
        <div className="flex justify-center">
          <span className="text-xs md:text-sm text-gray-600">
            {displayCurrent} / {displayTotal}
          </span>
        </div>

        {/* Right column: Next button or empty space */}
        <div className="flex justify-end">
          {showNext ? (
            <Button
              variant="secondary"
              onClick={onNext}
              disabled={!canGoNext}
              className="shrink-0 text-xs md:text-sm py-2 md:py-2.5 px-2 md:px-3 h-auto min-h-0">
              {nextLabel}
              <ChevronRight className="w-3 h-3 md:w-4 md:h-4 ml-1 md:ml-2" />
            </Button>
          ) : (
            <div className="w-0" />
          )}
        </div>
      </div>
    </div>
  );
}
