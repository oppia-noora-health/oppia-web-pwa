"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";

interface ModuleProgressCardProps {
  id: number;
  title: string;
  activitiesDone: number;
  totalActivities: number;
  percentageComplete: number;
  delay?: number;
}

export function ModuleProgressCard({
  id,
  title,
  activitiesDone,
  totalActivities,
  percentageComplete,
  delay = 0,
}: ModuleProgressCardProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const handleClick = () => {
    router.push(`/course/${id}`);
  };

  return (
    <div
      onClick={handleClick}
      className="rounded-3xl p-2 md:p-8 bg-[#F9FAFB] border border-[#E5E7EB] flex flex-col items-center text-center shadow-sm cursor-pointer hover:shadow-md hover:border-cyan-400 transition-all duration-200">
      {/* Circular Progress */}
      <div className="relative w-20 h-20 mb-3 md:mb-6">
        <svg className="w-20 h-20 transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="40"
            cy="40"
            r="35"
            stroke="#E5E7EB"
            strokeWidth="7"
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx="40"
            cy="40"
            r="35"
            stroke="#37B7E6"
            strokeWidth="7"
            fill="none"
            strokeDasharray={`${
              (percentageComplete / 100) * 2 * Math.PI * 35
            } ${2 * Math.PI * 35}`}
            strokeLinecap="round"
          />
        </svg>
        {/* Percentage text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-gray-900 text-lg font-normal leading-7">
            {percentageComplete}%
          </span>
        </div>
      </div>

      {/* Module Info */}
      <div className="w-full">
        <p className="text-gray-900 text-sm font-normal mb-3">
          {t("scoreboard.activitiesDoneLabel")}
        </p>
        <p className="text-cyan-600 text-base font-normal mb-4">
          {activitiesDone}/{totalActivities}
        </p>
        <p className="text-gray-600 text-xs font-normal leading-relaxed">
          {title}
        </p>
      </div>
    </div>
  );
}
