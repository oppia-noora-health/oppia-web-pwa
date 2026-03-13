import { useRef } from "react";

interface UseCourseSwipeNavigationProps {
  onSwipeLeft: () => void; // Navigate to next page
  onSwipeRight: () => void; // Navigate to previous page
  minSwipeDistance?: number; // Minimum distance for swipe (default: 50px)
  tapThreshold?: number; // Maximum distance to be considered a tap (default: 10px)
}

export function useCourseSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  minSwipeDistance = 100,
  tapThreshold = 50,
}: UseCourseSwipeNavigationProps) {
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchEndY = useRef<number>(0);
  const touchStartTarget = useRef<EventTarget | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTarget.current = e.target;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    const swipeDistanceX = touchStartX.current - touchEndX.current;
    const swipeDistanceY = Math.abs(touchStartY.current - touchEndY.current);
    const totalDistance = Math.sqrt(swipeDistanceX ** 2 + swipeDistanceY ** 2);

    // Detect tap/click or small movements (scrolling) - not a swipe
    if (totalDistance < tapThreshold) {
      return;
    }

    // If vertical movement is significant, it's a scroll, not a swipe
    if (swipeDistanceY > 30) {
      return;
    }

    // Check if touch started within a horizontally scrollable element
    const target = touchStartTarget.current as HTMLElement;
    if (target) {
      // Find the closest horizontally scrollable container FIRST (before interactive check)
      const scrollableContainer = target.closest(
        "audio-section, noor-section, content-section, info-section, definition-section, what-we-learned-section",
      );

      // If touch started inside a scrollable container, NEVER navigate
      // Let the user scroll freely within these sections
      if (scrollableContainer) {
        const hasHorizontalScroll =
          scrollableContainer.scrollWidth > scrollableContainer.clientWidth;

        if (hasHorizontalScroll) {
          return;
        }
      }

      // Check if touch started on interactive elements that should not trigger swipe
      const interactiveSelectors = [
        "card",
        "know-more",
        "noora-button",
        "button",
        "a",
        "video",
        "audio",
        "input",
        "select",
        "textarea",
        '[role="button"]',
        ".video-overlay",
        "#prevBtn",
        "#nextBtn",
      ];

      const isInteractive = interactiveSelectors.some((selector) => {
        try {
          return target.closest(selector) !== null;
        } catch (e) {
          return false;
        }
      });

      if (isInteractive) {
        return;
      }
    }

    // Only trigger swipe if horizontal movement is greater than vertical (to avoid conflicts with scrolling)
    if (
      Math.abs(swipeDistanceX) > swipeDistanceY &&
      Math.abs(swipeDistanceX) > minSwipeDistance
    ) {
      if (swipeDistanceX > 0) {
        // Swiped left - go to next page
        onSwipeLeft();
      } else {
        // Swiped right - go to previous page
        onSwipeRight();
      }
    }
  };

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
