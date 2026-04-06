import React from "react";
import { QuizAttemptCard } from "@/components/scoreboard/QuizAttemptCard";
import { ActivityTracker } from "@/types/activityTracking";
import { FileQuestion } from "lucide-react";
import { CourseProgress } from "./ScoreboardTab";
import { useTranslation } from "@/hooks/useTranslation";

interface QuizzesTabProps {
  modules: CourseProgress[];
  loading: boolean;
  getLocalizedTitle: (
    titleObj: Record<string, string | null> | string | null | undefined,
  ) => string;
  onCourseClick: (courseId: number) => void;
  allActivitiesData?: Map<string, ActivityTracker[]>;
  pretestDigests?: Set<string>;
}

export const QuizzesTab: React.FC<QuizzesTabProps> = ({
  modules,
  loading,
  getLocalizedTitle,
  allActivitiesData,
  pretestDigests,
}) => {
  // Extract all quiz attempts from activity data
  const quizAttempts: Array<{
    quizAttempt: ActivityTracker;
    courseShortname: string;
  }> = [];

  if (allActivitiesData) {
    allActivitiesData.forEach((trackers, shortname) => {
      trackers.forEach((tracker) => {
        if (tracker.type === "quiz" && tracker.quiz) {
          // Filter out pretest quizzes by comparing digest
          if (pretestDigests && pretestDigests.has(tracker.digest)) {
            return;
          }

          quizAttempts.push({
            quizAttempt: tracker,
            courseShortname: shortname,
          });
        }
      });
    });
  }

  // Sort by submission date (newest first)
  quizAttempts.sort((a, b) => {
    const dateA = new Date(a.quizAttempt.quiz?.submitteddate || "");
    const dateB = new Date(b.quizAttempt.quiz?.submitteddate || "");
    return dateB.getTime() - dateA.getTime();
  });

  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  if (quizAttempts.length === 0) {
    return (
      <div className="bg-white rounded-3xl shadow-sm p-6">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <FileQuestion className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {t("scoreboard.noQuizAttemptsTitle")}
          </h2>
          <p className="text-gray-500 text-center">
            {t("scoreboard.noQuizAttemptsDescription")}
          </p>
        </div>
      </div>
    );
  }

  // Get course title from modules by shortname
  const getCourseTitle = (shortname: string): string => {
    const course = modules.find((m) => m.shortname === shortname);
    if (course) {
      return getLocalizedTitle(course.title);
    }
    return shortname;
  };

  return (
    <div className="space-y-6">
      {/* <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Quiz Attempts 
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Your quiz submission history
        </p>
      </div> */}

      <div className="space-y-3">
        {quizAttempts.map((attempt, index) => (
          <QuizAttemptCard
            key={`${attempt.courseShortname}-${attempt.quizAttempt.digest}-${index}`}
            quizAttempt={attempt.quizAttempt.quiz!}
            courseTitle={getCourseTitle(attempt.courseShortname)}
            activityTitle={attempt.quizAttempt.event}
          />
        ))}
      </div>
    </div>
  );
};
