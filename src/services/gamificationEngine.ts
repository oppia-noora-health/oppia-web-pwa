/**
 * Gamification Engine - Points Calculation Logic
 * Implements OppiaMobile gamification rules matching the reference table
 * Enhanced with full offline tracking and course metadata
 */

import {
  Tracker,
  TrackerType,
  QuizAttempt,
  MediaTracker,
  GAMIFICATION_EVENTS,
  UserPoints,
  TrackerMetadata,
  QuizResponseData,
} from "@/types/gamification";
import {
  saveTracker,
  isQuizFirstAttempt,
  isQuizFirstAttemptToday,
  isActivityFirstAttemptToday,
  saveQuizAttempt,
  updateUserPoints,
  getMediaTracker,
  saveMediaTracker,
  isResourceDownloaded,
  markResourceDownloaded,
  getQuizAttempts,
  isFeedbackFirstAttempt,
  isMediaStartedToday,
} from "@/utils/gamificationIDB";
import { activityTrackingService } from "@/services/activityTrackingService";
import { v4 as uuidv4 } from "uuid";
import { getAppInstanceId } from "./trackerSubmission";

/**
 * Generate tracker metadata for activity tracking
 */
function generateTrackerMetadata(
  timetaken: number,
  lang: string = "en",
  extraData?: Partial<TrackerMetadata>,
): TrackerMetadata {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : false;

  return {
    uuid: uuidv4(),
    timetaken,
    lang,
    appInstanceId: getAppInstanceId(),
    platform: "web",
    app_version: "1.0.0",
    netconnected: isOnline,
    // Device metadata fields (empty strings/defaults for web app)
    network: "", // Not available in web context
    battery: "", // Not available in web context
    manufacturermodel: "", // Not available in web context
    wifion: isOnline, // Approximate - assume WiFi if online
    readaloud: false, // Default to false
    ...extraData, // Extra data (like quiz_id, instance_id, score) will override defaults
  };
}

/**
 * Helper function to get previous quiz score for the same quiz
 * Returns the previous attempt's score or null if no previous attempt
 */
async function getPreviousQuizScore(
  userId: number,
  quizDigest: string,
  currentAttemptTime: string,
): Promise<number | null> {
  const attempts = await getQuizAttempts();

  // Filter attempts for same user and quiz, excluding current attempt
  const previousAttempts = attempts.filter(
    (attempt: QuizAttempt) =>
      attempt.userId === userId &&
      attempt.quizDigest === quizDigest &&
      attempt.submittedDate < currentAttemptTime,
  );

  if (previousAttempts.length === 0) {
    return null;
  }

  // Return the most recent previous score
  previousAttempts.sort(
    (a: QuizAttempt, b: QuizAttempt) =>
      new Date(b.submittedDate).getTime() - new Date(a.submittedDate).getTime(),
  );
  return previousAttempts[0].score;
}

/**
 * Course info interface for tracking functions
 */
interface CourseInfo {
  id: number;
  shortname: string;
  version?: number;
}

/**
 * Quiz Attempt Processing
 *
 * Rules (per spec):
 * - First attempt ever: 20 + score% + bonus (if ≥100%) = max 170 points
 * - First attempt today (not first ever): 10 points
 * - Repeated attempts same day: 0 points
 */
export async function processQuizAttempt(
  userId: number,
  courseId: number,
  quizDigest: string,
  score: number, // Raw score (number of correct answers), not percentage
  maxScore: number,
  courseShortname: string,
  timetaken: number = 0,
  courseVersion: number = 1,
  quizId?: number,
  responses: QuizResponseData[] = [],
  passThreshold: number = 80, // From quiz props.passthreshold; default 80%
): Promise<{ tracker: Tracker; quizAttempt: QuizAttempt }> {
  const now = new Date().toISOString();
  const instanceId = uuidv4();

  // Calculate score percentage: (correct answers / max score) × 100%
  const scorePercentage =
    maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const passed = scorePercentage >= passThreshold; // Use quiz's passthreshold

  let pointsEarned = 0;
  let eventType = "";

  // Check local IDB for first attempt
  const idbFirstEver = await isQuizFirstAttempt(userId, quizDigest);
  const idbFirstToday = await isQuizFirstAttemptToday(userId, quizDigest);

  // Also check activity API (streaming / server state) so first-attempt is consistent across devices
  let apiQuizAttempts: { submitteddate: string; passed?: boolean }[] = [];
  if (courseShortname) {
    try {
      const apiAttempts = await activityTrackingService.getQuizAttemptsByDigest(
        courseShortname,
        quizDigest,
      );
      apiQuizAttempts = apiAttempts.map((a) => ({
        submitteddate: a.submitteddate,
        passed: a.completed === "True" && (!a.quiz || a.quiz.passed === "True"),
      }));
    } catch {
      // Offline or API error: rely on IDB only
    }
  }

  const todayStr = new Date().toDateString();
  const apiAttemptsToday = apiQuizAttempts.filter(
    (a) => new Date(a.submitteddate).toDateString() === todayStr,
  );

  // First ever = no local IDB attempts AND no API attempts at all (regardless of pass/fail)
  const isFirstEver = idbFirstEver && apiQuizAttempts.length === 0;
  const isFirstToday = idbFirstToday && apiAttemptsToday.length === 0;

  if (isFirstEver) {
    // FIRST ATTEMPT EVER (Oppia spec):
    //   base 20 + Math.round(scorePercent) + bonus 50 (if perfect score)
    pointsEarned = GAMIFICATION_EVENTS.QUIZ_FIRST_ATTEMPT.points; // 20

    // Add rounded score percentage (only when score > 0%)
    if (scorePercentage > 0) {
      pointsEarned += Math.round(scorePercentage);
    }

    // Bonus check: scorePercentage >= threshold (default 99 from config)
    const threshold = GAMIFICATION_EVENTS.QUIZ_FIRST_ATTEMPT_THRESHOLD.points; // 99
    if (scorePercentage >= threshold) {
      pointsEarned += GAMIFICATION_EVENTS.QUIZ_FIRST_BONUS_100.points; // 50
      eventType = GAMIFICATION_EVENTS.QUIZ_FIRST_BONUS_100.event;
    } else {
      eventType = GAMIFICATION_EVENTS.QUIZ_FIRST_ATTEMPT.event;
    }
    // Examples: 0% → 20, 50% → 70, 85% → 105, 100% → 170
  } else if (isFirstToday) {
    // FIRST ATTEMPT TODAY (not first ever): flat 10 points, score irrelevant
    pointsEarned = GAMIFICATION_EVENTS.QUIZ_FIRST_ATTEMPT_TODAY.points; // 10
    eventType = GAMIFICATION_EVENTS.QUIZ_FIRST_ATTEMPT_TODAY.event;
  } else {
    // REPEATED ATTEMPT SAME DAY: 0 points
    pointsEarned = 0;
    eventType = GAMIFICATION_EVENTS.QUIZ_ATTEMPT.event;
  }

  // Create tracker with quiz data and full course info
  const tracker: Tracker = {
    id: uuidv4(),
    userId,
    courseId,
    courseShortname,
    courseVersion,
    type: "quiz" as TrackerType,
    digest: quizDigest,
    submittedDate: now,
    points: pointsEarned,
    event: eventType,
    completed: passed, // True if passed, False if failed
    data: generateTrackerMetadata(timetaken, "en", {
      quiz_id: quizId,
      instance_id: instanceId,
      score: scorePercentage,
    }),
    synced: false,
    quiz: {
      score,
      maxScore,
      passed,
      timetaken,
      course: courseShortname,
      responses,
    },
  };

  // Create quiz attempt record with full data for API submission
  const quizAttempt: QuizAttempt = {
    id: uuidv4(),
    userId,
    courseId,
    courseShortname,
    courseVersion,
    quizDigest,
    quizId,
    instanceId,
    score,
    maxScore,
    submittedDate: now,
    points: pointsEarned,
    timetaken,
    passed,
    responses,
    synced: false,
  };

  // Save to IndexedDB
  await saveTracker(tracker);
  await saveQuizAttempt(quizAttempt);
  await updateUserPoints(userId, pointsEarned);

  return { tracker, quizAttempt };
}

/**
 * Activity Completion Processing (Page/Section)
 *
 * Rules:
 * - 10 points for first completion of an activity each day
 * - 0 points for repeated completions same day
 * - Can earn again the next day
 */
export async function processActivityCompleted(
  userId: number,
  courseId: number,
  activityDigest: string,
  courseShortname: string = "",
  courseVersion: number = 1,
  timetaken: number = 0,
  lang: string = "en",
): Promise<Tracker> {
  let pointsEarned: number = GAMIFICATION_EVENTS.ACTIVITY_COMPLETED.points; // 10
  const eventType = GAMIFICATION_EVENTS.ACTIVITY_COMPLETED.event;

  // Check local IDB: only award once per day per activity
  // ⚠️ IDB is the source of truth for daily completion
  const isFirstToday = await isActivityFirstAttemptToday(
    userId,
    activityDigest,
  );

  if (!isFirstToday) {
    pointsEarned = 0;
  }

  // ⚠️ IMPORTANT: If IDB says first attempt today, award points!
  // Don't block with API check because:
  // 1. API shows lifetime completion (was completed EVER), not daily completion
  // 2. Activity may have been completed yesterday, but today is a new day
  // 3. IDB tracks daily completion and is more reliable
  // 4. API check should only verify we didn't somehow double-process TODAY

  // Only skip API check if IDB already said "not first today"
  const shouldSkipApiCheck = !isFirstToday || typeof window === "undefined";
  const isResetCourse =
    typeof window !== "undefined" &&
    localStorage.getItem(`course_reset_${courseId}`) === "true";

  if (!shouldSkipApiCheck && courseShortname && !isResetCourse) {
    try {
      const response =
        await activityTrackingService.getCourseActivityTracking(
          courseShortname,
        );

      // Find the tracker for this activity to check its submitteddate
      const activityTracker = response.trackers?.find(
        (t) => t.digest === activityDigest,
      );

      if (activityTracker && activityTracker.submitteddate) {
        // Parse the submitteddate to check if it's from today
        // Format: "2026-02-12 10:32:14" or "2026-03-03 10:32:14"
        const submittedDate = new Date(activityTracker.submitteddate);
        const todayDate = new Date();

        const submittedDateStr = submittedDate.toISOString().split("T")[0]; // YYYY-MM-DD
        const todayDateStr = todayDate.toISOString().split("T")[0]; // YYYY-MM-DD

        const isCompletedToday = submittedDateStr === todayDateStr;

        if (isCompletedToday) {
          pointsEarned = 0;
        }
      } else {
        // Keep pointsEarned = 10 (first completion ever)
      }
    } catch (error) {
      // Offline or API error: rely on IDB daily check
      console.log(
        `[⚠️ API-VERIFICATION] Could not verify with API, relying on IDB`,
        {
          error: (error as Error).message,
          pointsEarned,
        },
      );
      // Keep pointsEarned = 10 (IDB already checked and approved)
    }
  }

  const tracker: Tracker = {
    id: uuidv4(),
    userId,
    courseId,
    courseShortname,
    courseVersion,
    type: "page" as TrackerType,
    digest: activityDigest,
    submittedDate: new Date().toISOString(),
    points: pointsEarned,
    event: eventType,
    completed: true, // Page type always has completed=True
    data: generateTrackerMetadata(timetaken, lang),
    synced: false,
  };

  await saveTracker(tracker);
  await updateUserPoints(userId, pointsEarned);

  return tracker;
}

/**
 * Media Playback Processing (Video/Audio)
 *
 * Two modes (controlled by GAMIFICATION_MEDIA_CRITERIA constant):
 *
 * Threshold Mode (default):
 *   - 150 points for watching/listening ≥ threshold% of media
 *   - 0 points otherwise
 *
 * Interval Mode:
 *   - 30 points for each new interval of X seconds watched
 *   - Intervals are non-overlapping; only NEW intervals since last check earn points
 *   - No cap enforced here (compose with external limits if needed)
 */
export async function processMediaPlayback(
  userId: number,
  courseId: number,
  mediaDigest: string,
  duration: number,
  timeViewed: number,
  mediaType: "video" | "audio" = "video",
  courseShortname: string = "",
  courseVersion: number = 1,
  mediaFile: string = "",
): Promise<Tracker> {
  // Import constants at call time so config changes are picked up
  const {
    MEDIA_COMPLETION_METHOD_DEFAULT,
    MEDIA_THRESHOLD_PERCENTAGE_DEFAULT,
    MEDIA_INTERVAL_DURATION_DEFAULT,
    MEDIA_MAX_POINTS_DEFAULT,
  } = await import("@/config/constants");

  const mediaMethod = MEDIA_COMPLETION_METHOD_DEFAULT;
  const thresholdPct = MEDIA_THRESHOLD_PERCENTAGE_DEFAULT;
  const intervalDuration = MEDIA_INTERVAL_DURATION_DEFAULT;
  const maxMediaPoints = MEDIA_MAX_POINTS_DEFAULT;

  const existingTracker = await getMediaTracker(userId, mediaDigest);

  let pointsEarned = 0;
  let eventType = "";
  let newIntervalsCompleted = existingTracker?.intervalsCompleted ?? 0;

  const percentageWatched = duration > 0 ? (timeViewed / duration) * 100 : 0;

  if (mediaMethod === "intervals") {
    // ── Interval Mode ──

    // Award media_started points once per day
    const startedToday = await isMediaStartedToday(userId, mediaDigest);
    let startPoints = 0;
    if (!startedToday) {
      startPoints = GAMIFICATION_EVENTS.MEDIA_STARTED.points; // 20
    }

    const totalIntervals =
      intervalDuration > 0 ? Math.floor(timeViewed / intervalDuration) : 0;
    const previousIntervals = existingTracker?.intervalsCompleted ?? 0;
    const newIntervals = Math.max(0, totalIntervals - previousIntervals);

    // CRITICAL: Only award interval points if this is the first play today
    // This prevents multiple interval awards if user plays the same media multiple times same day
    let intervalPoints = 0;
    if (!startedToday && newIntervals > 0) {
      intervalPoints =
        newIntervals *
        GAMIFICATION_EVENTS.MEDIA_PLAYING_POINTS_PER_INTERVAL.points; // 10 per interval
    }
    const rawPoints = startPoints + intervalPoints;

    if (rawPoints > 0) {
      const existingPoints = existingTracker?.points ?? 0;
      // Cap at max media points (default 200)
      pointsEarned = Math.min(
        rawPoints,
        Math.max(0, maxMediaPoints - existingPoints),
      );
      if (pointsEarned > 0) {
        newIntervalsCompleted = totalIntervals;
        eventType =
          intervalPoints > 0
            ? GAMIFICATION_EVENTS.MEDIA_PLAYING_POINTS_PER_INTERVAL.event
            : GAMIFICATION_EVENTS.MEDIA_STARTED.event;
      }
    }
  } else {
    // ── Threshold Mode (default) ──
    if (percentageWatched >= thresholdPct) {
      // Check if already earned threshold points (once per lifetime per media file)
      if (!existingTracker || existingTracker.points === 0) {
        pointsEarned = GAMIFICATION_EVENTS.MEDIA_PLAYED.points; // 150
        eventType = GAMIFICATION_EVENTS.MEDIA_PLAYED.event; // "media_played"
      }
    }
  }

  if (pointsEarned === 0) {
    // Update local media tracker
    const mediaTracker: MediaTracker = {
      userId,
      mediaDigest,
      timeViewed,
      event:
        eventType || (mediaType === "audio" ? "in_progress" : "in_progress"),
      points: existingTracker?.points ?? 0,
      lastUpdated: new Date().toISOString(),
      intervalsCompleted: newIntervalsCompleted,
    };
    await saveMediaTracker(mediaTracker);

    // Always create a server-syncable Tracker even with 0 points
    // so repeat plays are recorded and synced to the backend.
    const mediaEndReached = percentageWatched >= thresholdPct;
    const zeroPointTracker: Tracker = {
      id: uuidv4(),
      userId,
      courseId,
      courseShortname,
      courseVersion,
      type: "media" as TrackerType,
      digest: mediaDigest,
      submittedDate: new Date().toISOString(),
      points: 0,
      event: eventType || "media_played",
      completed: false,
      data: generateTrackerMetadata(Math.round(timeViewed), "en", {
        mediafile: mediaFile,
        media: "played",
        media_end_reached: mediaEndReached,
        media_type: mediaType,
      }),
      synced: false,
    };
    await saveTracker(zeroPointTracker);

    return zeroPointTracker;
  }

  // Determine if media playback reached the end
  const mediaEndReached = percentageWatched >= thresholdPct;

  // Create tracker with points and full course info
  const tracker: Tracker = {
    id: uuidv4(),
    userId,
    courseId,
    courseShortname,
    courseVersion,
    type: "media" as TrackerType,
    digest: mediaDigest,
    submittedDate: new Date().toISOString(),
    points: pointsEarned,
    event: eventType,
    completed: pointsEarned > 0,
    data: generateTrackerMetadata(Math.round(timeViewed), "en", {
      mediafile: mediaFile,
      media: "played",
      media_end_reached: mediaEndReached,
      media_type: mediaType,
    }),
    synced: false,
  };

  // Update media tracker
  const mediaTracker: MediaTracker = {
    userId,
    mediaDigest,
    timeViewed,
    event: eventType,
    points: (existingTracker?.points ?? 0) + pointsEarned,
    lastUpdated: new Date().toISOString(),
    intervalsCompleted: newIntervalsCompleted,
  };

  await saveTracker(tracker);
  await saveMediaTracker(mediaTracker);
  await updateUserPoints(userId, pointsEarned);

  return tracker;
}

/**
 * Course Download Processing
 *
 * Rules (from reference table):
 * - 50 points for downloading a course
 * - One-time award per course
 */
export async function processCourseDownload(
  userId: number,
  courseId: number,
  courseShortname: string,
  courseVersion: number = 1,
): Promise<Tracker> {
  const pointsEarned = 50;
  const eventType = GAMIFICATION_EVENTS.COURSE_DOWNLOADED.event;

  // console.log(`📥 Course downloaded: ${pointsEarned} points`);

  const tracker: Tracker = {
    id: uuidv4(),
    userId,
    courseId,
    courseShortname,
    courseVersion,
    type: "download" as TrackerType,
    digest: "", // Empty digest for download trackers
    submittedDate: new Date().toISOString(),
    points: pointsEarned,
    event: eventType,
    completed: true, // Download type always completed=True
    data: generateTrackerMetadata(0, "en"),
    synced: false,
  };

  await saveTracker(tracker);
  await updateUserPoints(userId, pointsEarned);

  return tracker;
}

/**
 * Resource Download Processing
 *
 * Rules (DISABLED):
 * - 0 points for downloading resources (feature disabled)
 */
export async function processResourceDownload(
  userId: number,
  courseId: number,
  resourceDigest: string,
  courseShortname: string = "",
  courseVersion: number = 1,
): Promise<Tracker | null> {
  // Resource download points disabled - return null without awarding points
  return null;
}

/**
 * Feedback Submission Processing
 *
 * Rules:
 * - 50 points for first feedback submission ever (lifetime once per digest)
 * - 0 points for subsequent submissions of the same feedback
 */
export async function processFeedback(
  userId: number,
  courseId: number,
  feedbackDigest: string,
  courseShortname: string = "",
  courseVersion: number = 1,
  timetaken: number = 0,
): Promise<Tracker> {
  let pointsEarned: number = GAMIFICATION_EVENTS.FEEDBACK_COMPLETED.points; // 50
  const eventType = GAMIFICATION_EVENTS.FEEDBACK_COMPLETED.event;

  // Check local IDB: feedback is lifetime once per digest
  const isFirstFeedback = await isFeedbackFirstAttempt(userId, feedbackDigest);
  if (!isFirstFeedback) {
    pointsEarned = 0;
  }

  // Also check activity API when streaming to avoid double-award (already completed on server)
  if (pointsEarned > 0 && courseShortname) {
    try {
      const response =
        await activityTrackingService.getCourseActivityTracking(
          courseShortname,
        );
      const completionMap =
        activityTrackingService.createCompletionMap(response);
      if (completionMap.get(feedbackDigest)) {
        pointsEarned = 0;
      }
    } catch {
      // Offline or API error: rely on IDB lifetime check
    }
  }

  const tracker: Tracker = {
    id: uuidv4(),
    userId,
    courseId,
    courseShortname,
    courseVersion,
    type: "feedback" as TrackerType,
    digest: feedbackDigest,
    submittedDate: new Date().toISOString(),
    points: pointsEarned,
    event: eventType,
    completed: true, // Feedback type always completed=True
    data: generateTrackerMetadata(timetaken, "en"),
    synced: false,
  };

  await saveTracker(tracker);
  await updateUserPoints(userId, pointsEarned);

  return tracker;
}

/**
 * Search Tracker Processing
 * Tracks search queries (no points, for analytics only)
 */
export async function processSearch(
  userId: number,
  query: string,
  resultsCount: number,
): Promise<Tracker> {
  const tracker: Tracker = {
    id: uuidv4(),
    userId,
    courseId: 0,
    courseShortname: "",
    courseVersion: 0,
    type: "search" as TrackerType,
    digest: "",
    submittedDate: new Date().toISOString(),
    points: 0,
    event: GAMIFICATION_EVENTS.SEARCH_PERFORMED.event,
    completed: true,
    data: generateTrackerMetadata(0, "en", {
      query,
      results_count: resultsCount,
    }),
    synced: false,
  };

  await saveTracker(tracker);
  return tracker;
}

/**
 * Get user's current points from IndexedDB
 */
export async function getUserPoints(userId: number): Promise<UserPoints> {
  const db = await import("@/utils/gamificationIDB").then((m) =>
    m.openGamificationDB(),
  );

  const userPoints = await db.get("userPoints", userId);

  if (!userPoints) {
    return {
      userId,
      totalPoints: 0,
      badges: 0,
    };
  }

  return userPoints;
}
