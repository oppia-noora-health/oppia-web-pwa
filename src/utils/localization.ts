/**
 * Extract text from multi-language object
 * @param obj - Multi-language object or string
 * @param fallback - Fallback text if no value found
 * @returns Localized text string
 */
export const getLocalizedText = (
  obj: Record<string, string | null> | string | null | undefined,
  fallback: string = "N/A"
): string => {
  if (!obj) return fallback;
  if (typeof obj === "string") return obj;

  // Priority order: en, hi, bn, kn, tel, or first available
  const preferredLanguages = ["en", "hi", "bn", "kn", "tel"];

  for (const lang of preferredLanguages) {
    if (obj[lang]) return obj[lang] as string;
  }

  // Return first non-null value
  const values = Object.values(obj).filter((v) => v !== null);
  return values.length > 0 ? (values[0] as string) : fallback;
};
