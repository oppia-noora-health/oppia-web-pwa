import React from "react";
import { ModuleProgressCard } from "@/components/ModuleProgressCard";
import { useTranslation } from "@/hooks/useTranslation";

export interface CourseProgress {
  id: number;
  shortname: string;
  title: Record<string, string | null>;
  activitiesDone: number;
  totalActivities: number;
  percentageComplete: number;
  quizScore?: number;
}

interface ScoreboardTabProps {
  modules: CourseProgress[];
  loading: boolean;
  getLocalizedTitle: (
    titleObj: Record<string, string | null> | string | null | undefined
  ) => string;
}

export const ScoreboardTab: React.FC<ScoreboardTabProps> = ({
  modules,
  loading,
  getLocalizedTitle,
}) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="bg-white rounded-3xl shadow-sm p-6">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {t("course.noCourses")}
          </h2>
          <p className="text-gray-500 text-center">
            {t("gamification.startLearning")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">
        {t("course.progress")}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
        {modules
          .filter(
            (module) => module.activitiesDone > 0
          )
          .map((module, index) => (
            <ModuleProgressCard
              key={module.id}
              id={module.id}
              title={getLocalizedTitle(module.title)}
              activitiesDone={module.activitiesDone}
              totalActivities={module.totalActivities}
              percentageComplete={module.percentageComplete}
              delay={index * 100}
            />
          ))}
      </div>
    </div>
  );
};
