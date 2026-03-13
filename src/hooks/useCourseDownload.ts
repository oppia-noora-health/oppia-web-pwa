import { useState, useCallback, useEffect } from "react";
import {
  courseDownloadService,
  CoursePackage,
} from "@/services/courseDownloadService";
import { useAuthenticatedApi } from "./useAuthenticatedApi";
import { isCourseDownloaded } from "@/utils/courseStorageIDB";
import { useStorageQuotaStore } from "@/store/storageQuotaStore";

export interface UseCourseDownloadResult {
  downloadCourse: (
    courseId: number,
    shortname: string,
    version: number,
    downloadUrl: string,
    isDownloaded?: boolean
  ) => Promise<CoursePackage | null>;
  getCourse: (courseId: number, version?: number) => CoursePackage | null;
  isDownloaded: (courseId: number, version?: number) => boolean;
  isDownloadedAsync: (courseId: number, version?: number) => Promise<boolean>;
  deleteCourse: (courseId: number, version?: number) => void;
  getAllDownloadedCourses: () => CoursePackage[];
  getFileContent: (
    courseId: number,
    filename: string,
    version?: number
  ) => string | null;
  downloading: boolean;
  error: string | null;
}

export function useCourseDownload(): UseCourseDownloadResult {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const api = useAuthenticatedApi();

  const isDownloadedAsync = useCallback(
    async (courseId: number, version?: number): Promise<boolean> => {
      // Check IndexedDB
      const inIDB = await isCourseDownloaded(courseId.toString());
      if (inIDB) return true;

      // Fallback to localStorage
      return courseDownloadService.isDownloaded(courseId, version);
    },
    []
  );

  const downloadCourse = useCallback(
    async (
      courseId: number,
      shortname: string,
      version: number,
      downloadUrl: string,
      isDownloaded: boolean = false
    ): Promise<CoursePackage | null> => {
      setDownloading(true);
      setError(null);

      try {
        const authenticatedUrl = api.buildUrl(downloadUrl);

        // Download and extract the course
        const coursePackage = await courseDownloadService.downloadCourse(
          authenticatedUrl,
          courseId,
          shortname,
          version,
          isDownloaded
        );

        return coursePackage;
      } catch (err: unknown) {
        const isQuotaExceeded =
          err instanceof Error && err.name === "QuotaExceededError";
        if (isQuotaExceeded) {
          useStorageQuotaStore.getState().setShowStorageQuotaDialog(true);
        }
        const errorMessage =
          err instanceof Error ? err.message : "Failed to download course";
        setError(errorMessage);
        return null;
      } finally {
        setDownloading(false);
      }
    },
    [api]
  );

  const getCourse = useCallback((courseId: number, version?: number) => {
    return courseDownloadService.getCourse(courseId, version);
  }, []);

  const isDownloaded = useCallback((courseId: number, version?: number) => {
    return courseDownloadService.isDownloaded(courseId, version);
  }, []);

  const deleteCourse = useCallback((courseId: number, version?: number) => {
    courseDownloadService.deleteCourse(courseId, version);
  }, []);

  const getAllDownloadedCourses = useCallback(() => {
    return courseDownloadService.getAllDownloadedCourses();
  }, []);

  const getFileContent = useCallback(
    (courseId: number, filename: string, version?: number) => {
      return courseDownloadService.getFileContent(courseId, filename, version);
    },
    []
  );

  return {
    downloadCourse,
    getCourse,
    isDownloaded,
    isDownloadedAsync,
    deleteCourse,
    getAllDownloadedCourses,
    getFileContent,
    downloading,
    error,
  };
}
