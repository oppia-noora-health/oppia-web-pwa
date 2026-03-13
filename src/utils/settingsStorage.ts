/**
 * Local settings storage with optional user-scoping.
 * Guest (not logged in): keys like "text_size", "custom_api_url", etc.
 * User (logged in): keys like "user_123_text_size", etc.
 * On first load after login, guest values are copied to user keys.
 */

export type TextSize = "smallest" | "small" | "normal" | "large" | "largest";

export const TEXT_SIZE_MAP: Record<TextSize, string> = {
  smallest: "0.75rem",
  small: "0.875rem",
  normal: "1rem",
  large: "1.125rem",
  largest: "1.25rem",
};

const SETTING_KEYS = [
  "text_size",
  "custom_api_url",
  "content_language",
  "show_points_popup",
] as const;

function getKey(key: string, userId: string | undefined): string {
  if (typeof window === "undefined") return key;
  if (userId) return `user_${userId}_${key}`;
  return key;
}

export function getSetting(
  key: string,
  userId: string | undefined,
): string | null {
  if (typeof window === "undefined") return null;
  const userKey = getKey(key, userId);
  const value = localStorage.getItem(userKey);
  if (value !== null) return value;
  // Fallback to guest key when logged in (for first-time user settings)
  if (userId) return localStorage.getItem(key);
  return null;
}

export function setSetting(
  key: string,
  value: string,
  userId: string | undefined,
): void {
  if (typeof window === "undefined") return;
  const storageKey = getKey(key, userId);
  localStorage.setItem(storageKey, value);
}

/**
 * Copy guest settings to user-prefixed keys if user keys don't exist.
 * Call after login so the user keeps their pre-login preferences.
 */
export function migrateGuestSettingsToUser(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  for (const key of SETTING_KEYS) {
    const userKey = getKey(key, userId);
    if (localStorage.getItem(userKey) === null) {
      const guestValue = localStorage.getItem(key);
      if (guestValue !== null) {
        localStorage.setItem(userKey, guestValue);
      }
    }
  }
}

export function applyTextSizeToDocument(size: TextSize): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.fontSize = TEXT_SIZE_MAP[size];
}
