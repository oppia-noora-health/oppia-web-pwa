"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/useStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import {
  getSetting,
  applyTextSizeToDocument,
  type TextSize,
} from "@/utils/settingsStorage";

/**
 * Applies saved text size and interface language on app load and when auth/language changes.
 * Ensures settings are applied even when the user never visits the settings page.
 * Interface language is read from store (which syncs from localStorage) so it works offline.
 */
export function ApplySavedSettings() {
  const { user } = useAuthStore();
  const userId = user?.id?.toString();
  const language = useLanguageStore((s) => s.language);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedTextSize =
      (getSetting("text_size", userId) as TextSize) || "normal";
    applyTextSizeToDocument(savedTextSize);
  }, [userId]);

  // Keep document lang in sync with interface language (accessibility + offline)
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language;
  }, [language]);

  return null;
}
