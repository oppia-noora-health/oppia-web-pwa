import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LanguageCode = "en" | "bn" | "id" | "ne";

export interface Language {
  code: LanguageCode;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
  { code: "ne", name: "Nepali", nativeName: "नेपाली" },
];

const PERSIST_KEY = "interface_language";
const VALID_LANGUAGES: LanguageCode[] = ["en", "bn", "id", "ne"];

/** Read saved language from localStorage so first paint uses it (fixes offline / late rehydration). */
function getInitialLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return "en";
    const parsed = JSON.parse(raw) as { state?: { language?: string } };
    const lang = parsed?.state?.language;
    if (lang && VALID_LANGUAGES.includes(lang as LanguageCode))
      return lang as LanguageCode;
  } catch {
    // ignore
  }
  return "en";
}

interface LanguageState {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  getCurrentLanguage: () => Language;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: getInitialLanguage(),
      setLanguage: (language: LanguageCode) => {
        set({ language });
      },
      getCurrentLanguage: () => {
        const currentCode = get().language;
        return (
          SUPPORTED_LANGUAGES.find((lang) => lang.code === currentCode) ||
          SUPPORTED_LANGUAGES[0]
        );
      },
    }),
    {
      name: PERSIST_KEY,
    }
  )
);
