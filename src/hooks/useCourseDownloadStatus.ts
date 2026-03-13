import { useState, useEffect } from "react";
import { useCourseDownload } from "@/hooks/useCourseDownload";
import type { Course } from "@/hooks/useTagCourses";

export const useCourseDownloadStatus = (courses: Course[]) => {
  const [downloadedCourseIds, setDownloadedCourseIds] = useState<Set<number>>(
    new Set()
  );
  const { isDownloadedAsync } = useCourseDownload();

  useEffect(() => {
    const checkDownloadedStatus = async () => {
      const downloadedIds = new Set<number>();
      for (const course of courses) {
        const downloaded = await isDownloadedAsync(course.id, course.version);
        if (downloaded) {
          downloadedIds.add(course.id);
        }
      }
      setDownloadedCourseIds(downloadedIds);
    };

    if (courses.length > 0) {
      checkDownloadedStatus();
    }
  }, [courses, isDownloadedAsync]);

  const markAsDownloaded = (courseId: number) => {
    setDownloadedCourseIds((prev) => new Set(prev).add(courseId));
  };

  const markAsDeleted = (courseId: number) => {
    setDownloadedCourseIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(courseId);
      return newSet;
    });
  };

  const isDownloaded = (courseId: number) => downloadedCourseIds.has(courseId);

  return {
    downloadedCourseIds,
    isDownloaded,
    markAsDownloaded,
    markAsDeleted,
  };
};
