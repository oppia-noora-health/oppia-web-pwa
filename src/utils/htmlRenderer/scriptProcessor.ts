import { loadFileFromCourse } from "@/utils/courseLoaderIDB";

/**
 * Convert external script tags to inline scripts
 * Supports both offline (IndexedDB) and online (streaming) modes
 * MUST be called before script execution to work properly
 */
export async function convertExternalScriptsToInline(
  wrapper: HTMLElement | null,
  courseId?: string,
  serverUrl?: string,
  shortname?: string
): Promise<void> {
  const scriptElements = wrapper?.querySelectorAll("script[src]");
  if (!scriptElements) return;

  for (const script of Array.from(scriptElements)) {
    const src = script.getAttribute("src");
    if (!src) continue;

    // Skip scripts that are already absolute URLs from external sources
    if (
      src.startsWith("http://") ||
      src.startsWith("https://") ||
      src.startsWith("//")
    ) {
      continue;
    }

    try {
      let scriptUrl = src;

      // For offline mode - try to load from IndexedDB first
      if (courseId) {
        const scriptContent = await loadFileFromCourse(courseId, src);
        if (scriptContent) {
          // Create inline script
          const inlineScript = document.createElement("script");
          script.getAttributeNames().forEach((attrName) => {
            if (attrName !== "src") {
              inlineScript.setAttribute(
                attrName,
                script.getAttribute(attrName)!
              );
            }
          });
          inlineScript.setAttribute("data-original-src", src);
          inlineScript.textContent = scriptContent;

          // Replace external script with inline script
          script.parentNode?.replaceChild(inlineScript, script);
          continue;
        }
      }

      // For streaming mode or if not in IndexedDB - construct absolute URL and fetch
      if (serverUrl && shortname) {
        // Handle relative paths
        if (!src.startsWith("/")) {
          scriptUrl = `${serverUrl}media/courses/${shortname}/${src}`;
        } else if (src.startsWith("/media/")) {
          // Already has /media/ prefix - use proxy
          scriptUrl = src;
        } else {
          scriptUrl = `${serverUrl}media/courses/${shortname}/${src.replace(
            /^\//,
            ""
          )}`;
        }
      }

      const response = await fetch(scriptUrl);
      if (!response.ok) {
        continue;
      }

      const scriptText = await response.text();

      // Create inline script
      const inlineScript = document.createElement("script");
      script.getAttributeNames().forEach((attrName) => {
        if (attrName !== "src") {
          inlineScript.setAttribute(attrName, script.getAttribute(attrName)!);
        }
      });
      inlineScript.setAttribute("data-original-src", src);
      inlineScript.textContent = scriptText;

      // Replace external script with inline script
      script.parentNode?.replaceChild(inlineScript, script);
    } catch (error) {}
  }
}

/**
 * Replace script tags to trigger execution
 * React's dangerouslySetInnerHTML doesn't execute scripts, so we need to do this manually
 */
export function executeScripts(wrapper: HTMLElement | null): void {
  const scripts = wrapper?.querySelectorAll("script");
  if (!scripts) return;

  scripts.forEach((oldScript) => {
    const newScript = document.createElement("script");

    // Copy all attributes
    Array.from(oldScript.attributes).forEach((attr) => {
      newScript.setAttribute(attr.name, attr.value);
    });

    // Copy content
    newScript.textContent = oldScript.textContent;

    // Replace old script with new one to trigger execution
    oldScript.parentNode?.replaceChild(newScript, oldScript);
  });
}
