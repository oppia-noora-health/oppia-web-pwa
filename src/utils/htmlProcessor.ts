import { loadFileFromCourse, loadFileBlobURL } from "@/utils/courseLoaderIDB";
import type { CourseStructure } from "@/services/courseDownloadService";

/**
 * Process CSS content to convert relative URLs to blob URLs (for offline/IndexedDB mode)
 */
export async function processCssUrlsOffline(
  cssContent: string,
  cssFilePath: string,
  courseId: string,
): Promise<string> {
  try {
    // Get the directory of the CSS file for resolving relative paths
    const cssDir = cssFilePath.substring(0, cssFilePath.lastIndexOf("/"));

    // Regular expression to find url() in CSS
    const urlRegex = /url\(['"]?([^'"()]+)['"]?\)/g;
    let match;
    const replacements: { original: string; replacement: string }[] = [];

    while ((match = urlRegex.exec(cssContent)) !== null) {
      const url = match[1];

      // Skip data URIs, absolute URLs, and blob URLs
      if (
        url.startsWith("data:") ||
        url.startsWith("http") ||
        url.startsWith("blob:") ||
        url.startsWith("//")
      ) {
        continue;
      }

      // Resolve relative URL based on CSS file location
      let resolvedPath = url;
      if (url.startsWith("../")) {
        // Handle ../ paths
        const parts = cssDir.split("/");
        const urlParts = url.split("../");
        const upLevels = urlParts.length - 1;
        const filename = urlParts[urlParts.length - 1];
        const newDir = parts.slice(0, parts.length - upLevels).join("/");
        resolvedPath = newDir + "/" + filename;
      } else if (!url.startsWith("/")) {
        // Handle relative paths
        resolvedPath = cssDir + "/" + url;
      }

      // Try to load the resource from IndexedDB
      const blobUrl = await loadFileBlobURL(courseId, resolvedPath);
      if (blobUrl) {
        replacements.push({
          original: match[0],
          replacement: `url('${blobUrl}')`,
        });
        // console.log(`  🔗 CSS url() resolved: ${url} -> blob`);
      } else {
        // console.log(`  ⚠️ CSS url() not found: ${resolvedPath}`);
      }
    }

    // Apply all replacements
    let processedCss = cssContent;
    replacements.forEach(({ original, replacement }) => {
      processedCss = processedCss.replace(original, replacement);
    });

    return processedCss;
  } catch (error) {
    // console.error("Error processing CSS URLs:", error);
    return cssContent;
  }
}

/**
 * Process CSS content to convert relative URLs (synchronous version for online/cache mode)
 */
export function processCssUrlsOnline(
  cssContent: string,
  cssFilePath: string,
  structure: CourseStructure,
  getFileContent: (id: number, path: string, version: number) => string | null,
): string {
  try {
    // Get the directory of the CSS file for resolving relative paths
    const cssDir = cssFilePath.substring(0, cssFilePath.lastIndexOf("/"));

    // Regular expression to find url() in CSS
    const urlRegex = /url\(['"]?([^'"()]+)['"]?\)/g;
    let match;
    const replacements: { original: string; replacement: string }[] = [];

    while ((match = urlRegex.exec(cssContent)) !== null) {
      const url = match[1];

      // Skip data URIs, absolute URLs, and blob URLs
      if (
        url.startsWith("data:") ||
        url.startsWith("http") ||
        url.startsWith("blob:") ||
        url.startsWith("//")
      ) {
        continue;
      }

      // Resolve relative URL based on CSS file location
      let resolvedPath = url;
      if (url.startsWith("../")) {
        // Handle ../ paths
        const parts = cssDir.split("/");
        const urlParts = url.split("../");
        const upLevels = urlParts.length - 1;
        const filename = urlParts[urlParts.length - 1];
        const newDir = parts.slice(0, parts.length - upLevels).join("/");
        resolvedPath = newDir + "/" + filename;
      } else if (!url.startsWith("/")) {
        // Handle relative paths
        resolvedPath = cssDir + "/" + url;
      }

      // Try to load the resource from cache
      const fileContent = getFileContent(
        structure.id,
        resolvedPath,
        structure.version,
      );
      if (fileContent) {
        // If it's already a data URI, use it
        if (fileContent.startsWith("data:")) {
          replacements.push({
            original: match[0],
            replacement: `url('${fileContent}')`,
          });
          // console.log(`  🔗 CSS url() resolved: ${url} -> data URI`);
        }
      } else {
        // console.log(`  ⚠️ CSS url() not found: ${resolvedPath}`);
      }
    }

    // Apply all replacements
    let processedCss = cssContent;
    replacements.forEach(({ original, replacement }) => {
      processedCss = processedCss.replace(original, replacement);
    });

    return processedCss;
  } catch (error) {
    // console.error("Error processing CSS URLs (sync):", error);
    return cssContent;
  }
}

/**
 * Helper: returns true if a URL should be skipped (already absolute, data-uri, or blob)
 */
function shouldSkipUrl(url: string | null): boolean {
  return (
    !url ||
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.startsWith("http") ||
    url.startsWith("//")
  );
}

/**
 * Process HTML for offline viewing (IndexedDB mode)
 * Replaces all media sources with blob URLs and inlines CSS/JS.
 *
 * Performance: all independent IDB reads are launched in parallel so the
 * total wall-clock time is max(reads) instead of sum(reads).
 */
export async function processHtmlForOfflineMedia(
  html: string,
  courseId: string,
): Promise<string> {
  try {
    // Create a temporary DOM to parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // ── 1. Collect all independent media loads (images + videos) ──
    const mediaPromises: Promise<void>[] = [];

    const images = doc.querySelectorAll("img");
    for (const img of Array.from(images)) {
      const src = img.getAttribute("src");
      if (!shouldSkipUrl(src)) {
        mediaPromises.push(
          loadFileBlobURL(courseId, src!).then((blobUrl) => {
            if (blobUrl) img.setAttribute("src", blobUrl);
          }),
        );
      }
    }

    const videos = doc.querySelectorAll("video source, video");
    for (const video of Array.from(videos)) {
      const src = video.getAttribute("src");
      if (!shouldSkipUrl(src)) {
        mediaPromises.push(
          loadFileBlobURL(courseId, src!).then((blobUrl) => {
            if (blobUrl) video.setAttribute("src", blobUrl);
          }),
        );
      }
    }

    // ── 2. Collect CSS inlining (each CSS may need sub-reads for url() assets) ──
    const cssLinks = Array.from(doc.querySelectorAll("link[rel='stylesheet']"));
    const cssPromises = cssLinks
      .filter((link) => !shouldSkipUrl(link.getAttribute("href")))
      .map(async (link) => {
        const href = link.getAttribute("href")!;
        let cssContent = await loadFileFromCourse(courseId, href);
        if (cssContent) {
          cssContent = await processCssUrlsOffline(cssContent, href, courseId);
          const styleTag = doc.createElement("style");
          styleTag.setAttribute("data-original-href", href);
          styleTag.textContent = cssContent;
          link.parentNode?.replaceChild(styleTag, link);
        }
      });

    // ── 3. Collect JS inlining ──
    const scripts = Array.from(doc.querySelectorAll("script[src]"));
    const jsPromises = scripts
      .filter((script) => !shouldSkipUrl(script.getAttribute("src")))
      .map(async (script) => {
        const src = script.getAttribute("src")!;
        const jsContent = await loadFileFromCourse(courseId, src);
        if (jsContent) {
          const inlineScript = doc.createElement("script");
          inlineScript.setAttribute("data-original-src", src);
          inlineScript.textContent = jsContent;
          Array.from(script.attributes).forEach((attr) => {
            if (attr.name !== "src") {
              inlineScript.setAttribute(attr.name, attr.value);
            }
          });
          script.parentNode?.replaceChild(inlineScript, script);
        }
      });

    // ── 4. Await ALL in parallel ──
    await Promise.all([...mediaPromises, ...cssPromises, ...jsPromises]);

    // Return processed HTML
    return doc.documentElement.outerHTML;
  } catch (error) {
    return html; // Return original HTML if processing fails
  }
}

/**
 * Process HTML for online viewing (cache mode)
 * Inlines CSS/JS from cached files
 */
export function processHtmlForOnlineMedia(
  html: string,
  structure: CourseStructure,
  getFileContent: (id: number, path: string, version: number) => string | null,
): string {
  try {
    // Create a temporary DOM to parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Process all CSS link tags
    const cssLinks = doc.querySelectorAll("link[rel='stylesheet']");
    for (const link of Array.from(cssLinks)) {
      const href = link.getAttribute("href");
      if (
        href &&
        !href.startsWith("data:") &&
        !href.startsWith("blob:") &&
        !href.startsWith("http")
      ) {
        // console.log(`📄 Loading CSS from cache: ${href}`);
        let cssContent = getFileContent(structure.id, href, structure.version);
        if (cssContent) {
          // Process CSS URLs (fonts, images) - synchronous version
          cssContent = processCssUrlsOnline(
            cssContent,
            href,
            structure,
            getFileContent,
          );

          // Replace link tag with inline style tag
          const styleTag = doc.createElement("style");
          styleTag.setAttribute("data-original-href", href);
          styleTag.textContent = cssContent;
          link.parentNode?.replaceChild(styleTag, link);
          // console.log(`✅ CSS inlined: ${href}`);
        } else {
          // console.log(`❌ CSS not found: ${href}`);
        }
      }
    }

    // Process all external script tags
    const scripts = doc.querySelectorAll("script[src]");
    for (const script of Array.from(scripts)) {
      const src = script.getAttribute("src");
      if (
        src &&
        !src.startsWith("data:") &&
        !src.startsWith("blob:") &&
        !src.startsWith("http")
      ) {
        // console.log(`📜 Loading JS from cache: ${src}`);
        const jsContent = getFileContent(structure.id, src, structure.version);
        if (jsContent) {
          // Replace external script with inline script
          const inlineScript = doc.createElement("script");
          inlineScript.setAttribute("data-original-src", src);
          inlineScript.textContent = jsContent;
          // Copy other attributes except src
          Array.from(script.attributes).forEach((attr) => {
            if (attr.name !== "src") {
              inlineScript.setAttribute(attr.name, attr.value);
            }
          });
          script.parentNode?.replaceChild(inlineScript, script);
          // console.log(`✅ JS inlined: ${src}`);
        } else {
          // console.log(`❌ JS not found: ${src}`);
        }
      }
    }

    // Return processed HTML
    return doc.documentElement.outerHTML;
  } catch (error) {
    // console.error("Error processing HTML for online media:", error);
    return html; // Return original HTML if processing fails
  }
}
