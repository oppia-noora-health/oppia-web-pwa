/**
 * Daily Completion Tracker
 * Ensures users only get points once per activity per day
 */

/**
 * Get today's date in YYYY-MM-DD format (local timezone)
 */
export const getTodayDateKey = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`; // Local YYYY-MM-DD
};

/**
 * Get the daily completion key for an activity
 * Format: {digest}_daily_{YYYY-MM-DD}
 */
export const getDailyCompletionKey = (
  digest: string,
  date?: string,
): string => {
  const dateKey = date || getTodayDateKey();
  return `${digest}_daily_${dateKey}`;
};

/**
 * Check if an activity was completed today
 * Returns true if completed today, false otherwise
 */
export const wasCompletedToday = (
  completionMap: Map<string, boolean> | null | undefined,
  digest: string,
): boolean => {
  if (!completionMap || !digest) return false;
  const dailyKey = getDailyCompletionKey(digest);
  const result = completionMap.get(dailyKey) === true;
  console.log(
    `[DAILY_CHECK] digest=${digest?.slice(0, 8)}, dailyKey=${dailyKey}, wasCompletedToday=${result}`,
  );
  return result;
};

/**
 * Check if an activity was EVER completed (lifetime)
 * Returns true if completed ever, false otherwise
 */
export const wasCompletedEver = (
  completionMap: Map<string, boolean> | null | undefined,
  digest: string,
): boolean => {
  if (!completionMap || !digest) return false;
  return completionMap.get(digest) === true;
};

/**
 * Check if points should be awarded for an activity
 * Points are awarded only if:
 * 1. Activity was NEVER completed before (lifetime), OR
 * 2. Activity was NOT completed today but was completed before, OR
 * 3. For first-time completions today, award points
 *
 * In simple terms: Award points if not completed today
 */
export const shouldAwardPoints = (
  completionMap: Map<string, boolean> | null | undefined,
  digest: string,
): boolean => {
  if (!completionMap || !digest) {
    console.log(
      `[COMPLETION_CHECK] 🟢 shouldAwardPoints: No data, awarding points`,
      { digest },
    );
    return true; // Award if no data
  }

  // Don't award if already completed today
  const completedTodayResult = wasCompletedToday(completionMap, digest);
  const completedEverResult = wasCompletedEver(completionMap, digest);
  const dailyKey = getDailyCompletionKey(digest);

  console.log(`[COMPLETION_CHECK] Activity: ${digest?.slice(0, 8)}...`, {
    completedToday: completedTodayResult,
    completedEver: completedEverResult,
    dailyKey,
    mapSize: completionMap.size,
    shouldAward: !completedTodayResult,
  });

  if (completedTodayResult) {
    console.log(
      `[COMPLETION_CHECK] 🔴 Already completed today - NO POINTS will be awarded`,
    );
    return false;
  }

  // Award points on first completion or first completion of the day
  console.log(
    `[COMPLETION_CHECK] 🟢 First completion or new day - POINTS will be awarded`,
  );
  return true;
};

/**
 * Mark an activity as completed today in the completion map
 * This adds a daily marker without removing lifetime completion
 */
export const markCompletedToday = (
  completionMap: Map<string, boolean>,
  digest: string,
): Map<string, boolean> => {
  if (!digest) return completionMap;

  const dailyKey = getDailyCompletionKey(digest);
  const updatedMap = new Map(completionMap);

  // Mark both lifetime completion and today's completion
  updatedMap.set(digest, true); // Lifetime marker
  updatedMap.set(dailyKey, true); // Today's marker

  return updatedMap;
};

/**
 * Get all today's completed activities from the map
 * Returns an array of digests that were completed today
 */
export const getTodayCompletions = (
  completionMap: Map<string, boolean> | null | undefined,
): string[] => {
  if (!completionMap) return [];

  const todayKey = getTodayDateKey();
  const completions: string[] = [];

  completionMap.forEach((isCompleted, key) => {
    if (isCompleted && key.includes(`_daily_${todayKey}`)) {
      // Extract digest from daily key: digest_daily_YYYY-MM-DD -> digest
      const digest = key.replace(`_daily_${todayKey}`, "");
      completions.push(digest);
    }
  });

  return completions;
};
