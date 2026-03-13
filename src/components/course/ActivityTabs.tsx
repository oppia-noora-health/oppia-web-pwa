"use client";

import { useEffect, useRef, useCallback } from "react";
import { Lock } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface Activity {
  title: string;
  index: number;
  type: string;
}

interface ActivityTabsProps {
  id?: string;
  activities: Activity[];
  currentIndex: number;
  onActivityClick: (index: number) => void;
  isActivityLocked?: (activityIndex: number) => boolean;
}

export default function ActivityTabs({
  id,
  activities,
  currentIndex,
  onActivityClick,
  isActivityLocked,
}: ActivityTabsProps) {
  const { t } = useTranslation();
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // Mouse drag-to-scroll state
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const hasDragged = useRef(false);

  /**
   * Scroll a specific tab button into the center of the container
   */
  const scrollTabToCenter = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const container = tabsContainerRef.current;
      if (!container) return;

      const buttonsWrapper = container.firstElementChild as HTMLElement;
      if (!buttonsWrapper?.children) return;
      if (index < 0 || index >= buttonsWrapper.children.length) return;

      const activeButton = buttonsWrapper.children[index] as HTMLElement;
      if (!activeButton) return;

      // Use getBoundingClientRect for more reliable measurements
      const containerRect = container.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();

      // Calculate how much to scroll so the button is centered
      const buttonCenter = buttonRect.left + buttonRect.width / 2;
      const containerCenter = containerRect.left + containerRect.width / 2;
      const scrollOffset = buttonCenter - containerCenter;

      const targetScroll = container.scrollLeft + scrollOffset;

      if (isFinite(targetScroll)) {
        try {
          container.scrollTo({
            left: Math.max(0, targetScroll),
            behavior,
          });
        } catch {
          // Fallback for older browsers
          container.scrollLeft = Math.max(0, targetScroll);
        }
      }
    },
    [],
  );

  /**
   * Scroll active tab to center when currentIndex changes
   */
  useEffect(() => {
    if (activities.length === 0) return;
    if (currentIndex < 0 || currentIndex >= activities.length) return;

    // Use rAF to ensure DOM has laid out before measuring
    const rafId = requestAnimationFrame(() => {
      scrollTabToCenter(currentIndex);
    });

    return () => cancelAnimationFrame(rafId);
  }, [currentIndex, activities, scrollTabToCenter]);

  /**
   * Mouse drag-to-scroll handlers for desktop
   */
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = tabsContainerRef.current;
    if (!container) return;

    isDragging.current = true;
    hasDragged.current = false;
    startX.current = e.pageX - container.offsetLeft;
    scrollLeft.current = container.scrollLeft;
    container.style.cursor = "grabbing";
    container.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    e.preventDefault();

    const container = tabsContainerRef.current;
    if (!container) return;

    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX.current) * 1.5; // Multiplier for scroll speed

    // Mark as dragged if moved more than 5px (to distinguish from clicks)
    if (Math.abs(walk) > 5) {
      hasDragged.current = true;
    }

    container.scrollLeft = scrollLeft.current - walk;
  }, []);

  const handleMouseUp = useCallback(() => {
    const container = tabsContainerRef.current;
    if (!container) return;

    isDragging.current = false;
    container.style.cursor = "grab";
    container.style.userSelect = "";
  }, []);

  const handleMouseLeave = useCallback(() => {
    const container = tabsContainerRef.current;
    if (!container) return;

    if (isDragging.current) {
      isDragging.current = false;
      container.style.cursor = "grab";
      container.style.userSelect = "";
    }
  }, []);

  const handleActivityClick = useCallback(
    (index: number) => {
      // Ignore click if the user was dragging
      if (hasDragged.current) {
        hasDragged.current = false;
        return;
      }
      onActivityClick(index);
    },
    [onActivityClick],
  );

  if (activities.length === 0) {
    return null;
  }

  return (
    <div
      id={id}
      ref={tabsContainerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      className="sticky top-[38px] md:top-[30px] z-9998 bg-white border-b border-white/20 backdrop-blur-sm shadow-sm shrink-0 overflow-x-auto scrollbar-hide cursor-grab select-none"
      style={{ WebkitOverflowScrolling: "touch" }}>
      <div className="flex gap-1 px-3 md:px-4 min-w-fit m-2 md:m-0 md:pb-2 justify-center">
        {activities.map((activity, index) => {
          const isLocked = isActivityLocked
            ? isActivityLocked(activity.index)
            : false;

          return (
            <button
              key={`activity-${index}-${activity.index}`}
              onClick={() => handleActivityClick(index)}
              className={`
                relative px-3 py-2 md:px-4 md:py-0 md:pb-2 text-xs md:text-sm font-medium whitespace-nowrap
                transition-colors duration-200 flex items-center gap-1 md:gap-1.5
                ${
                  currentIndex === index
                    ? "text-blue-600"
                    : isLocked
                      ? "text-gray-400"
                      : "text-gray-600 hover:text-gray-900"
                }
              `}
              draggable={false}>
              {isLocked && (
                <Lock className="w-2.5 h-2.5 md:w-3 md:h-3 shrink-0" />
              )}
              {activity.title || t("course.untitled")}
              {currentIndex === index && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
