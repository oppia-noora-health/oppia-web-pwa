/**
 * CSS scoping utility for Moodle content
 * Prevents course styles from leaking into the main application
 */

const SCOPE_PREFIX = ".moodle-content-wrapper";

/**
 * Scope individual CSS rules by prefixing selectors
 */
function scopeRules(cssText: string): string {
  return cssText.replace(
    // Match CSS rules (selector { ... })
    /([^{}]+)\{([^{}]*)\}/g,
    (match, selector, rules) => {
      const trimmedSelector = selector.trim();

      // Skip @font-face, @keyframes, @page, etc. (already handled or don't need scoping)
      if (
        trimmedSelector.startsWith("@font-face") ||
        trimmedSelector.startsWith("@keyframes") ||
        trimmedSelector.startsWith("@page") ||
        trimmedSelector.startsWith("@charset") ||
        trimmedSelector.startsWith("@import") ||
        trimmedSelector.startsWith("@namespace")
      ) {
        return match;
      }

      // Skip other @-rules that shouldn't be scoped
      if (trimmedSelector.startsWith("@")) {
        return match;
      }

      // Split multiple selectors (e.g., "h1, h2, h3")
      const selectors = selector.split(",").map((s: string) => {
        const trimmed = s.trim();

        // Skip if already scoped
        if (trimmed.startsWith(SCOPE_PREFIX)) {
          return trimmed;
        }

        // Skip if it's a pseudo-element/class only (e.g., ":root", "::before")
        if (trimmed.startsWith(":")) {
          return `${SCOPE_PREFIX} ${trimmed}`;
        }

        // Add scope prefix
        return `${SCOPE_PREFIX} ${trimmed}`;
      });

      return `${selectors.join(", ")}{${rules}}`;
    }
  );
}

/**
 * Scope CSS selectors to .moodle-content-wrapper
 * Handles @media queries, @supports, and other nested rules
 */
export function scopeCSSToWrapper(css: string): string {
  try {
    // Don't convert position: fixed to absolute - let course styles work as intended
    // The wrapper's isolation: isolate already creates a containing block for absolute positioning
    let processedCSS = css;

    // Handle @media queries, @supports, etc. by scoping rules inside them
    // Match: @media ... { ... } or @supports ... { ... }
    processedCSS = processedCSS.replace(
      /@(media|supports|container|layer)([^{]+)\{([\s\S]+?)\n\}/gi,
      (match, atRule, condition, innerCSS) => {
        // Recursively scope the inner CSS
        const scopedInner = scopeRules(innerCSS);
        return `@${atRule}${condition}{${scopedInner}\n}`;
      }
    );

    // Scope the remaining (non-nested) rules
    processedCSS = scopeRules(processedCSS);

    return processedCSS;
  } catch (e) {
    return css;
  }
}

/**
 * Fix relative url() references in CSS to point to absolute server URL
 */
export function fixCSSUrls(cssText: string, baseUrl: string): string {
  return cssText.replace(
    /url\(["']?(?!https?:\/\/|\/\/|data:|blob:)([^"')]+)["']?\)/gi,
    (match, urlPath) => {
      let cleanPath = urlPath.replace(/^\.\//, "").replace(/^\.\.\//, "");
      return `url("${baseUrl}${cleanPath}")`;
    }
  );
}
