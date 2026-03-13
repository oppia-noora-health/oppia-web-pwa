/**
 * Last Activity Storage
 * Tracks the last visited activity for each course to enable "Resume" functionality
 */

export interface LastVisitedActivity {
  courseId: string;
  activityId: string;
  activityIndex: number;
  activityTitle: string;
  lessonTitle: string;
  timestamp: string;
  shortname?: string;
  mode?: "streaming" | "offline";
}

const STORAGE_KEY = "noora_last_visited_activities";

/**
 * Get all last visited activities from localStorage
 */
function getAllLastVisitedActivities(): Record<string, LastVisitedActivity> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    return {};
  }
}

/**
 * Save last visited activity for a course
 */
export function saveLastVisitedActivity(activity: LastVisitedActivity): void {
  try {
    const allActivities = getAllLastVisitedActivities();
    allActivities[activity.courseId] = activity;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allActivities));
  } catch (error) {}
}

/**
 * Get last visited activity for a specific course
 */
export function getLastVisitedActivity(
  courseId: string,
): LastVisitedActivity | null {
  try {
    const allActivities = getAllLastVisitedActivities();
    return allActivities[courseId] || null;
  } catch (error) {
    return null;
  }
}

/**
 * Clear last visited activity for a course
 */
export function clearLastVisitedActivity(courseId: string): void {
  try {
    const allActivities = getAllLastVisitedActivities();
    delete allActivities[courseId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allActivities));
  } catch (error) {}
}

/**
 * Check if course has a saved last visited activity
 */
export function hasLastVisitedActivity(courseId: string): boolean {
  return getLastVisitedActivity(courseId) !== null;
}

/**
 * Clear all last visited activities (for logout/complete cleanup)
 */
export function clearAllLastVisitedActivities(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {}
}
