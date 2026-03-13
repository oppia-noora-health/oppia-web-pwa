import React from "react";
import { useTranslation } from "@/hooks/useTranslation";

interface CourseModuleHeaderProps {
  title: string;
  totalActivities: number;
  totalLessons: number;
}

export const CourseModuleHeader: React.FC<CourseModuleHeaderProps> = ({
  title,
  totalActivities,
  totalLessons,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-gray-100 rounded-xl p-6 mb-6">
      <h1 className="text-xl md:text-2xl font-semibold text-gray-900 mb-2">
        {title}
      </h1>
      <p className="text-sm text-gray-600">
        {totalActivities} {t("course.activities")} • {totalLessons}{" "}
        {t("course.chapters")}
      </p>
    </div>
  );
};
