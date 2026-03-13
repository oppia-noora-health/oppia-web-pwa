/**
 * Pre-test storage utilities
 * Tracks whether a user has attempted the pre-test for each course
 */

const PRETEST_STORAGE_KEY = "pretest_attempts";

export function normalizePreTestTitle(title: string): string {
  if (!title) return "";
  return title.toLowerCase().replace(/[\s-]/g, "");
}

/**
 * Check if a quiz title indicates it's a pre-test
 * Handles various formats: "Pre-test", "Pre Test", "pretest", "PreTest", etc.
 */
export function isPreTestTitle(title: string): boolean {
  if (!title) return false;
  const normalized = normalizePreTestTitle(title);
  return normalized.includes("pretest");
}

interface PreTestAttempt {
  courseId: string;
  quizId: string | number;
  attempted: boolean;
  attemptedAt: string;
}

/**
 * Get all pre-test attempts from localStorage
 */
function getAllPreTestAttempts(): PreTestAttempt[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(PRETEST_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    return [];
  }
}

/**
 * Save all pre-test attempts to localStorage
 */
function saveAllPreTestAttempts(attempts: PreTestAttempt[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(PRETEST_STORAGE_KEY, JSON.stringify(attempts));
  } catch (error) {}
}

/**
 * Check if user has attempted the pre-test for a course
 */
export function hasAttemptedPreTest(
  courseId: string,
  quizId: string | number,
): boolean {
  const attempts = getAllPreTestAttempts();

  const attempt = attempts.find(
    (a) => a.courseId === courseId && a.quizId === String(quizId),
  );

  return attempt?.attempted || false;
}

/**
 * Mark pre-test as attempted for a course
 */
export function markPreTestAttempted(
  courseId: string,
  quizId: string | number,
): void {
  if (typeof window === "undefined") {
    console.log(
      `[PreTest] ⚠️ markPreTestAttempted called on server-side, skipping`,
    );
    return;
  }

  console.log(
    `[PreTest] 📝 markPreTestAttempted called — courseId: ${courseId}, quizId: ${quizId}`,
  );
  const attempts = getAllPreTestAttempts();
  console.log(`[PreTest] Retrieved attempts array, length: ${attempts.length}`);

  // Check if already exists
  const existingIndex = attempts.findIndex(
    (attempt) =>
      attempt.courseId === courseId &&
      String(attempt.quizId) === String(quizId),
  );

  console.log(
    `[PreTest] Existing index: ${existingIndex}, creating ${existingIndex >= 0 ? "update" : "new"} entry`,
  );

  if (existingIndex >= 0) {
    // Update existing
    attempts[existingIndex].attempted = true;
    attempts[existingIndex].attemptedAt = new Date().toISOString();
  } else {
    // Add new
    attempts.push({
      courseId,
      quizId: String(quizId),
      attempted: true,
      attemptedAt: new Date().toISOString(),
    });
  }

  console.log(
    `[PreTest] Saving attempts array with length: ${attempts.length}`,
  );
  saveAllPreTestAttempts(attempts);
  console.log(`[PreTest] Saved to localStorage key: ${PRETEST_STORAGE_KEY}`);

  // Force a synchronous read to verify it was saved
  const verifySaved = getAllPreTestAttempts();
  const verifyFound = verifySaved.find(
    (a) => a.courseId === courseId && a.quizId === String(quizId),
  );
  console.log(
    `[PreTest] ✅ Verification — found: ${!!verifyFound}, total entries: ${verifySaved.length}`,
  );
}

/**
 * Clear pre-test attempt for a course (for testing/debugging)
 */
export function clearPreTestAttempt(
  courseId: string,
  quizId: string | number,
): void {
  const attempts = getAllPreTestAttempts();
  const filtered = attempts.filter(
    (attempt) =>
      !(
        attempt.courseId === courseId &&
        String(attempt.quizId) === String(quizId)
      ),
  );
  saveAllPreTestAttempts(filtered);
}

/**
 * Clear all pre-test attempts for a specific course (used on course reset)
 * Also removes associated pretest_results_shown_* localStorage keys
 */
export function clearPreTestForCourse(courseId: string): void {
  if (typeof window === "undefined") return;

  const attempts = getAllPreTestAttempts();

  // Find entries for this course so we can remove their results-shown keys
  const courseAttempts = attempts.filter((a) => a.courseId === courseId);
  for (const attempt of courseAttempts) {
    localStorage.removeItem(`pretest_results_shown_${attempt.quizId}`);
  }

  // Remove all entries for this course
  const remaining = attempts.filter((a) => a.courseId !== courseId);
  saveAllPreTestAttempts(remaining);
}

/**
 * Clear all pre-test attempts (for testing/debugging)
 */
export function clearAllPreTestAttempts(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PRETEST_STORAGE_KEY);
}

/**
 * Sync pre-test localStorage flags from activity tracker data.
 * Call after fetching fresh tracker data from /activity API (e.g. "Update Activity").
 *
 * Walks the course sections to find the pre-test quiz, then checks if any
 * tracker with matching digest + type=quiz exists in the API response.
 *   - If found  → marks pre-test as attempted + sets results_shown flag
 *   - If absent → clears pre-test flags so the modal shows again
 *
 * @param courseId   - Course ID (string)
 * @param sections   - Array of course sections (from courseData.sections / IDB structure)
 * @param trackers   - Array of ActivityTracker objects from the API response
 */
export function syncPreTestFromTrackers(
  courseId: string,
  sections: Array<{
    type?: string;
    quizData?: any;
    content?: any;
    title?: any;
    id?: string;
    digest?: string;
  }>,
  trackers: Array<{ digest: string; type: string }>,
): void {
  if (typeof window === "undefined" || !sections || sections.length === 0)
    return;

  // Find the first pre-test quiz section
  for (const section of sections) {
    if (section.type !== "quiz") continue;

    const rawTitle =
      section.quizData?.title ?? section.content?.title ?? section.title;
    let title = "";
    if (typeof rawTitle === "object" && rawTitle !== null) {
      // Multilingual title object — pick first non-null value
      title =
        (Object.values(rawTitle).find(
          (v) => typeof v === "string" && v,
        ) as string) || "";
    } else {
      title = String(rawTitle || "");
    }

    if (!isPreTestTitle(title)) continue;

    const quizId =
      section.quizData?.id ?? section.content?.id ?? section.id ?? "";
    const digest = section.digest ?? "";

    // Check API trackers for any attempt with this digest
    const hasApiAttempt =
      digest !== "" &&
      trackers.some((t) => t.digest === digest && t.type === "quiz");

    if (hasApiAttempt) {
      // Restore pre-test flags so the course viewer treats it as completed
      markPreTestAttempted(courseId, quizId);
      if (quizId) {
        localStorage.setItem(`pretest_results_shown_${quizId}`, "true");
      }
    } else {
      // No attempt on server — ensure local flags are cleared
      clearPreTestForCourse(courseId);
    }

    // Only process the first pre-test
    break;
  }
}

/**
 * Check if pre-test is completed (results have been shown)
 * This is different from "attempted" - completion means user saw results
 */
export function isPreTestCompleted(
  courseId: string,
  quizId: string | number,
): boolean {
  if (typeof window === "undefined") return false;

  try {
    // Check if results were shown (this is set when quiz is submitted and results shown)
    const resultsKey = `pretest_results_shown_${quizId}`;
    const resultsShown = window.localStorage.getItem(resultsKey) === "true";

    // Also check if marked as attempted (backup check)
    const attempted = hasAttemptedPreTest(courseId, quizId);

    const result = resultsShown || attempted;
    console.log(
      `[PreTest] isPreTestCompleted — courseId: ${courseId}, quizId: ${quizId}, resultsShown: ${resultsShown}, attempted: ${attempted}, result: ${result}`,
    );

    // Pre-test is completed if EITHER results were shown OR it's marked as attempted
    // Using OR logic so offline users aren't blocked when one flag is missing
    return result;
  } catch (error) {
    return false;
  }
}
