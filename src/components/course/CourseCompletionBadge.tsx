"use client";

import Image from "next/image";
import { useTranslation } from "@/hooks/useTranslation";

interface CourseCompletionBadgeProps {
  completedActivities: number;
  totalActivities: number;
}

// Get badge type based on completion percentage
const getBadgeInfo = (
  percentage: number
): { type: "none" | "silver" | "gold" | "diamond"; label: string } => {
  if (percentage >= 100) {
    return { type: "diamond", label: "Diamond Badge" };
  } else if (percentage >= 66) {
    return { type: "gold", label: "Gold Badge" };
  } else if (percentage >= 33) {
    return { type: "silver", label: "Silver Badge" };
  }
  return { type: "none", label: "" };
};

// Get badge image path
const getBadgeImagePath = (type: "silver" | "gold" | "diamond"): string => {
  switch (type) {
    case "diamond":
      return "/points/badges/daimond.svg";
    case "gold":
      return "/points/badges/gold.svg";
    case "silver":
      return "/points/badges/silver.svg";
    default:
      return "/points/badges/silver.svg";
  }
};

// Get badge heading color
const getBadgeColor = (type: "silver" | "gold" | "diamond"): string => {
  switch (type) {
    case "diamond":
      return "#4A5568";
    case "gold":
      return "#A65F00";
    case "silver":
      return "#4A5568";
    default:
      return "#4A5568";
  }
};

export const CourseCompletionBadge: React.FC<CourseCompletionBadgeProps> = ({
  completedActivities,
  totalActivities,
}) => {
  const { t } = useTranslation();

  const percentage =
    totalActivities > 0
      ? Math.round((completedActivities / totalActivities) * 100)
      : 0;

  const completedLabel = t("course.completed");
  const completedText =
    completedLabel === "course.completed" ? "completed" : completedLabel;

  const badgeInfo = getBadgeInfo(percentage);

  // Don't show badge if completion is less than 33%
  if (badgeInfo.type === "none") {
    return null;
  }

  const nextBadge =
    badgeInfo.type === "silver"
      ? { threshold: 66, label: "Gold" }
      : badgeInfo.type === "gold"
      ? { threshold: 100, label: "Diamond" }
      : null;

  const activitiesNeededForNext = nextBadge
    ? Math.ceil((nextBadge.threshold / 100) * totalActivities) -
      completedActivities
    : 0;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
      <div className="flex items-center gap-4">
        {/* Badge Icon */}
        <div className="shrink-0">
          <Image
            src={getBadgeImagePath(badgeInfo.type)}
            alt={badgeInfo.label}
            width={60}
            height={60}
            className="object-contain"
          />
        </div>

        {/* Badge Details */}
        <div className="flex-1 min-w-0">
          <h3
            className="text-lg font-semibold"
            style={{ color: getBadgeColor(badgeInfo.type) }}>
            {badgeInfo.label}
          </h3>
          <p className="text-sm text-gray-600">
            {percentage}% {completedText}
          </p>
          {nextBadge && activitiesNeededForNext > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {activitiesNeededForNext} more{" "}
              {activitiesNeededForNext === 1 ? "activity" : "activities"} for{" "}
              {nextBadge.label}
            </p>
          )}
        </div>

        {/* Progress indicator */}
        <div className="shrink-0 text-right">
          <span className="text-2xl font-bold text-gray-900">
            {percentage}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: `${percentage}%`,
              backgroundColor:
                badgeInfo.type === "diamond"
                  ? "#6B7280"
                  : badgeInfo.type === "gold"
                  ? "#F59E0B"
                  : "#9CA3AF",
            }}
          />
        </div>
        {/* Badge thresholds */}
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Silver (33%)</span>
          <span>Gold (66%)</span>
          <span>Diamond (100%)</span>
        </div>
      </div>
    </div>
  );
};
