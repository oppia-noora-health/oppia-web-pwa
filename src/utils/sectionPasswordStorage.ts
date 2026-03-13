// utils/sectionPasswordStorage.ts

/**
 * Utility functions for storing and checking unlocked password-protected sections
 */

const STORAGE_KEY_PREFIX = "noora_unlocked_sections_";

/**
 * Get storage key for a specific course
 */
function getStorageKey(courseId: string): string {
  return `${STORAGE_KEY_PREFIX}${courseId}`;
}

/**
 * Get all unlocked sections for a course
 */
export function getUnlockedSections(courseId: string): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const key = getStorageKey(courseId);
    const stored = localStorage.getItem(key);
    if (stored) {
      const unlocked = JSON.parse(stored) as string[];
      return new Set(unlocked);
    }
  } catch (error) {}

  return new Set();
}

/**
 * Check if a section is unlocked
 * @param courseId - Course ID
 * @param sectionTitle - Section title (used as identifier)
 */
export function isSectionUnlocked(
  courseId: string,
  sectionTitle: string,
): boolean {
  const unlocked = getUnlockedSections(courseId);
  const isUnlocked = unlocked.has(sectionTitle);
  return isUnlocked;
}

/**
 * Unlock a section (store it as unlocked)
 * @param courseId - Course ID
 * @param sectionTitle - Section title (used as identifier)
 */
export function unlockSection(courseId: string, sectionTitle: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const key = getStorageKey(courseId);
    const unlocked = getUnlockedSections(courseId);
    unlocked.add(sectionTitle);

    localStorage.setItem(key, JSON.stringify(Array.from(unlocked)));
  } catch (error) {}
}

/**
 * Clear all unlocked sections for a course (useful for logout/reset)
 * @param courseId - Course ID
 */
export function clearUnlockedSections(courseId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const key = getStorageKey(courseId);
    localStorage.removeItem(key);
  } catch (error) {}
}
