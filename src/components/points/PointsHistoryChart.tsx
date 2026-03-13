"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
} from "recharts";
import { useMemo } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Loading } from "@/components/Loading";

type TimeFilter = "week" | "month" | "year";

interface ChartData {
  day: string | number;
  points: number;
  date?: Date;
}

interface PointsHistoryChartProps {
  timeFilter: TimeFilter;
  onTimeFilterChange: (filter: TimeFilter) => void;
  apiData: {
    date: string;
    description: string;
    points: number;
    type: string;
  }[];
  loading?: boolean;
  showHeader?: boolean;
}

const AREA_FILL = "#37B7E6";
const AREA_STROKE = "#37B7E6";

export function PointsHistoryChart({
  timeFilter,
  onTimeFilterChange,
  apiData,
  loading = false,
  showHeader = true,
}: PointsHistoryChartProps) {
  const { t } = useTranslation();

  if (apiData?.length) {
    apiData.forEach((item, i) => {});
  }

  // Generate chart data based on time filter. API dates are in UTC; we use UTC
  // boundaries for bucket start/end so grouping is consistent with the backend.
  const processedChartData = useMemo(() => {
    const now = new Date();
    const data: ChartData[] = [];

    const allPointsSum = apiData.reduce((s, item) => s + item.points, 0);

    // Helpers: UTC day/month boundaries (API dates are UTC)
    const utcDayStart = (y: number, m: number, d: number) =>
      new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
    const utcDayEnd = (y: number, m: number, d: number) =>
      new Date(Date.UTC(y, m, d, 23, 59, 59, 999));

    if (timeFilter === "week") {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setUTCDate(d.getUTCDate() - i);
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth();
        const day = d.getUTCDate();
        const dayStart = utcDayStart(y, m, day);
        const dayEnd = utcDayEnd(y, m, day);
        const dayName = d.toLocaleDateString("en-US", {
          weekday: "short",
          timeZone: "UTC",
        });

        const itemsInBucket = apiData.filter((item) => {
          const itemDate = new Date(item.date);
          return itemDate >= dayStart && itemDate <= dayEnd;
        });
        const dayPoints = itemsInBucket.reduce(
          (sum, item) => sum + item.points,
          0,
        );

        itemsInBucket.forEach((item, idx) => {});

        data.push({
          day: dayName,
          date: d,
          points: dayPoints,
        });
      }
      const weekTotal = data.reduce((s, b) => s + b.points, 0);
    } else if (timeFilter === "month") {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setUTCDate(d.getUTCDate() - i);
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth();
        const day = d.getUTCDate();
        const dayStart = utcDayStart(y, m, day);
        const dayEnd = utcDayEnd(y, m, day);
        const dayNum = d.getUTCDate();

        const itemsInBucket = apiData.filter((item) => {
          const itemDate = new Date(item.date);
          return itemDate >= dayStart && itemDate <= dayEnd;
        });
        const dayPoints = itemsInBucket.reduce(
          (sum, item) => sum + item.points,
          0,
        );

        if (itemsInBucket.length > 0) {
        }

        data.push({
          day: dayNum,
          date: d,
          points: dayPoints,
        });
      }
      const monthTotal = data.reduce((s, b) => s + b.points, 0);
    } else if (timeFilter === "year") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now);
        d.setUTCMonth(d.getUTCMonth() - i);
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth();
        const monthName = d.toLocaleDateString("en-US", {
          month: "short",
          timeZone: "UTC",
        });
        const monthStart = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
        const monthEnd = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));

        const itemsInBucket = apiData.filter((item) => {
          const itemDate = new Date(item.date);
          return itemDate >= monthStart && itemDate <= monthEnd;
        });
        const monthPoints = itemsInBucket.reduce(
          (sum, item) => sum + item.points,
          0,
        );

        if (itemsInBucket.length > 0) {
        }

        data.push({
          day: monthName,
          date: d,
          points: monthPoints,
        });
      }
      const yearTotal = data.reduce((s, b) => s + b.points, 0);
    }

    data.forEach((bucket, i) => {});

    return data;
  }, [timeFilter, apiData]);

  // Calculate date range string
  const dateRangeString = useMemo(() => {
    if (processedChartData.length < 2) return "";

    const firstDate = processedChartData[0].date;
    const lastDate = processedChartData[processedChartData.length - 1].date;

    if (!firstDate || !lastDate) return "";

    const formatDate = (date: Date) => {
      return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
    };

    return `${formatDate(firstDate)} - ${formatDate(lastDate)}`;
  }, [processedChartData]);

  // Calculate total points for the selected time period
  const totalPoints = useMemo(() => {
    return processedChartData.reduce((sum, item) => sum + item.points, 0);
  }, [processedChartData]);

  const timePeriodLabel = useMemo(() => {
    if (timeFilter === "week") return t("pointsPage.thisWeek");
    if (timeFilter === "month") return t("pointsPage.thisMonth");
    return t("pointsPage.thisYear");
  }, [timeFilter, t]);

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm">
      {showHeader !== false && (
        <div className="flex flex-col  justify-between mb-6">
          <h3 className="text-lg mr-auto mb-4 md:mb-6 hidden md:block text-black">
            {t("pointsPage.pointsHistory")}
          </h3>
          <div className="flex ml-auto overflow-x-auto scrollbar-hide gap-2">
            {[
              { key: "week" as const, label: t("pointsPage.week") },
              { key: "month" as const, label: t("pointsPage.month") },
              { key: "year" as const, label: t("pointsPage.year") },
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => onTimeFilterChange(filter.key)}
                className={`px-7 py-2 rounded-2xl cursor-pointer text-sm font-medium transition-colors ${
                  timeFilter === filter.key
                    ? "bg-[#37B7E6] text-white"
                    : "bg-none border border-[#DCDCDC] text-gray-600"
                }`}>
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Area Chart */}
      {loading ? (
        <div className="flex items-center justify-center h-72 mb-4">
          <Loading />
        </div>
      ) : (
        <div className="h-72 mb-4 py-2 pt-8 overflow-x-auto">
          <div className="min-w-[600px] md:min-w-0 h-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={processedChartData}
                margin={{ top: 20, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient
                    id="pointsAreaGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1">
                    <stop offset="0%" stopColor={AREA_FILL} stopOpacity={0.4} />
                    <stop
                      offset="100%"
                      stopColor={AREA_FILL}
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E5E7EB"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6B7280", fontSize: 12 }}
                  interval={timeFilter === "month" ? 2 : 0}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6B7280", fontSize: 12 }}
                  width={40}
                />
                <Area
                  type="monotone"
                  dataKey="points"
                  stroke={AREA_STROKE}
                  strokeWidth={2}
                  fill="url(#pointsAreaGradient)"
                  dot={{ fill: AREA_STROKE, strokeWidth: 2, r: 4 }}>
                  <LabelList
                    dataKey="points"
                    position="top"
                    formatter={(value: unknown) =>
                      Number(value) > 0 ? (value as string | number) : ""
                    }
                    style={{
                      fill: "#374151",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Date Range */}
      <div className="flex items-center justify-center gap-2 mb-4 text-sm text-gray-600">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span className="font-medium">{dateRangeString}</span>
      </div>

      {/* Total Points for Selected Period */}
      <div className="flex items-center justify-center bg-linear-to-br from-cyan-50 to-cyan-100 rounded-2xl p-4">
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-1">{timePeriodLabel}</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-bold text-cyan-600">
              {totalPoints}
            </span>
            <svg
              className="w-6 h-6 text-yellow-500"
              fill="currentColor"
              viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <p className="text-xs text-gray-500 mt-1">Total Points</p>
        </div>
      </div>
    </div>
  );
}
