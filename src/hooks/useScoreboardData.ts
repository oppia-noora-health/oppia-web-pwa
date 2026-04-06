import { useState, useEffect, useRef } from "react";
import { useAuthenticatedApi } from "@/hooks/useAuthenticatedApi";
import { API_PATHS } from "@/utils/apiPaths";
import { getApiUrl } from "@/config/constants";
import { CourseProgress } from "@/components/scoreboard/ScoreboardTab";
import { getAllCourses } from "@/services/courseService";
import { activityTrackingService } from "@/services/activityTrackingService";
import { ActivityTracker } from "@/types/activityTracking";
import { fetchCourseStructure } from "@/services/courseStreamingService";
import { isPreTestTitle } from "@/utils/preTestStorage";

interface ActivityStats {
  lessonsCompleted: number;
  studyTime: string;
  avgScore: number;
  totalPoints: number;
}

interface ApiPointsData {
  date: string;
  description: string;
  points: number;
  type: string;
}

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

interface CachedData {
  timestamp: number;
  courseProgress: CourseProgress[];
  activityStats: ActivityStats;
  apiPointsData: ApiPointsData[];
  activityLogData: any[];
  allActivitiesData: Map<string, ActivityTracker[]>;
  pretestDigests: Set<string>;
}

// In-memory cache
let scoreboardCache: CachedData | null = null;

export const useScoreboardData = () => {
  const api = useAuthenticatedApi();
  const [loading, setLoading] = useState(true); // Start with true to show loading initially
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([]);
  const [activityStats, setActivityStats] = useState<ActivityStats>({
    lessonsCompleted: 0,
    studyTime: "0h 0m",
    avgScore: 0,
    totalPoints: 0,
  });
  const [apiPointsData, setApiPointsData] = useState<ApiPointsData[]>([]);
  const [activityLogData, setActivityLogData] = useState<any[]>([]);
  const [allActivitiesData, setAllActivitiesData] = useState<
    Map<string, ActivityTracker[]>
  >(new Map());
  const [pretestDigests, setPretestDigests] = useState<Set<string>>(new Set());
  const hasFetched = useRef(false);

  useEffect(() => {
    const fetchAllData = async () => {
      if (!api.isAuthenticated) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setLoading(false);
        return;
      }

      // Check if we have valid cached data
      if (scoreboardCache) {
        const now = Date.now();
        const isCacheValid = now - scoreboardCache.timestamp < CACHE_DURATION;

        if (isCacheValid) {
          setCourseProgress(scoreboardCache.courseProgress);
          setActivityStats(scoreboardCache.activityStats);
          setApiPointsData(scoreboardCache.apiPointsData);
          setActivityLogData(scoreboardCache.activityLogData);
          setAllActivitiesData(scoreboardCache.allActivitiesData);
          setPretestDigests(scoreboardCache.pretestDigests);
          setLoading(false); // Set loading to false when using cache
          hasFetched.current = true; // Mark as fetched after using cache
          return;
        } else {
          scoreboardCache = null;
          hasFetched.current = false; // Reset flag to allow new fetch
        }
      }

      // Prevent duplicate fetches only if not using cache
      if (hasFetched.current) {
        return;
      }
      hasFetched.current = true;

      setLoading(true);

      let allCourses: any[] = [];
      const activityByCourse = new Map<
        string,
        { completed: number; total: number }
      >();
      const activitiesByShortname = new Map<string, ActivityTracker[]>();
      const collectedPretestDigests = new Set<string>();

      // Variables to store data for caching
      let progressData: CourseProgress[] = [];
      let totalPoints = 0;
      let studyTime = "0h 0m";
      let pointsData: ApiPointsData[] = [];
      let activityLog: any[] = [];

      try {
        // Fetch all courses and their activities
        const coursesResponse = await getAllCourses();

        if (coursesResponse.courses && coursesResponse.courses.length > 0) {
          allCourses = coursesResponse.courses;

          // Fetch activity tracking and course structure for each course
          for (const course of coursesResponse.courses) {
            try {
              // Fetch activity tracking
              const activityUrl =
                getApiUrl() + "course/" + course.shortname + "/activity";
              const trackingResponse =
                await activityTrackingService.getCourseActivityTracking(
                  course.shortname,
                );

              // Store all trackers for this course
              activitiesByShortname.set(
                course.shortname,
                trackingResponse.trackers,
              );

              // Use the same completion rules as the activity list (quiz must be passed)
              const completionMap =
                activityTrackingService.createCompletionMap(trackingResponse);
              const completedDigests = Array.from(completionMap.entries())
                .filter(([, completed]) => completed)
                .map(([digest]) => digest)
                .filter(Boolean);

              // Fetch course structure to get total and which digests belong to this course
              let totalActivities = completedDigests.length; // Fallback
              let completedActivities = completedDigests.length;

              try {
                const courseStructure = await fetchCourseStructure(
                  course.shortname,
                );

                // Collect pretest digests from meta sections
                courseStructure.sections.forEach((section) => {
                  if (
                    section.id.startsWith("meta_") &&
                    section.digest &&
                    isPreTestTitle(section.title)
                  ) {
                    collectedPretestDigests.add(section.digest);
                  }
                });

                // Filter sections the same way as in the view page (remove empty quizzes/feedback and meta activities like pre-test)
                const validSections = courseStructure.sections.filter(
                  (section) => {
                    // Exclude meta activities (pre-test, etc.)
                    if (section.id.startsWith("meta_")) {
                      return false;
                    }

                    // Keep non-quiz/feedback sections
                    if (
                      section.type !== "quiz" &&
                      section.type !== "feedback"
                    ) {
                      return true;
                    }

                    // For quiz/feedback, check if they have valid questions
                    const data = section.quizData || section.content;
                    const hasQuestions =
                      data?.questions && data.questions.length > 0;

                    return hasQuestions;
                  },
                );

                totalActivities = validSections.length;
                // Only count as completed activities that exist in current course structure
                // (avoids showing more completed than total when trackers reference old digests)
                const structureDigests = new Set(
                  validSections.map((s) => s.digest).filter(Boolean),
                );
                completedActivities = completedDigests.filter((digest) =>
                  structureDigests.has(digest),
                ).length;
              } catch (structureError) {}

              activityByCourse.set(course.shortname, {
                completed: completedActivities,
                total: totalActivities,
              });
            } catch (error) {}
          }

          // Set the activities map
          setAllActivitiesData(activitiesByShortname);
          setPretestDigests(collectedPretestDigests);

          const totalTrackers = Array.from(
            activitiesByShortname.values(),
          ).reduce((sum, arr) => sum + arr.length, 0);
          activitiesByShortname.forEach((trackers, coursename) => {
            trackers.forEach((t, idx) => {});
          });
        }
      } catch (error: any) {
        setLoading(false);
        return;
      }

      // Create course progress data from activity tracking
      if (allCourses.length > 0) {
        progressData = allCourses.map((course: any) => {
          // Get activity stats from our tracking data
          const activityStats = activityByCourse.get(course.shortname);

          const activitiesDone = activityStats?.completed ?? 0;
          const totalActivities = activityStats?.total ?? 0;

          const percentageComplete =
            totalActivities > 0
              ? Math.round((activitiesDone / totalActivities) * 100)
              : 0;

          return {
            id: course.id,
            shortname: course.shortname,
            title: course.title,
            activitiesDone,
            totalActivities,
            percentageComplete,
            quizScore: 0,
          };
        });

        setCourseProgress(progressData);

        const totalLessons = progressData.reduce(
          (sum, course) => sum + course.activitiesDone,
          0,
        );

        setActivityStats((prev) => ({
          ...prev,
          lessonsCompleted: totalLessons,
        }));
      }

      try {
        // Fetch points data
        const pointsResponse = await api.get(API_PATHS.POINTS());
        if (pointsResponse && pointsResponse.objects) {
          pointsData = pointsResponse.objects;
          setApiPointsData(pointsData);
          totalPoints = pointsData.reduce(
            (sum: number, item: any) => sum + item.points,
            0,
          );
          setActivityStats((prev) => ({
            ...prev,
            totalPoints: totalPoints,
          }));
        }
      } catch (error: any) {}

      try {
        // Fetch activity log
        const activityResponse = await api.get(API_PATHS.ACTIVITYLOG());
        if (activityResponse && activityResponse.objects) {
          activityLog = activityResponse.objects;
          setActivityLogData(activityLog);
          const totalMinutes = activityLog.reduce(
            (sum: number, item: any) => sum + (item.time_taken || 0),
            0,
          );
          const hours = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;
          studyTime = `${hours}h ${minutes}m`;
          setActivityStats((prev) => ({
            ...prev,
            studyTime: studyTime,
          }));
        }
      } catch (error: any) {}

      // Cache the fetched data
      scoreboardCache = {
        timestamp: Date.now(),
        courseProgress: progressData,
        activityStats: {
          lessonsCompleted: progressData.reduce(
            (sum, c) => sum + c.activitiesDone,
            0,
          ),
          studyTime: studyTime,
          avgScore: 0,
          totalPoints: totalPoints,
        },
        apiPointsData: pointsData,
        activityLogData: activityLog,
        allActivitiesData: activitiesByShortname,
        pretestDigests: collectedPretestDigests,
      };
    };

    fetchAllData()
      .catch((err) => {})
      .finally(() => {
        setLoading(false);
      });

    // Cleanup function to reset fetch flag when component unmounts
    return () => {
      hasFetched.current = false;
    };
  }, [api]);

  return {
    loading,
    modules: courseProgress,
    activityStats,
    apiPointsData,
    activityLogData,
    allActivitiesData,
    pretestDigests,
  };
};
