"use client";

import { useAuthStore } from "@/store/useStore";
import { useCourseStore } from "@/store/useCourseStore";
import { useAuthenticatedApi } from "@/hooks/useAuthenticatedApi";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Download, Check, Info, ChevronRight, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/Loading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useCourseDownload } from "@/hooks/useCourseDownload";
// TEMPORARILY DISABLED: Course update functionality
// import { useCourseUpdateChecker } from "@/hooks/useCourseUpdateChecker";
import { CourseContextMenu } from "@/components/course/CourseContextMenu";
import { Tag, TagsResponse } from "@/types/tag";
import { useTour } from "@/hooks/useTour";
import { getCourseManagementTour } from "@/config/tourSteps";
import { useTranslation } from "@/hooks/useTranslation";

interface Course {
  id: number;
  shortname: string;
  title: Record<string, string | null>;
  description: Record<string, string | null>;
  version: number;
  url?: string;
  download_url?: string;
  resource_uri?: string;
  status?: string;
  author?: string;
  restricted?: boolean;
  priority?: number;
  organisation?: string;
  username?: string;
  cohorts?: number[];
}

export default function CourseManagementPage() {
  const { user, isAuthenticated } = useAuthStore();
  const { courses, setCourses, clearCache, isCacheValid } = useCourseStore();
  const api = useAuthenticatedApi();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const { downloadCourse, isDownloadedAsync } = useCourseDownload();
  // TEMPORARILY DISABLED: Course update functionality
  // const { updates, isChecking, hasUpdates } = useCourseUpdateChecker(); // Check for updates
  const { t } = useTranslation();

  // Tour setup - Course Management page specific tour
  const { startTour, hasCompletedTour } = useTour("course-management");

  const handleStartTour = () => {
    const tourSteps = getCourseManagementTour();
    startTour(tourSteps);
  };

  // Note: Auth redirect is handled by AuthProvider, no need to duplicate here

  // Auto-trigger tour for first-time visitors
  useEffect(() => {
    if (isAuthenticated && !loading && tags.length > 0 && !hasCompletedTour()) {
      const timer = setTimeout(() => {
        handleStartTour();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, loading, tags.length, hasCompletedTour]);

  useEffect(() => {
    const fetchTags = async () => {
      if (!api.isAuthenticated) return;

      setLoading(true);
      setError(null);
      try {
        // Fetch tags from API
        const response: TagsResponse = await api.get("/tag/");

        // Sort tags alphabetically by name
        const sortedTags = response.tags.sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        setTags(sortedTags);
        // Prefetch all courses for caching (optional)
        if (courses.length === 0) {
          const coursesResponse = await api.get("/course/");
          let coursesData: Course[] = [];
          if (Array.isArray(coursesResponse)) {
            coursesData = coursesResponse;
          } else if (
            coursesResponse.courses &&
            Array.isArray(coursesResponse.courses)
          ) {
            coursesData = coursesResponse.courses;
          }
          setCourses(coursesData);
          try {
            // Persist draft course ids to localStorage (overwrite full list)
            const DRAFT_KEY = "noora_draft_courses_v1";
            const draftIds = coursesData
              .filter((c) => c.status === "draft")
              .map((c) => String(c.id));
            if (typeof window !== "undefined") {
              localStorage.setItem(DRAFT_KEY, JSON.stringify(draftIds));
            }
          } catch (e) {}
        }
      } catch (error: any) {
        // Provide more specific error messages
        if (error.code === "ECONNABORTED") {
          setError(
            "Request timed out. Please check your internet connection and try again."
          );
        } else if (error.response?.status === 404) {
          setError("Course categories not found. Please contact support.");
        } else if (error.response?.status >= 500) {
          setError("Server error. Please try again later.");
        } else {
          setError("Failed to load course categories. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTags();
  }, [api, courses.length]); // Only depend on courses.length, not the courses array or setCourses

  const handleTagClick = (tag: Tag) => {
    if (isNavigating) return;
    setIsNavigating(true);
    router.push(
      `/course-management/${tag.id}?name=${encodeURIComponent(tag.name)}`
    );
    // reset navigating flag if navigation doesn't happen within 1.5s
    setTimeout(() => setIsNavigating(false), 1500);
  };

  if (!user) {
    return <PageLoading />;
  }

  return (
    <div className="min-h-screen w-full h-full ">
      {/* Header */}
      <header
        className=" border-b px-4 md:px-6 py-6"
        id="course-management-header">
        <div className="flex items-center gap-3 mb-4 md:hidden">
          <BackButton
            onClick={() => router.back()}
            label={t("common.back")}
            iconSize="md"
          />
        </div>
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
              {t("courseManagement.title")}
            </h1>
            {/* <p className="text-sm text-gray-500 mt-1">
              {t("courseManagement.subtitle")}
            </p> */}
          </div>
        </div>
      </header>
      {/* Main Content */}
      <div
        id="course-management-page-content"
        className="p-4 md:p-6 max-w-7xl mx-auto">
        {loading ? (
          // Loading Skeleton
          (<div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
              </Card>
            ))}
          </div>)
        ) : error ? (
          // Error State
          (<div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <Button
              onClick={() => window.location.reload()}
              className="mt-4 bg-red-500 hover:bg-red-600">
              Retry
            </Button>
          </div>)
        ) : tags.length === 0 ? (
          // Empty State
          (<div className="bg-white rounded-lg p-8 text-center shadow-sm">
            <p className="text-gray-600 text-lg mb-2">
              No categories available
            </p>
            <p className="text-gray-500 text-sm">
              There are no course categories available at the moment.
            </p>
          </div>)
        ) : isNavigating ? (
          <PageLoading text={t("common.loading")} />
        ) : (
          // Tags Grid
          (<div className="space-y-6">
            {" "}
            {/* Info Card */}
            <Card className="bg-cyan-50 border-cyan-200">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="shrink-0">
                    <div className="w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center">
                      <Info className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">
                      {t("courseManagement.browseByCategory")}
                    </h4>
                    <p className="text-sm text-gray-700">
                      {t("courseManagement.browseCategoryDescription")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div
              className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4"
              id="tag-list">
              {tags.map((tag) => (
                <Card
                  key={tag.id}
                  onClick={() => handleTagClick(tag)}
                  className="hover:shadow-md transition-shadow border border-gray-200 bg-white cursor-pointer group">
                  <CardHeader className="p-4 md:p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-12 h-12 bg-linear-to-br from-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center shrink-0">
                          <FolderOpen className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-gray-900 mb-1 truncate">
                            {tag.name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {tag.count_new_downloads_enabled}{" "}
                            {tag.count_new_downloads_enabled === 1
                              ? t("buttons.course")
                              : t("buttons.courses")}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-cyan-600 transition-colors shrink-0" />
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>)
        )}
      </div>
    </div>
  );
}
