"use client";

import { useEffect, useState, useRef } from "react";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { activityTrackingService } from "@/services/activityTrackingService";
import { getQuizAttemptsByDigest } from "@/utils/gamificationIDB";
import { useAuthStore } from "@/store/useStore";
import FeedbackIframe from "@/components/FeedbackIframe";

interface QuizAttempt {
  score: number;
  maxScore: number;
  passed: boolean;
  submittedDate: string;
  timeTaken: number;
  instanceId?: string; // Optional: unique instance ID for better deduplication
}

interface QuizResultQuestion {
  questionNumber: number;
  questionText: string;
  isCorrect: boolean;
  userAnswer: string;
  /** When present, used for display: correct = green + tick, incorrect = red + X, partial = orange + !, essay = neutral (no points/right/wrong). */
  feedbackType?: "correct" | "incorrect" | "partial" | "essay";
  /** Optional feedback HTML (used when showfeedback=1 and HTML was fetched). */
  feedbackHtml?: string;
}

interface QuizResultsScreenProps {
  score: number;
  maxScore: number;
  passed: boolean;
  passThreshold: number;
  maxAttempts: string | number;
  currentAttempt: QuizAttempt; // Current attempt data
  quizDigest: string; // Quiz digest to fetch history
  courseShortname?: string; // Course shortname for API call
  questions: QuizResultQuestion[];
  onRetake: () => void;
  onContinue: () => void;
  isPreTest?: boolean;
  /** From quiz props.showfeedback: 0 = hide right/wrong per question, 2 = show. 1 and 3 not used for now. */
  showFeedback?: string | number;
}

export default function QuizResultsScreen({
  score,
  maxScore,
  passed,
  passThreshold,
  maxAttempts,
  currentAttempt,
  quizDigest,
  courseShortname,
  questions,
  onRetake,
  onContinue,
  isPreTest = false,
  showFeedback,
}: QuizResultsScreenProps) {
  // showfeedback 2 = show which questions are right/wrong; 1 = show per-question feedback HTML on results; 0 = only percentage, attempts, etc.
  const showQuestionFeedback =
    showFeedback === "2" ||
    showFeedback === 2 ||
    showFeedback === "1" ||
    showFeedback === 1;
  const user = useAuthStore((state) => state.user);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([currentAttempt]);
  const [loading, setLoading] = useState(true);

  // Ref to track if we've already fetched attempts (prevents re-fetching on re-renders)
  const hasFetchedRef = useRef(false);
  // Ref to store the current attempt digest to detect changes
  const currentAttemptRef = useRef<string | null>(null);
  // Ref to track previous attempt count to prevent duplicate counting
  const previousAttemptCountRef = useRef<number>(0);
  // Ref to track last processed digest to prevent re-processing same attempt
  const lastProcessedDigestRef = useRef<string | null>(null);
  // Ref to store retake debug info for inspection
  const retakeDebugRef = useRef<{ show: boolean; reasons: string[] } | null>(
    null,
  );

  // Create a stable digest for the current attempt to detect actual changes
  // Round date to nearest second to prevent useEffect from running on every millisecond change
  const currentAttemptDateRounded = new Date(
    Math.floor(new Date(currentAttempt.submittedDate).getTime() / 1000) * 1000,
  ).toISOString();
  const currentAttemptDigest = `${currentAttempt.score}-${currentAttempt.maxScore}-${currentAttemptDateRounded}`;

  // Fetch historical attempts from API or IndexedDB (only once per quiz digest)
  useEffect(() => {
    // Skip if we've already fetched for this quiz digest AND currentAttemptDigest hasn't changed
    if (hasFetchedRef.current && currentAttemptRef.current === quizDigest) {
      // Only process if current attempt digest actually changed (not just milliseconds)
      if (lastProcessedDigestRef.current === currentAttemptDigest) {
        // Same digest, skip processing
        return;
      }
      // Digest changed, update ref but still skip full fetch (will be handled by dependency change)
      lastProcessedDigestRef.current = currentAttemptDigest;
      return;
    }

    const fetchAttempts = async () => {
      // Mark as fetched for this quiz digest
      hasFetchedRef.current = true;
      currentAttemptRef.current = quizDigest;

      let apiAttempts: QuizAttempt[] = [];
      let localAttempts: QuizAttempt[] = [];

      // Try API first (source of truth for synced attempts)
      if (courseShortname) {
        try {
          const apiAttemptsRaw =
            await activityTrackingService.getQuizAttemptsByDigest(
              courseShortname,
              quizDigest,
            );

          // Convert API format to QuizAttempt format
          // Note: API XML doesn't include instance_id, so we'll use composite key for deduplication
          apiAttempts = apiAttemptsRaw.map((tracker) => {
            // Normalize API date format (may be "YYYY-MM-DD HH:MM:SS" without timezone)
            let normalizedDate = tracker.submitteddate;
            // If date doesn't have timezone info, assume UTC and convert to ISO
            if (
              normalizedDate &&
              !normalizedDate.includes("T") &&
              !normalizedDate.includes("Z")
            ) {
              // Format: "2026-02-05 12:40:52" -> "2026-02-05T12:40:52Z"
              normalizedDate = normalizedDate.replace(" ", "T") + "Z";
            }

            return {
              score: parseFloat(tracker.quiz?.score || "0"),
              maxScore: parseFloat(tracker.quiz?.maxscore || "1"),
              passed: tracker.quiz?.passed === "True",
              submittedDate: normalizedDate,
              timeTaken: parseInt(tracker.quiz?.timetaken || "0"),
              // instanceId not available from API XML response
            };
          });
        } catch (error) {}
      }

      // Always check IndexedDB (not just fallback) to get unsynced attempts
      if (user?.id != null) {
        try {
          const localAttemptsRaw = await getQuizAttemptsByDigest(
            Number(user.id),
            quizDigest,
          );

          localAttempts = localAttemptsRaw.map((attempt) => ({
            score: attempt.score,
            maxScore: attempt.maxScore,
            passed: attempt.passed,
            submittedDate: attempt.submittedDate,
            timeTaken: attempt.timetaken,
            instanceId: attempt.instanceId, // Include instanceId from IndexedDB
          }));
        } catch (error) {}
      }

      // Merge API and IndexedDB attempts, deduplicating by a composite key
      // Use a Map to deduplicate: key = combination of score, maxScore, and date (rounded to second)
      // Prefer API data if both sources have the same key (API is source of truth)
      const attemptsMap = new Map<string, QuizAttempt>();

      // Helper function to create a deduplication key
      // Uses score + maxScore + date rounded to nearest second to handle timestamp differences
      const getDedupKey = (attempt: QuizAttempt): string => {
        // Round date to nearest second to handle millisecond differences
        const date = new Date(attempt.submittedDate);
        const roundedDate = new Date(
          Math.floor(date.getTime() / 1000) * 1000,
        ).toISOString();
        // Use instanceId if available (most reliable), otherwise use composite key
        if (attempt.instanceId) {
          return attempt.instanceId;
        }
        // Fallback: score + maxScore + rounded date
        return `${attempt.score}-${attempt.maxScore}-${roundedDate}`;
      };

      // Add IndexedDB attempts first (they may include unsynced attempts)
      localAttempts.forEach((attempt) => {
        const key = getDedupKey(attempt);

        // Check if this attempt already exists by composite key (handles API attempts that don't have instanceId)
        // Normalize date to UTC and round to nearest second for comparison
        const attemptDate = new Date(attempt.submittedDate);
        const attemptDateRounded = new Date(
          Math.floor(attemptDate.getTime() / 1000) * 1000,
        );
        const compositeKey = `${attempt.score}-${attempt.maxScore}-${attemptDateRounded.toISOString()}`;
        let existingKey: string | null = null;

        // Check if any existing attempt matches by composite key (handles precision differences)
        for (const [mapKey, mapAttempt] of attemptsMap.entries()) {
          const mapDate = new Date(mapAttempt.submittedDate);
          const mapDateRounded = new Date(
            Math.floor(mapDate.getTime() / 1000) * 1000,
          );
          const mapCompositeKey = `${mapAttempt.score}-${mapAttempt.maxScore}-${mapDateRounded.toISOString()}`;

          // Check exact composite key match OR score/date match with tolerance
          const scoreMatch = Math.abs(mapAttempt.score - attempt.score) < 0.01;
          const maxScoreMatch = mapAttempt.maxScore === attempt.maxScore;
          // Compare rounded dates (within 2 seconds tolerance to handle timezone/format differences)
          const dateDiff = Math.abs(
            mapDateRounded.getTime() - attemptDateRounded.getTime(),
          );
          const dateMatch = dateDiff < 10000; // 10 seconds tolerance

          const matches =
            mapCompositeKey === compositeKey ||
            (scoreMatch && maxScoreMatch && dateMatch);

          if (matches) {
            existingKey = mapKey;
            break;
          }
        }

        if (existingKey) {
          // Overwrite with IndexedDB version (has instanceId, more complete)
          attemptsMap.set(existingKey, attempt);
        } else {
          attemptsMap.set(key, attempt);
        }
      });

      // Add API attempts (will overwrite IndexedDB entries with same key, but check for duplicates first)
      apiAttempts.forEach((attempt) => {
        const key = getDedupKey(attempt);

        // Check if this attempt already exists by composite key (handles IndexedDB attempts with instanceId)
        // Normalize date to UTC and round to nearest second for comparison
        const attemptDate = new Date(attempt.submittedDate);
        const attemptDateRounded = new Date(
          Math.floor(attemptDate.getTime() / 1000) * 1000,
        );
        const compositeKey = `${attempt.score}-${attempt.maxScore}-${attemptDateRounded.toISOString()}`;
        let existingKey: string | null = null;

        // Check if any existing attempt matches by composite key (handles precision differences)
        for (const [mapKey, mapAttempt] of attemptsMap.entries()) {
          const mapDate = new Date(mapAttempt.submittedDate);
          const mapDateRounded = new Date(
            Math.floor(mapDate.getTime() / 1000) * 1000,
          );
          const mapCompositeKey = `${mapAttempt.score}-${mapAttempt.maxScore}-${mapDateRounded.toISOString()}`;

          // Check exact composite key match OR score/date match with tolerance
          const scoreMatch = Math.abs(mapAttempt.score - attempt.score) < 0.01;
          const maxScoreMatch = mapAttempt.maxScore === attempt.maxScore;
          // Compare rounded dates (within 2 seconds tolerance to handle timezone/format differences)
          const dateDiff = Math.abs(
            mapDateRounded.getTime() - attemptDateRounded.getTime(),
          );
          const dateMatch = dateDiff < 10000; // 10 seconds tolerance

          const matches =
            mapCompositeKey === compositeKey ||
            (scoreMatch && maxScoreMatch && dateMatch);

          if (matches) {
            existingKey = mapKey;
            break;
          }
        }

        if (existingKey) {
          // Keep existing (IndexedDB version is preferred as it has instanceId)
          // Don't overwrite
        } else {
          attemptsMap.set(key, attempt);
        }
      });

      // Ensure current attempt is included (may not be synced yet)
      // Use the same deduplication key logic to check if it already exists
      const currentAttemptKey = getDedupKey(currentAttempt);

      // Check if current attempt already exists by key OR by matching composite key
      // (handles case where IndexedDB attempt has instanceId but currentAttempt doesn't)
      let alreadyExists = attemptsMap.has(currentAttemptKey);

      // If not found by key, check if any existing attempt matches by composite key
      // This handles the case where IndexedDB attempt uses instanceId as key but currentAttempt doesn't have instanceId
      if (!alreadyExists) {
        const currentDate = new Date(currentAttempt.submittedDate);
        const currentDateRounded = new Date(
          Math.floor(currentDate.getTime() / 1000) * 1000,
        );
        const currentCompositeKey = `${currentAttempt.score}-${currentAttempt.maxScore}-${currentDateRounded.toISOString()}`;

        // Check ALL attempts in the map - some may use instanceId as key, so we need to compare by composite key
        // Also handle score precision differences (e.g., 2.3333 vs 2.33)
        alreadyExists = Array.from(attemptsMap.values()).some((attempt) => {
          // Generate composite key for comparison (same logic as getDedupKey fallback)
          const attemptDate = new Date(attempt.submittedDate);
          const attemptDateRounded = new Date(
            Math.floor(attemptDate.getTime() / 1000) * 1000,
          );
          const attemptCompositeKey = `${attempt.score}-${attempt.maxScore}-${attemptDateRounded.toISOString()}`;

          // Check exact match OR score/date match with tolerance
          const scoreMatch =
            Math.abs(attempt.score - currentAttempt.score) < 0.01;
          const maxScoreMatch = attempt.maxScore === currentAttempt.maxScore;
          // Compare rounded dates (within 2 seconds tolerance to handle timezone/format differences)
          const dateDiff = Math.abs(
            attemptDateRounded.getTime() - currentDateRounded.getTime(),
          );
          const dateMatch = dateDiff < 10000; // 10 seconds tolerance

          const matches =
            attemptCompositeKey === currentCompositeKey ||
            (scoreMatch && maxScoreMatch && dateMatch);

          return matches;
        });
      }

      if (!alreadyExists) {
        attemptsMap.set(currentAttemptKey, currentAttempt);
      }

      // Convert map to array
      let allAttempts = Array.from(attemptsMap.values());

      // Additional deduplication pass: Remove any duplicates that might have slipped through
      // Compare by score, maxScore, and date (within 2 seconds tolerance)
      const deduplicatedAttempts: QuizAttempt[] = [];
      const seenKeys = new Set<string>();

      for (const attempt of allAttempts) {
        const key = getDedupKey(attempt);
        // Also check composite key for extra safety
        const compositeKey = `${attempt.score}-${attempt.maxScore}-${new Date(Math.floor(new Date(attempt.submittedDate).getTime() / 1000) * 1000).toISOString()}`;

        if (!seenKeys.has(key) && !seenKeys.has(compositeKey)) {
          seenKeys.add(key);
          if (key !== compositeKey) {
            seenKeys.add(compositeKey);
          }
          deduplicatedAttempts.push(attempt);
        }
      }

      allAttempts = deduplicatedAttempts;

      // Sort by date (newest first) for consistency
      allAttempts.sort(
        (a, b) =>
          new Date(b.submittedDate).getTime() -
          new Date(a.submittedDate).getTime(),
      );

      // SAFETY CHECK: Ensure count doesn't increase by more than 1 from previous state
      // This prevents duplicate counting when the same attempt is added multiple times
      const previousCount = previousAttemptCountRef.current;
      const newCount = allAttempts.length;
      const countDifference = newCount - previousCount;

      // Only apply the safety check if we have a previous count (not initial load)
      // On initial load, previousCount is 0, so we allow all attempts from history
      if (previousCount > 0 && countDifference > 1) {
        // If count increased by more than 1, keep only the most recent attempts
        // This prevents duplicate counting issues
        // Keep previous count + 1 (only allow 1 new attempt)
        const maxAllowedCount = previousCount + 1;
        if (allAttempts.length > maxAllowedCount) {
          // Keep only the most recent attempts (already sorted newest first)
          allAttempts = allAttempts.slice(0, maxAllowedCount);
        }
      }

      // Update previous count reference for next comparison
      previousAttemptCountRef.current = allAttempts.length;

      setAttempts(allAttempts);
      setLoading(false);
    };

    fetchAttempts();
  }, [quizDigest, courseShortname, user?.id, currentAttemptDigest]);

  const { t } = useTranslation();

  // If all questions are essays, hide attempts/percentages but still render results UI (allows Retake)
  const allEssay =
    Array.isArray(questions) && questions.length > 0
      ? questions.every((q) => q.feedbackType === "essay")
      : false;
  const hideStats = allEssay;

  // Calculate score percentage
  const scorePercentage =
    maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  // Calculate statistics
  const totalAttempts = attempts.length;
  const bestScore =
    attempts.length > 0
      ? Math.max(
          ...attempts.map((a) =>
            a.maxScore > 0 ? Math.round((a.score / a.maxScore) * 100) : 0,
          ),
        )
      : scorePercentage;
  const averageScore =
    attempts.length > 0
      ? Math.round(
          attempts.reduce((sum, a) => {
            const pct = a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0;
            return sum + pct;
          }, 0) / attempts.length,
        )
      : scorePercentage;

  // Calculate attempts remaining
  const maxAttemptsNum =
    maxAttempts === "unlimited" || maxAttempts === 0
      ? null
      : typeof maxAttempts === "string"
        ? parseInt(maxAttempts, 10)
        : maxAttempts;
  const attemptsRemaining =
    maxAttemptsNum !== null && !isNaN(maxAttemptsNum)
      ? Math.max(0, maxAttemptsNum - totalAttempts)
      : null; // null means unlimited
  const hasAttemptsRemaining =
    attemptsRemaining === null || attemptsRemaining > 0;

  // Compute retake visibility and reasons for debugging
  const retakeReasons: string[] = [];
  if (isPreTest) {
    retakeReasons.push("isPreTest");
  }
  if (maxAttempts === 1 || maxAttempts === "1") {
    retakeReasons.push("one-time-only(maxAttempts=1)");
  }
  if (!hasAttemptsRemaining) {
    retakeReasons.push("no_attempts_remaining");
  }
  if (retakeReasons.length === 0) {
    retakeReasons.push("allowed");
  }

  const showRetake =
    !isPreTest &&
    maxAttempts !== 1 &&
    maxAttempts !== "1" &&
    hasAttemptsRemaining;

  // Store debug info and log visible reason summary
  retakeDebugRef.current = { show: showRetake, reasons: retakeReasons };

  return (
    <div className="quiz-results-screen  h-fit pb-32 md:pb-24 max-w-3xl mx-auto p-6">
      {/* Score Header */}
      <div className="bg-cyan-50 rounded-lg p-6 mb-6 text-center">
        {!hideStats ? (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              YOU SCORED:{" "}
              {maxScore > 0 ? Math.round((score / maxScore) * 100) : 0}%
            </h2>
            {isPreTest && (
              <p className="text-gray-600 mb-4">
                {t("quiz.preTestCompleteMessage")}
              </p>
            )}
            {!isPreTest && (
              <p className="text-sm text-gray-600 mb-4">
                {passThreshold}% Pass Threshold ,{" "}
                {maxAttempts === "unlimited" || maxAttempts === 0
                  ? "Unlimited"
                  : maxAttempts}{" "}
                Attempts
                {attemptsRemaining !== null && (
                  <span
                    className={`ml-2 font-semibold ${
                      attemptsRemaining === 0
                        ? "text-red-600"
                        : attemptsRemaining <= 2
                          ? "text-orange-600"
                          : "text-green-600"
                    }`}>
                    (
                    {attemptsRemaining === 0
                      ? "No attempts remaining"
                      : `${attemptsRemaining} attempt${
                          attemptsRemaining === 1 ? "" : "s"
                        } remaining`}
                    )
                  </span>
                )}
              </p>
            )}
          </>
        ) : (
          <div className="bg-cyan-50 rounded-lg p-6 mb-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Thank you for your response.
            </h2>
          </div>
        )}

        {/* Statistics - Hide attempts for pre-tests */}
        {!isPreTest && !hideStats && (
          <div className="flex justify-center gap-8 mt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">
                {loading ? (
                  <span className="text-gray-400">...</span>
                ) : (
                  totalAttempts
                )}
              </div>
              <div className="text-sm text-gray-600">Attempts</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">
                {loading ? (
                  <span className="text-gray-400">...</span>
                ) : (
                  bestScore
                )}
                %
              </div>
              <div className="text-sm text-gray-600">Best</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">
                {loading ? (
                  <span className="text-gray-400">...</span>
                ) : (
                  averageScore
                )}
                %
              </div>
              <div className="text-sm text-gray-600">Average</div>
            </div>
          </div>
        )}
      </div>

      {/* Question Results - only when showfeedback is 2 (show which are right/wrong + user's answer) */}
      {showQuestionFeedback && (
        <div className="space-y-3 mb-6">
          {questions
            .filter((q) => q.feedbackType !== "essay")
            .map((question, index) => {
              const type =
                question.feedbackType ??
                (question.isCorrect ? "correct" : "incorrect");
              const isPartial = type === "partial";
              const isCorrect = type === "correct";
              const isEssay = type === "essay";
              const bgClass = isEssay
                ? "bg-gray-50/80 border-gray-100"
                : isCorrect
                  ? "bg-green-50/80 border-green-100"
                  : isPartial
                    ? "bg-orange-50/80 border-orange-100"
                    : "bg-red-50/80 border-red-100";
              // User's answer box: lighter green/red/orange/gray, no icon
              const answerBoxBg = isEssay
                ? "bg-gray-50 border-gray-100"
                : isCorrect
                  ? "bg-green-50 border-green-100"
                  : isPartial
                    ? "bg-orange-50 border-orange-100"
                    : "bg-red-50 border-red-100";
              const answerTextClass = isEssay
                ? "text-gray-700"
                : isCorrect
                  ? "text-green-700"
                  : isPartial
                    ? "text-orange-700"
                    : "text-red-700";
              return (
                <div key={index} className={`border rounded-lg p-4 ${bgClass}`}>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-1">
                      <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-cyan-700">
                          {question.questionNumber}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 font-medium mb-1">
                        {question.questionText}
                      </p>
                      {/* User's selected answer - show when showfeedback is 2 or 1 */}
                      {question.userAnswer != null &&
                        question.userAnswer !== "" && (
                          <div
                            className={`mt-2 rounded-lg border p-3 ${answerBoxBg}`}>
                            <span className={`font-medium ${answerTextClass}`}>
                              {question.userAnswer}
                            </span>
                          </div>
                        )}
                    </div>
                    {!isEssay && (
                      <div className="shrink-0">
                        {isCorrect ? (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        ) : isPartial ? (
                          <AlertCircle className="w-6 h-6 text-orange-600" />
                        ) : (
                          <XCircle className="w-6 h-6 text-red-600" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col pb-32 md:pb-24 sm:flex-row items-stretch sm:items-center justify-center gap-4">
        {!isPreTest &&
          // Don't show retake button if:
          // 1. maxAttempts is 1 (one-time only), OR
          // 2. No attempts remaining (hasAttemptsRemaining is false)
          maxAttempts !== 1 &&
          maxAttempts !== "1" &&
          hasAttemptsRemaining && (
            <Button
              onClick={onRetake}
              variant="outline"
              className="border-2 border-cyan-500 text-cyan-600 hover:bg-cyan-50 px-8 py-3 rounded-xl font-medium w-full sm:w-auto">
              Retake this Quiz
            </Button>
          )}
        {!isPreTest &&
          !hasAttemptsRemaining &&
          maxAttempts !== 1 &&
          maxAttempts !== "1" && (
            <div className="text-center text-sm text-red-600 font-medium px-4 py-2 bg-red-50 rounded-lg border border-red-200">
              No attempts remaining. You have reached the maximum number of
              attempts ({maxAttempts}).
            </div>
          )}
        <Button
          onClick={onContinue}
          className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-3 rounded-xl font-medium w-full sm:w-auto">
          {isPreTest ? "Continue to Course" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
