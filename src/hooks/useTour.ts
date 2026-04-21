"use client";

import { useCallback } from "react";
import { driver } from "driver.js";
import type { DriveStep, Config } from "driver.js";

export function useTour(tourId: string) {
  // console.log("🎯 useTour - Hook initialized with tourId:", tourId);

  const markTourAsCompleted = useCallback(() => {
    localStorage.setItem(`tour_completed_${tourId}`, "true");
    localStorage.setItem(`tour_preference_${tourId}`, "completed");
  }, [tourId]);

  const markTourAsSkipped = useCallback(() => {
    localStorage.setItem(`tour_preference_${tourId}`, "skipped");
  }, [tourId]);

  const markTourAsDisabled = useCallback(() => {
    localStorage.setItem(`tour_completed_${tourId}`, "true");
    localStorage.setItem(`tour_preference_${tourId}`, "disabled");
  }, [tourId]);

  const startTour = useCallback(
    (steps: DriveStep[], config?: Partial<Config>) => {
      const driverObj = driver({
        showProgress: true,
        showButtons: ["next", "previous", "close"],
        steps: steps,
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Finish",
        ...config,
        onDestroyStarted: (element, step, opts) => {
          // Mark as completed if on last step (Finish button)
          const isLastStep = !driverObj.hasNextStep();
          if (isLastStep) {
            markTourAsCompleted();
          } else {
            // If destroyed before completion, mark as skipped
            const currentStepIndex = driverObj.getActiveIndex();
            if (
              currentStepIndex !== undefined &&
              currentStepIndex < steps.length - 1
            ) {
              markTourAsSkipped();
            }
          }

          // Call custom onDestroyStarted if provided
          if (config?.onDestroyStarted) {
            config.onDestroyStarted(element, step, opts);
          }

          // IMPORTANT: Must call destroy() when overriding onDestroyStarted
          // This is required by driver.js to properly exit the tour
          driverObj.destroy();
        },
        onDestroyed: (element, step, opts) => {
          if (config?.onDestroyed) {
            config.onDestroyed(element, step, opts);
          }
        },
        onNextClick: (element, step, opts) => {
          driverObj.moveNext();
        },
        onPrevClick: (element, step, opts) => {
          driverObj.movePrevious();
        },
        onPopoverRender: (popover, opts) => {
          const isFirstStep = driverObj.getActiveIndex() === 0;

          if (isFirstStep) {
            // Hide the back button on first step
            const prevBtn = popover.wrapper.querySelector(
              ".driver-popover-prev-btn",
            ) as HTMLElement;
            if (prevBtn) {
              prevBtn.style.display = "none";
            }
          }

          // Add Skip button on every step (Driver.js custom button via onPopoverRender).
          // Use only "driver-skip-btn" (no "driver-popover") so Driver.js's popover
          // click filter doesn't intercept and stop propagation.
          const footer = popover.footerButtons;
          const skipBtn = document.createElement("button");
          skipBtn.type = "button";
          skipBtn.innerText = "Skip";
          skipBtn.className = "driver-skip-btn";
          skipBtn.setAttribute("aria-label", "Skip tour and don't show again");

          skipBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            markTourAsDisabled();
            driverObj.destroy();
          });

          footer.insertBefore(skipBtn, footer.firstChild);

          if (config?.onPopoverRender) {
            config.onPopoverRender(popover, opts);
          }
        },
      });

      driverObj.drive();
    },
    [markTourAsCompleted, markTourAsSkipped, markTourAsDisabled, tourId],
  );

  const hasCompletedTour = useCallback(() => {
    // Check if tour has been completed OR if user previously disabled it
    const completed =
      localStorage.getItem(`tour_completed_${tourId}`) === "true";
    const preference = localStorage.getItem(`tour_preference_${tourId}`);
    return completed || preference === "disabled";
  }, [tourId]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(`tour_completed_${tourId}`);
    localStorage.removeItem(`tour_preference_${tourId}`);
  }, [tourId]);

  return {
    startTour,
    markTourAsCompleted,
    hasCompletedTour,
    resetTour,
  };
}
