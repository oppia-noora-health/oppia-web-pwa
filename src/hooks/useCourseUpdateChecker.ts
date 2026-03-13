/**
 * useCourseUpdateChecker Hook
 * Checks all downloaded courses for updates on app load
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  checkAllCoursesForUpdates,
  type CourseVersionInfo,
} from "@/services/courseVersionService";
import { isOnline } from "@/utils/networkUtils";

interface UseCourseUpdateCheckerReturn {
  updates: CourseVersionInfo[];
  isChecking: boolean;
  hasUpdates: boolean;
  recheckForUpdates: () => Promise<void>;
  getUpdateForCourse: (courseId: string) => CourseVersionInfo | undefined;
}

export function useCourseUpdateChecker(): UseCourseUpdateCheckerReturn {
  const [updates, setUpdates] = useState<CourseVersionInfo[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  const checkForUpdates = useCallback(async () => {
    // Only check if online
    if (!isOnline()) {
      return;
    }

    setIsChecking(true);
    try {
      const allUpdates = await checkAllCoursesForUpdates();
      setUpdates(allUpdates);
      setHasChecked(true);

      const coursesWithUpdates = allUpdates.filter((u) => u.hasUpdate);
      if (coursesWithUpdates.length > 0) {} else {}
    } catch (error) {} finally {
      setIsChecking(false);
    }
  }, []);

  // Check for updates on mount (only once)
  useEffect(() => {
    if (!hasChecked) {
      checkForUpdates();
    }
  }, [checkForUpdates, hasChecked]);

  // Get update info for a specific course
  const getUpdateForCourse = useCallback(
    (courseId: string): CourseVersionInfo | undefined => {
      return updates.find((update) => update.courseId === courseId);
    },
    [updates],
  );

  return {
    updates,
    isChecking,
    hasUpdates: updates.some((u) => u.hasUpdate),
    recheckForUpdates: checkForUpdates,
    getUpdateForCourse,
  };
}
