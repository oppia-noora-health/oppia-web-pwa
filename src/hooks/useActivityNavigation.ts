import { useState, useEffect } from "react";
import type { CourseStructure } from "@/services/courseDownloadService";

interface Activity {
  title: string;
  index: number;
  type: string;
}

export function useActivityNavigation(
  courseData: CourseStructure | null,
  currentPageIndex: number,
) {
  const [currentLessonActivities, setCurrentLessonActivities] = useState<
    Activity[]
  >([]);
  const [currentActivityIndexInLesson, setCurrentActivityIndexInLesson] =
    useState(0);

  useEffect(() => {
    if (
      !courseData ||
      !courseData.sections ||
      courseData.sections.length === 0
    ) {
      setCurrentLessonActivities([]);
      setCurrentActivityIndexInLesson(0);
      return;
    }

    // Ensure currentPageIndex is within bounds
    if (
      currentPageIndex < 0 ||
      currentPageIndex >= courseData.sections.length
    ) {
      setCurrentLessonActivities([]);
      setCurrentActivityIndexInLesson(0);
      return;
    }

    // Get the current section's lesson title
    const currentSection = courseData.sections[currentPageIndex];
    if (!currentSection) {
      setCurrentLessonActivities([]);
      setCurrentActivityIndexInLesson(0);
      return;
    }

    const currentLessonTitle = currentSection.sectionTitle;

    // Find all activities (sections) that belong to the same lesson
    // For meta activities (with undefined sectionTitle), show only meta activities
    // For regular activities, show activities with the same sectionTitle
    const activitiesInLesson = courseData.sections
      .map((section, index) => ({
        title: section?.title || "Untitled Activity",
        index: index,
        type: section?.type || "content",
        sectionTitle: section?.sectionTitle,
      }))
      .filter((activity) => {
        // If current activity is a meta activity (undefined sectionTitle),
        // show all meta activities. Otherwise, show activities with same sectionTitle.
        if (currentLessonTitle === undefined) {
          return activity.sectionTitle === undefined;
        }
        return activity.sectionTitle === currentLessonTitle;
      });

    setCurrentLessonActivities(activitiesInLesson);

    // Find the current activity's position within the lesson
    const activityIndex = activitiesInLesson.findIndex(
      (activity) => activity.index === currentPageIndex,
    );
    setCurrentActivityIndexInLesson(activityIndex !== -1 ? activityIndex : 0);
  }, [courseData, currentPageIndex]);

  return {
    currentLessonActivities,
    currentActivityIndexInLesson,
    setCurrentActivityIndexInLesson,
  };
}
