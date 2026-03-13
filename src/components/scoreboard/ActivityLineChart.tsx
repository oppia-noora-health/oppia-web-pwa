"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useMemo, useState } from "react";
import { ActivityTracker } from "@/types/activityTracking";
import { useTranslation } from "@/hooks/useTranslation";

type TimeFilter = "week" | "month" | "year";

interface ActivityLineChartProps {
  timeFilter: TimeFilter;
  activityData: {
    date: string;
    type: string;
    completed_activities?: number;
    time_taken?: number;
  }[];
  allActivitiesData: Map<string, ActivityTracker[]>;
}

interface LineVisibility {
  allActivities: boolean;
  activityCompleted: boolean;
  mediaWatched: boolean;
  courseDownloaded: boolean;
  quizAttempt: boolean;
}

export function ActivityLineChart({
  timeFilter,
  activityData,
  allActivitiesData,
}: ActivityLineChartProps) {
  const { t } = useTranslation();
  const [lineVisibility, setLineVisibility] = useState<LineVisibility>({
    allActivities: true,
    activityCompleted: false,
    mediaWatched: false,
    courseDownloaded: false,
    quizAttempt: false,
  });

  const toggleLine = (key: keyof LineVisibility) => {
    setLineVisibility((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const legendItems = [
    {
      key: "allActivities" as keyof LineVisibility,
      label: t("scoreboard.allActivities"),
      color: "#EC4899",
    },
    {
      key: "activityCompleted" as keyof LineVisibility,
      label: t("scoreboard.activityCompleted"),
      color: "#F9A8D4",
    },
    {
      key: "mediaWatched" as keyof LineVisibility,
      label: t("scoreboard.mediaWatched"),
      color: "#FBBF24",
    },
    {
      key: "courseDownloaded" as keyof LineVisibility,
      label: t("scoreboard.courseDownloaded"),
      color: "#9CA3AF",
    },
    {
      key: "quizAttempt" as keyof LineVisibility,
      label: t("scoreboard.quizAttempt"),
      color: "#22D3EE",
    },
  ];

  // Process activity data into chart format
  const chartData = useMemo(() => {
    const now = new Date();
    const dataMap = new Map<
      string,
      { date: string; counts: Record<string, number> }
    >();

    // Initialize data points based on time filter
    if (timeFilter === "week") {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dayKey = date.toLocaleDateString("en-US", { weekday: "short" });
        const dateStr = date.toISOString().split("T")[0];

        dataMap.set(dateStr, {
          date: dayKey,
          counts: {
            allActivities: 0,
            activityCompleted: 0,
            mediaWatched: 0,
            courseDownloaded: 0,
            quizAttempt: 0,
          },
        });
      }
    } else if (timeFilter === "month") {
      // Last 30 days, show weekly
      for (let i = 3; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i * 7);
        const weekLabel = `Week ${4 - i}`;
        const dateStr = date.toISOString().split("T")[0];

        dataMap.set(dateStr, {
          date: weekLabel,
          counts: {
            allActivities: 0,
            activityCompleted: 0,
            mediaWatched: 0,
            courseDownloaded: 0,
            quizAttempt: 0,
          },
        });
      }
    } else if (timeFilter === "year") {
      // Last 12 months
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toLocaleDateString("en-US", { month: "short" });
        const dateStr = date.toISOString().split("T")[0];

        dataMap.set(dateStr, {
          date: monthKey,
          counts: {
            allActivities: 0,
            activityCompleted: 0,
            mediaWatched: 0,
            courseDownloaded: 0,
            quizAttempt: 0,
          },
        });
      }
    }

    // Process allActivitiesData - use this new data source instead
    // Convert Map to flat array of all trackers
    const allTrackers: ActivityTracker[] = [];
    allActivitiesData.forEach((trackers) => {
      allTrackers.push(...trackers);
    });

    allTrackers.forEach((tracker) => {
      // Parse the submitted date
      const activityDate = new Date(tracker.submitteddate);
      const dateStr = activityDate.toISOString().split("T")[0];

      // Find the appropriate bucket based on time filter
      let targetKey = "";

      if (timeFilter === "week") {
        // Match exact date
        targetKey = dateStr;
      } else if (timeFilter === "month") {
        // Find which week this falls into
        const daysDiff = Math.floor(
          (now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const weekIndex = Math.min(3, Math.floor(daysDiff / 7));
        const weekDate = new Date(now);
        weekDate.setDate(weekDate.getDate() - weekIndex * 7);
        targetKey = weekDate.toISOString().split("T")[0];
      } else if (timeFilter === "year") {
        // Find which month this falls into
        const monthKey = new Date(
          activityDate.getFullYear(),
          activityDate.getMonth(),
          1
        );
        targetKey = monthKey.toISOString().split("T")[0];
      }

      // Find the closest data point if exact match doesn't exist
      if (!dataMap.has(targetKey)) {
        let closestKey = "";
        let minDiff = Infinity;

        dataMap.forEach((_, key) => {
          const keyDate = new Date(key);
          const diff = Math.abs(activityDate.getTime() - keyDate.getTime());
          if (diff < minDiff) {
            minDiff = diff;
            closestKey = key;
          }
        });
        targetKey = closestKey;
      }

      if (targetKey && dataMap.has(targetKey)) {
        const point = dataMap.get(targetKey)!;

        // Increment all activities count
        point.counts.allActivities += 1;

        // Increment based on event type from the tracker
        if (tracker.event === "activity_completed") {
          point.counts.activityCompleted += 1;
        } else if (
          tracker.event === "media_played" ||
          tracker.event === "media_watched"
        ) {
          point.counts.mediaWatched += 1;
        } else if (tracker.event === "course_downloaded") {
          point.counts.courseDownloaded += 1;
        } else if (tracker.event === "quiz_attempt") {
          point.counts.quizAttempt += 1;
        }
      }
    });

    // Convert to chart format with all activity counts
    return Array.from(dataMap.values()).map((item) => ({
      date: item.date,
      allActivities: item.counts.allActivities,
      activityCompleted: item.counts.activityCompleted,
      mediaWatched: item.counts.mediaWatched,
      courseDownloaded: item.counts.courseDownloaded,
      quizAttempt: item.counts.quizAttempt,
    }));
  }, [timeFilter, allActivitiesData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
              <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.stroke }}>
              {legendItems.find((item) => item.key === entry.dataKey)?.label}:{" "}
              {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full flex flex-col md:flex-row gap-4">
      {/* Chart */}
      <div className="flex-1 min-h-[250px] md:min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              {legendItems.map((item) => (
                <linearGradient
                  key={item.key}
                  id={`gradient-${item.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1">
                  <stop offset="5%" stopColor={item.color} stopOpacity={0.3} />
                  <stop
                    offset="95%"
                    stopColor={item.color}
                    stopOpacity={0.05}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f0f0f0"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: "#9CA3AF", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#9CA3AF", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              domain={[0, "auto"]}
            />
            <Tooltip content={<CustomTooltip />} />
            {lineVisibility.allActivities && (
              <Area
                type="monotone"
                dataKey="allActivities"
                stroke="#EC4899"
                strokeWidth={2}
                fill="url(#gradient-allActivities)"
                dot={{ fill: "#EC4899", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            )}
            {lineVisibility.activityCompleted && (
              <Area
                type="monotone"
                dataKey="activityCompleted"
                stroke="#F9A8D4"
                strokeWidth={2}
                fill="url(#gradient-activityCompleted)"
                dot={{ fill: "#F9A8D4", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            )}
            {lineVisibility.mediaWatched && (
              <Area
                type="monotone"
                dataKey="mediaWatched"
                stroke="#FBBF24"
                strokeWidth={2}
                fill="url(#gradient-mediaWatched)"
                dot={{ fill: "#FBBF24", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            )}
            {lineVisibility.courseDownloaded && (
              <Area
                type="monotone"
                dataKey="courseDownloaded"
                stroke="#9CA3AF"
                strokeWidth={2}
                fill="url(#gradient-courseDownloaded)"
                dot={{ fill: "#9CA3AF", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            )}
            {lineVisibility.quizAttempt && (
              <Area
                type="monotone"
                dataKey="quizAttempt"
                stroke="#22D3EE"
                strokeWidth={2}
                fill="url(#gradient-quizAttempt)"
                dot={{ fill: "#22D3EE", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend - Below on mobile, side on desktop */}
      <div className="flex flex-col gap-2 md:min-w-40">
        {legendItems.map((item) => (
          <button
            key={item.key}
            onClick={() => toggleLine(item.key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all text-left ${
              lineVisibility[item.key]
                ? "bg-white"
                : "bg-transparent opacity-60 hover:opacity-100"
            }`}>
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{
                backgroundColor: lineVisibility[item.key]
                  ? item.color
                  : "#E5E7EB",
              }}></div>
            <span
              className={`text-xs ${
                lineVisibility[item.key] ? "text-gray-700" : "text-gray-400"
              }`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
