/**
 * Activity Tracking Types
 * Matches the XML response from /api/v2/course/{shortname}/activity
 */

export interface ActivityTracker {
  digest: string;
  submitteddate: string;
  completed: string; // "True" or "False"
  type: string; // "page", "quiz", "feedback"
  event: string; // "activity_completed", "quiz_attempt"
  points: string;
  uuid: string;
  quiz?: QuizAttempt;
}

export interface QuizAttempt {
  score: string;
  maxscore: string;
  submitteddate: string;
  passed: string; // "True" or "False"
  course: string;
  event: string;
  points: string;
  timetaken: string;
}

export interface ActivityTrackingResponse {
  trackers: ActivityTracker[];
}

/**
 * Helper function to parse XML response into typed object
 */
export function parseActivityTrackingXML(
  xmlString: string
): ActivityTrackingResponse {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");

  // Check for parse errors
  const parseError = xmlDoc.querySelector("parsererror");
  if (parseError) {
    return { trackers: [] };
  }

  const trackers: ActivityTracker[] = [];
  const trackerElements = xmlDoc.getElementsByTagName("tracker");

  for (let i = 0; i < trackerElements.length; i++) {
    const tracker = trackerElements[i];

    const activityTracker: ActivityTracker = {
      digest: tracker.getAttribute("digest") || "",
      submitteddate: tracker.getAttribute("submitteddate") || "",
      completed: tracker.getAttribute("completed") || "False",
      type: tracker.getAttribute("type") || "",
      event: tracker.getAttribute("event") || "",
      points: tracker.getAttribute("points") || "0",
      uuid: tracker.getAttribute("uuid") || "",
    };

    // Check for quiz data
    const quizElement = tracker.getElementsByTagName("quiz")[0];
    if (quizElement) {
      activityTracker.quiz = {
        score: quizElement.getAttribute("score") || "0",
        maxscore: quizElement.getAttribute("maxscore") || "0",
        submitteddate: quizElement.getAttribute("submitteddate") || "",
        passed: quizElement.getAttribute("passed") || "False",
        course: quizElement.getAttribute("course") || "",
        event: quizElement.getAttribute("event") || "",
        points: quizElement.getAttribute("points") || "0",
        timetaken: quizElement.getAttribute("timetaken") || "0",
      };
    }

    trackers.push(activityTracker);
  }

  return { trackers };
}

/**
 * Check if an activity is completed based on tracker data
 */
export function isActivityCompleted(tracker: ActivityTracker): boolean {
  // For regular activities, check completed flag
  if (tracker.type !== "quiz") {
    return tracker.completed === "True";
  }

  // For quizzes, check both completed and passed
  if (tracker.quiz) {
    return tracker.completed === "True" && tracker.quiz.passed === "True";
  }

  return tracker.completed === "True";
}
