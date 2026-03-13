import { useLanguageStore } from "@/store/useLanguageStore";
import { translations } from "@/locales";

type TranslationKey = string;

export function useTranslation() {
  const { language } = useLanguageStore();

  const t = (key: TranslationKey): string => {
    const keys = key.split(".");
    let value: any = translations[language];

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k];
      } else {
        // Fallback to English if translation not found
        value = translations.en;
        for (const fallbackKey of keys) {
          if (value && typeof value === "object" && fallbackKey in value) {
            value = value[fallbackKey];
          } else {
            return key;
          }
        }
        break;
      }
    }

    return typeof value === "string" ? value : key;
  };

  return { t, language };
}
