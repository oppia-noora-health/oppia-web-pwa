import { loadFileFromCourse } from "@/utils/courseLoaderIDB";
import { scopeCSSToWrapper, fixCSSUrls } from "./cssScoping";

/**
 * Convert linked stylesheets to inline styles with CSS scoping
 * Supports both offline (IndexedDB) and online (streaming) modes
 */
export async function convertLinkedStylesToInline(
  wrapper: HTMLElement | null,
  courseId?: string,
  serverUrl?: string,
  shortname?: string
): Promise<void> {
  const linkElements = wrapper?.querySelectorAll('link[rel="stylesheet"]');
  if (!linkElements) return;

  for (const link of Array.from(linkElements)) {
    const href = link.getAttribute("href");
    if (!href) continue;

    // Skip already absolute URLs from external sources
    if (
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("//")
    ) {
      continue;
    }

    try {
      let cssText = "";

      // For offline mode - try to load from IndexedDB first
      if (courseId) {
        const cssContent = await loadFileFromCourse(courseId, href);
        if (cssContent) {
          cssText = cssContent;
        }
      }

      // If not in IndexedDB, fetch from server (streaming mode)
      if (!cssText) {
        let cssUrl = href;

        // Construct absolute URL for streaming mode
        if (serverUrl && shortname) {
          if (!href.startsWith("/")) {
            cssUrl = `${serverUrl}media/courses/${shortname}/${href}`;
          } else if (href.startsWith("/media/")) {
            cssUrl = href; // Already has /media/ prefix - use proxy
          } else {
            cssUrl = `${serverUrl}media/courses/${shortname}/${href.replace(
              /^\//,
              ""
            )}`;
          }
        }

        const response = await fetch(cssUrl);
        if (!response.ok) {
          continue;
        }
        cssText = await response.text();
      }

      // Fix relative url() references in CSS to point to absolute server URL
      if (serverUrl && shortname) {
        const cssBaseUrl = `${serverUrl}media/courses/${shortname}/`;
        cssText = fixCSSUrls(cssText, cssBaseUrl);
      }

      // Scope CSS to prevent leakage to app
      const scopedCSS = scopeCSSToWrapper(cssText);

      // Create inline style
      const styleElement = document.createElement("style");
      styleElement.setAttribute("data-original-href", href);
      styleElement.textContent = scopedCSS;

      // Replace link with inline style
      link.parentNode?.replaceChild(styleElement, link);

      // Debug: Log a sample of scoped CSS for content-section buttons
      if (href.includes("style.css")) {
        const buttonStyleMatch = scopedCSS.match(
          /content-section.*#(prevBtn|nextBtn)[^}]+}/g
        );
        if (buttonStyleMatch) {}
      }
    } catch (error) {}
  }
}
