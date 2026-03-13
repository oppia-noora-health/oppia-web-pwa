import React from "react";
import { ActivityLineChart } from "@/components/scoreboard/ActivityLineChart";
import { ActivityTracker } from "@/types/activityTracking";
import { useTranslation } from "@/hooks/useTranslation";

export type TimeFilter = "week" | "month" | "year";

interface ActivityTabProps {
  timeFilter: TimeFilter;
  onTimeFilterChange: (filter: TimeFilter) => void;
  activityLogData: any[];
  allActivitiesData: Map<string, ActivityTracker[]>;
}

export const ActivityTab: React.FC<ActivityTabProps> = ({
  timeFilter,
  onTimeFilterChange,
  activityLogData,
  allActivitiesData,
}) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      {/* Weekly Activity Chart */}
      <div className="bg-white rounded-3xl shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900">{t("pointsPage.activity")}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onTimeFilterChange("week")}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeFilter === "week"
                  ? "bg-cyan-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}>
              {t("pointsPage.week")}
            </button>
            <button
              onClick={() => onTimeFilterChange("month")}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeFilter === "month"
                  ? "bg-cyan-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}>
              {t("pointsPage.month")}
            </button>
            <button
              onClick={() => onTimeFilterChange("year")}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeFilter === "year"
                  ? "bg-cyan-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}>
              {t("pointsPage.year")}
            </button>
          </div>
        </div>

        {/* Chart with integrated vertical legend */}
        <div className="h-[600px] md:h-80 mb-6">
          <ActivityLineChart
            timeFilter={timeFilter}
            activityData={activityLogData}
            allActivitiesData={allActivitiesData}
          />
        </div>
      </div>
    </div>
  );
};
