import React from "react";
import { ChevronDown, Lock, Unlock } from "lucide-react";
import { ActivityList } from "./ActivityList";
import type { Lesson } from "@/utils/lessonParser";
import { useTranslation } from "@/hooks/useTranslation";
import { isSectionUnlocked } from "@/utils/sectionPasswordStorage";

interface LessonCardProps {
  id?: string;
  lesson: Lesson;
  isExpanded: boolean;
  onToggle: () => void;
  onActivityClick: (activityId: string) => void;
  courseId: string;
}

export const LessonCard: React.FC<LessonCardProps> = ({
  id,
  lesson,
  isExpanded,
  onToggle,
  onActivityClick,
  courseId,
}) => {
  const { t } = useTranslation();
  
  // Check if section is unlocked
  const isUnlocked = lesson.password && lesson.title
    ? isSectionUnlocked(courseId, lesson.title)
    : false;

  return (
    <div
      id={id}
      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Lesson Header - Clickable */}
      <button
        onClick={onToggle}
        className="w-full px-4 md:px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
        <div className="flex-1 text-left">
          <h3 className="font-medium text-gray-900 mb-1 text-sm md:text-base">
            {lesson.title}
          </h3>
          <p className="text-xs md:text-sm text-gray-600">
            {lesson.activitiesCompleted}/{lesson.totalActivities}{" "}
            {t("course.activities")} {t("course.completedCourse").toLowerCase()}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lesson.password && (
            isUnlocked ? (
              <Unlock className="w-4 h-4 text-green-600" />
            ) : (
              <Lock className="w-4 h-4 text-gray-500" />
            )
          )}
          <ChevronDown
            className={`w-5 h-5 text-gray-400 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Lesson Content - Expandable */}
      {isExpanded && (
        <div className="border-t border-gray-200 px-4 md:px-6 py-4">
          <ActivityList
            activities={lesson.activities}
            onActivityClick={onActivityClick}
          />
        </div>
      )}
    </div>
  );
};
