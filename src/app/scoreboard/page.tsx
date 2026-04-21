"use client";

import { useAuthStore } from "@/store/useStore";
import { usePathname } from "next/navigation";
import {
  cachePageWithDependencies,
  markPageAsVisitCached,
} from "@/utils/pageCaching";
import { useEffect, useState } from "react";
import { PageLoading } from "@/components/Loading";
import { QuizProgressView } from "@/components/QuizProgressView";
import {
  ScoreboardTabs,
  TabType,
} from "@/components/scoreboard/ScoreboardTabs";
import { ScoreboardTab } from "@/components/scoreboard/ScoreboardTab";
import { ActivityTab, TimeFilter } from "@/components/scoreboard/ActivityTab";
import { QuizzesTab } from "@/components/scoreboard/QuizzesTab";
import { useScoreboardData } from "@/hooks/useScoreboardData";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { useTranslation } from "@/hooks/useTranslation";
import { useTour } from "@/hooks/useTour";
import { getScoreboardTour } from "@/config/tourSteps";

export default function ScoreboardPage() {
  const { user, isAuthenticated } = useAuthStore();

  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("week");
  const [selectedCourseForQuiz, setSelectedCourseForQuiz] = useState<
    number | null
  >(null);
  const { t } = useTranslation();

  const {
    loading,
    modules,
    activityLogData,
    allActivitiesData,
    pretestDigests,
  } = useScoreboardData();

  const tabs: TabType[] = ["overview", "activity", "quizzes"];
  const swipeHandlers = useSwipeNavigation(tabs, activeTab, setActiveTab);

  // Tour setup - Scoreboard page specific tour
  const { startTour, hasCompletedTour } = useTour("scoreboard-page");

  // Note: Auth redirect is handled by AuthProvider, no need to duplicate here

  // Cache this page for offline access when user visits (so it shows when offline)
  useEffect(() => {
    if (isAuthenticated && typeof window !== "undefined" && navigator.onLine) {
      const url = `${window.location.origin}${pathname}`;
      cachePageWithDependencies(url)
        .then((ok) => {
          if (ok) markPageAsVisitCached(pathname);
        })
        .catch((err) => void 0);
    }
  }, [isAuthenticated, pathname]);

  // Auto-trigger tour for first-time visitors
  useEffect(() => {
    if (isAuthenticated && !loading && !hasCompletedTour()) {
      const timer = setTimeout(() => {
        const tourSteps = getScoreboardTour();
        startTour(tourSteps);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, loading, hasCompletedTour]);

  const getLocalizedTitle = (
    titleObj: Record<string, string | null> | string | null | undefined,
  ): string => {
    if (!titleObj) return "Unknown Course";
    if (typeof titleObj === "string") return titleObj;

    const preferredLanguages = ["en", "hi", "kn", "tel", "bn", "id", "ne"];
    for (const lang of preferredLanguages) {
      if (titleObj[lang]) return titleObj[lang] as string;
    }

    const values = Object.values(titleObj).filter((v) => v !== null);
    return values.length > 0 ? (values[0] as string) : "Unknown Course";
  };

  const getQuizDataForCourse = (courseId: number) => {
    const course = modules.find((m) => m.id === courseId);
    if (!course) {
      return null;
    }

    // Get activities for this course from the API data
    const courseActivities = allActivitiesData.get(course.shortname) || [];

    // Calculate quiz statistics from real data
    const quizActivities = courseActivities.filter((a) => a.type === "quiz");
    const passedQuizzes = quizActivities.filter(
      (a) => a.quiz?.passed === "True",
    ).length;
    const attemptedQuizzes = quizActivities.length;

    // Group activities by their digest prefix to identify lessons/sections
    // Activities typically have digests like "section1_page1", "section1_quiz1", etc.
    const lessonMap = new Map<
      string,
      { completed: number; total: number; title: string }
    >();

    courseActivities.forEach((activity) => {
      // Use first part of digest or type as lesson identifier
      const lessonKey = activity.type || "page";
      const existing = lessonMap.get(lessonKey) || {
        completed: 0,
        total: 0,
        title: lessonKey,
      };
      existing.total += 1;
      if (activity.completed === "True") {
        existing.completed += 1;
      }
      lessonMap.set(lessonKey, existing);
    });

    // Convert to lessons array for display
    const lessons = Array.from(lessonMap.entries()).map(([key, data]) => {
      const progress =
        data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
      const typeLabels: Record<string, string> = {
        page: t("scoreboard.pages"),
        quiz: t("scoreboard.quizzes"),
        feedback: t("scoreboard.feedback"),
        resource: t("scoreboard.resources"),
      };
      return {
        title: typeLabels[key] || key.charAt(0).toUpperCase() + key.slice(1),
        subtitle: `${data.completed}/${data.total} ${t(
          "scoreboard.completed",
        )}`,
        progress,
      };
    });

    return {
      courseTitle: getLocalizedTitle(course.title),
      activitiesCompleted: course.activitiesDone,
      totalActivities: course.totalActivities,
      quizzes: {
        preTest: 0, // Pre-test tracking would need specific identification in the API
        passed: passedQuizzes,
        attempted: attemptedQuizzes,
      },
      lessons:
        lessons.length > 0
          ? lessons
          : [
              {
                title: t("scoreboard.noActivities"),
                subtitle: t("scoreboard.startLearning"),
                progress: 0,
              },
            ],
    };
  };

  if (!user) {
    return <PageLoading />;
  }

  if (selectedCourseForQuiz !== null) {
    const quizData = getQuizDataForCourse(selectedCourseForQuiz);
    if (quizData) {
      return (
        <QuizProgressView
          {...quizData}
          onBack={() => setSelectedCourseForQuiz(null)}
        />
      );
    }
    // Course not found, reset selection (will re-render and show main view)
    setSelectedCourseForQuiz(null);
  }

  return (
    <div className="min-h-screen w-full bg-white">
      <ScoreboardTabs
        id="scorecard-tabs"
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div
        id="scorecard-page-content"
        className="max-w-7xl mx-auto px-6 py-6"
        onTouchStart={swipeHandlers.onTouchStart}
        onTouchMove={swipeHandlers.onTouchMove}
        onTouchEnd={swipeHandlers.onTouchEnd}>
        {activeTab === "overview" && (
          <ScoreboardTab
            modules={modules}
            loading={loading}
            getLocalizedTitle={getLocalizedTitle}
          />
        )}

        {activeTab === "activity" && (
          <ActivityTab
            timeFilter={timeFilter}
            onTimeFilterChange={setTimeFilter}
            activityLogData={activityLogData}
            allActivitiesData={allActivitiesData}
          />
        )}

        {activeTab === "quizzes" && (
          <QuizzesTab
            modules={modules}
            loading={loading}
            getLocalizedTitle={getLocalizedTitle}
            onCourseClick={setSelectedCourseForQuiz}
            allActivitiesData={allActivitiesData}
            pretestDigests={pretestDigests}
          />
        )}
      </div>
    </div>
  );
}
