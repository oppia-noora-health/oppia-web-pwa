"use client";

import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { InstalledCourse } from "@/hooks/useInstalledCourses";
import { getAllDownloadedCourses } from "@/utils/courseStorageIDB";
import { ChevronRight } from "lucide-react";

export function OfflinePageUnavailable() {
  const { t } = useTranslation();
  const router = useRouter();
  const [installedCourses, setInstalledCourses] = useState<InstalledCourse[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [showCourseList, setShowCourseList] = useState(false);

  // Load downloaded courses from IndexedDB on mount
  useEffect(() => {
    const loadCourses = async () => {
      try {
        const courses = await getAllDownloadedCourses();
        setInstalledCourses(courses);
        // Automatically show list if there are courses available
        if (courses.length > 0) {
          setShowCourseList(true);
        }
      } catch (err) {
        console.error("Failed to load offline courses:", err);
      } finally {
        setLoading(false);
      }
    };

    loadCourses();
  }, []);

  const handleCourseClick = (courseId: string) => {
    // Navigate directly to the course when offline
    router.push(`/course/${courseId}?from=offline&mode=offline`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="flex flex-col items-center justify-center max-w-md w-full">
        {/* Noora Logo - use img so it loads from cache/SW when offline */}
        <div className="relative w-24 h-24 md:w-28 md:h-28 mb-8 flex items-center justify-center">
          <img
            src="/logo/logo-icon.svg"
            alt="Noora Academy Logo"
            width={112}
            height={112}
            className="object-contain w-full h-full"
          />
        </div>
        <h1 className="text-xl font-semibold text-black mb-2">Noora</h1>

        {/* Message */}
        <p className="text-base md:text-lg text-gray-600 text-center mb-8">
          {t("offline.pageNotAvailableOffline")}
        </p>

        {/* Fallback button to course list */}
        {!loading && (
          <Link href="/course">
            <button
              type="button"
              className="bg-[#3ABFF8] hover:bg-[#2BA8DB] text-nowrap text-white font-medium text-sm md:text-base px-12 py-3 md:px-16 md:py-4 rounded-full shadow-lg w-full max-w-xs">
              {t("offline.viewDownloadedCourse")}
            </button>
          </Link>
        )}
      </div>
    </div>
  );
}
