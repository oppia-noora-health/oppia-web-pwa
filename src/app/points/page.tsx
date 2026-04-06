"use client";

import { useAuthStore } from "@/store/useStore";
import { useAuthenticatedApi } from "@/hooks/useAuthenticatedApi";
import { useRouter, usePathname } from "next/navigation";
import {
  cachePageWithDependencies,
  markPageAsVisitCached,
} from "@/utils/pageCaching";
import { useEffect, useState, useCallback } from "react";
import { Loading, PageLoading } from "@/components/Loading";
import { PointsHistoryChart } from "@/components/points/PointsHistoryChart";
import { RecentActivityList } from "@/components/points/RecentActivityList";
import { API_PATHS } from "@/utils/apiPaths";
import { BadgesList } from "@/components/points/BadgesList";
import { LeaderboardList } from "@/components/points/LeaderboardList";
import { UserPositionCard } from "@/components/points/UserPositionCard";
import { Award, AwardsApiResponse } from "@/types/badges";
import { useTranslation } from "@/hooks/useTranslation";
import { useTour } from "@/hooks/useTour";
import { getPointsTour } from "@/config/tourSteps";
import { useGamification } from "@/hooks/useGamification";
import { useScoreboardData } from "@/hooks/useScoreboardData";
import {
  fetchCourseStructure,
  StreamedCourseStructure,
} from "@/services/courseStreamingService";

type TabType = "points" | "leaderboard" | "badges";
type TimeFilter = "week" | "month" | "year";

interface LeaderboardUser {
  rank: number;
  name: string;
  phone: string;
  points: number;
}

interface ActivityLog {
  date: string;
  time: string;
  activity: string;
  points: number;
}

interface ChartData {
  day: number;
  points: number;
  status: "great" | "good" | "needs-work";
}

interface PointsApiResponse {
  meta: {
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total_count: number;
  };
  objects: {
    date: string;
    description: string;
    points: number;
    type: string;
  }[];
}

const EXCLUDED_RECENT_ACTIVITY_TYPES = new Set(["badgeawarded"]);

interface LeaderboardApiResponse {
  generated_date: string;
  server: string;
  leaderboard: {
    position: number;
    username: string;
    first_name: string;
    last_name: string;
    points: number;
    badges: number;
  }[];
}

export default function PointsPage() {
  const { user, isAuthenticated } = useAuthStore();
  const api = useAuthenticatedApi();
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<TabType>("points");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("week");
  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([]);
  const [chartData, setChartData] = useState<
    { date: string; description: string; points: number; type: string }[]
  >([]);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
  const [userPosition, setUserPosition] = useState(0);
  const [userPoints, setUserPoints] = useState(0);
  const [awards, setAwards] = useState<Award[]>([]);
  const [loadingBadges, setLoadingBadges] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const { t } = useTranslation();
  const { userPoints: gamificationPoints } = useGamification();

  // Use scoreboard data for chart (activity tracking)
  const { loading: scoreboardLoading, allActivitiesData } = useScoreboardData();
  const [loading, setLoading] = useState(false);

  // Calculate total points same as sidebar/navbar: user.points (from API) + gamificationPoints (local)
  const totalPoints = (user?.points || 0) + (gamificationPoints || 0);

  // Tour setup - Points page specific tour
  const { startTour, hasCompletedTour } = useTour("points-page");

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

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const tabs: TabType[] = ["points", "leaderboard", "badges"];

  // Cache for course structures (for chart data only)
  const [courseStructures, setCourseStructures] = useState<
    Map<string, StreamedCourseStructure>
  >(new Map());

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    const currentIndex = tabs.indexOf(activeTab);

    if (isLeftSwipe && currentIndex < tabs.length - 1) {
      // Swipe left - go to next tab
      setActiveTab(tabs[currentIndex + 1]);
    }

    if (isRightSwipe && currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1]);
    }
  };

  // Fetch recent activities from /points API
  useEffect(() => {
    const fetchPointsData = async () => {
      if (!api.isAuthenticated) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      setLoadingActivities(true);

      try {
        const response = await api.get<PointsApiResponse>(API_PATHS.POINTS());

        if (response && response.objects) {
          const visiblePoints = response.objects.filter(
            (point) => !EXCLUDED_RECENT_ACTIVITY_TYPES.has(point.type),
          );

          // Sort by date (latest first)
          const sortedPoints = [...visiblePoints].sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateB - dateA;
          });

          // Transform to ActivityLog format for recent activity list
          const activities: ActivityLog[] = sortedPoints.map((point) => {
            const dateObj = new Date(point.date);
            const dateStr = dateObj.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
            });
            const timeStr = dateObj.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            });

            return {
              date: dateStr,
              time: timeStr,
              activity: point.description,
              points: point.points,
            };
          });

          setRecentActivities(activities);
        }
      } catch (error) {
      } finally {
        setLoadingActivities(false);
      }
    };

    fetchPointsData();
  }, [api]);

  // Fetch and transform activity tracking + badges data for chart
  useEffect(() => {
    const fetchAndTransformActivitiesForChart = async () => {
      // Build activity-based chart records (from activity tracking API)
      let activityRecords: {
        date: string;
        description: string;
        points: number;
        type: string;
      }[] = [];

      if (allActivitiesData && allActivitiesData.size > 0) {
        // Collect all trackers from all courses
        const allTrackers: any[] = [];
        const courseShortnames = new Set<string>();

        allActivitiesData.forEach((trackers, coursename) => {
          allTrackers.push(...trackers);
          trackers.forEach((tracker) => {
            if (tracker.quiz?.course) {
              courseShortnames.add(tracker.quiz.course);
            }
          });
        });

        allTrackers.forEach((t, i) => {});

        // Fetch course structures for all courses
        try {
          const newStructures = new Map(courseStructures);
          let structuresFetched = false;

          for (const shortname of courseShortnames) {
            if (!newStructures.has(shortname)) {
              try {
                const structure = await fetchCourseStructure(shortname);
                newStructures.set(shortname, structure);
                structuresFetched = true;
              } catch (error) {}
            }
          }

          if (structuresFetched) {
            setCourseStructures(newStructures);
          }
        } catch (error) {}

        // Filter for completed activities
        const completedTrackers = allTrackers.filter(
          (tracker) => tracker.completed === "True",
        );

        completedTrackers.forEach((t, i) => {});

        activityRecords = completedTrackers.map((tracker) => {
          let eventType = "";
          let activityTitle = "";

          // Determine event type label
          if (tracker.event === "activity_completed") {
            eventType = "Activity Completed";
          } else if (tracker.event === "quiz_attempt") {
            eventType = "Quiz Attempted";
          } else if (tracker.event === "course_downloaded") {
            eventType = "Course Downloaded";
          } else {
            eventType = tracker.event.replace(/_/g, " ");
          }

          // Get actual activity title from course structure
          if (tracker.digest && courseStructures.size > 0) {
            for (const [shortname, structure] of courseStructures.entries()) {
              const section = structure.sections.find(
                (s) => s.digest === tracker.digest,
              );
              if (section) {
                activityTitle = section.title || "";
                break;
              }
            }
          }

          // Combine event type and activity title
          const fullActivityName = activityTitle
            ? `${eventType}: ${activityTitle}`
            : eventType;

          return {
            date: tracker.submitteddate,
            description: fullActivityName,
            points: parseInt(tracker.points) || 0,
            type: tracker.type,
          };
        });
      }

      // Sort activity records by date (UTC)
      const chartDataFormatted = activityRecords.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      setChartData(chartDataFormatted);

      chartDataFormatted.forEach((item, i) => {});

      // [points-graph-source] — where the graph points come from
      const graphSourceTotal = chartDataFormatted.reduce(
        (s, item) => s + item.points,
        0,
      );
      chartDataFormatted.forEach((item, i) => {});
    };

    fetchAndTransformActivitiesForChart();
  }, [allActivitiesData, courseStructures]);

  useEffect(() => {
    const fetchLeaderboardData = async () => {
      if (!api.isAuthenticated) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      // Get cohorts from user profile (stored in localStorage via Zustand persist)
      const userCohorts = user?.cohorts || [];

      // If no cohorts, fall back to regular leaderboard
      if (!userCohorts || userCohorts.length === 0) {
        const regularLeaderboardPath = API_PATHS.LEADERBOARD();
        try {
          const response = await api.get<LeaderboardApiResponse>(
            regularLeaderboardPath,
          );

          if (response) {
            // Transform leaderboard data
            const leaderboard: LeaderboardUser[] = response.leaderboard
              .slice(0, 20)
              .map((leaderboardUser) => ({
                rank: leaderboardUser.position,
                name: `${leaderboardUser.first_name} ${leaderboardUser.last_name}`.trim(),
                phone: leaderboardUser.username,
                points: leaderboardUser.points,
              }));

            setLeaderboardData(leaderboard);

            // Find user's position in the leaderboard
            const currentUser = user?.username;
            const userInLeaderboard = response.leaderboard.find(
              (u) => u.username === currentUser,
            );

            if (userInLeaderboard) {
              setUserPosition(userInLeaderboard.position);
              setUserPoints(userInLeaderboard.points);
            }
          }
        } catch (error) {}
        return;
      }

      // Use cohort-based leaderboard API
      try {
        const cohortApiPath = API_PATHS.LEADERBOARD_COHORT(userCohorts);

        const response = await api.get<LeaderboardApiResponse>(cohortApiPath);

        if (response) {
          // Transform leaderboard data
          const leaderboard: LeaderboardUser[] = response.leaderboard
            .slice(0, 20)
            .map((leaderboardUser) => ({
              rank: leaderboardUser.position,
              name: `${leaderboardUser.first_name} ${leaderboardUser.last_name}`.trim(),
              phone: leaderboardUser.username,
              points: leaderboardUser.points,
            }));

          setLeaderboardData(leaderboard);

          // Find user's position in the leaderboard
          const currentUser = user?.username;
          const userInLeaderboard = response.leaderboard.find(
            (u) => u.username === currentUser,
          );

          if (userInLeaderboard) {
            setUserPosition(userInLeaderboard.position);
            setUserPoints(userInLeaderboard.points);
          }
        }
      } catch (error) {}
    };

    const fetchBadgesData = async () => {
      if (!api.isAuthenticated) return;

      try {
        setLoadingBadges(true);
        const response = await api.get<AwardsApiResponse>(API_PATHS.AWARDS());

        if (response && response.objects) {
          setAwards(response.objects);
        }
      } catch (error) {
      } finally {
        setLoadingBadges(false);
      }
    };

    fetchLeaderboardData();
    fetchBadgesData();
  }, [api, user?.cohorts]);

  // Note: Auth redirect is handled by AuthProvider, no need to duplicate here

  // Auto-trigger tour for first-time visitors
  useEffect(() => {
    if (isAuthenticated && !scoreboardLoading && !hasCompletedTour()) {
      const timer = setTimeout(() => {
        const tourSteps = getPointsTour();
        startTour(tourSteps);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, scoreboardLoading, hasCompletedTour, startTour]);

  if (!user) {
    return <PageLoading />;
  }

  // Show loading while fetching scoreboard data
  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gray-50">
        {/* Tabs */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-center justify-around px-6">
            {(["points", "leaderboard", "badges"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-4 text-base transition-colors relative ${
                  activeTab === tab
                    ? "text-cyan-400 font-normal"
                    : "text-gray-500 font-normal"
                }`}>
                {tab === "points" && t("gamification.points")}
                {tab === "leaderboard" && t("gamification.leaderboard")}
                {tab === "badges" && t("gamification.badges")}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
                )}
              </button>
            ))}
          </div>
        </div>
        {/* Loading State */}
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-50">
      {/* Tabs */}
      <div
        id="points-tabs"
        className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-around px-6">
          {(["points", "leaderboard", "badges"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4  px-4 text-base transition-colors relative ${
                activeTab === tab
                  ? "text-cyan-400 font-normal"
                  : "text-gray-500 font-normal"
              }`}>
              {tab === "points" && t("gamification.points")}
              {tab === "leaderboard" && t("gamification.leaderboard")}
              {tab === "badges" && t("gamification.badges")}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content with swipe support */}
      <div
        id="points-page-content"
        className="px-6 py-6 max-w-7xl mx-auto"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}>
        {activeTab === "points" && (
          <>
            {/* Total Points Card */}
            {/* <div
              id="total-points"
              className="bg-[#37B7E6] rounded-3xl p-8 mb-6">
              <p className="text-white text-sm font-light mb-2">
                {t("gamification.totalPoints")}
              </p>
              <h1 className="text-white text-6xl  mb-3">{totalPoints}</h1>
              <p className="text-white text-sm font-light">
                {t("gamification.keepGoing")}
              </p>
            </div> */}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Points History Chart */}
              <PointsHistoryChart
                timeFilter={timeFilter}
                onTimeFilterChange={setTimeFilter}
                apiData={chartData}
                loading={scoreboardLoading}
              />
              {/* Recent Activity */}
              <RecentActivityList
                activities={recentActivities}
                loading={loadingActivities}
              />
            </div>
          </>
        )}

        {activeTab === "leaderboard" && (
          <>
            {/* Your Position Card */}
            <UserPositionCard position={userPosition} points={userPoints} />

            {/* Top Performers Section */}
            <LeaderboardList
              users={leaderboardData}
              currentUserPhone={user?.username}
            />
          </>
        )}

        {activeTab === "badges" && (
          <div className="space-y-6">
            {loadingBadges ? <PageLoading /> : <BadgesList awards={awards} />}
          </div>
        )}
      </div>
    </div>
  );
}
