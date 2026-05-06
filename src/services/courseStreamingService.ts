// services/courseStreamingService.ts

import { authenticatedGet } from "@/utils/apiClient";
import { API_PATHS } from "@/utils/apiPaths";
import { accessLogService } from "@/services/accessLogService";
import { useAuthStore } from "@/store/useStore";
import type { SequencingType } from "./courseDownloadService";

function logStreamingApiFailure(
  operation: string,
  error: unknown,
  details: Record<string, unknown> = {},
) {
  if (typeof window === "undefined") {
    return;
  }

  const user = useAuthStore.getState().user;
  const endpoint =
    typeof details.endpoint === "string" ? details.endpoint : operation;
  const method =
    typeof (error as any)?.config?.method === "string"
      ? String((error as any).config.method).toUpperCase()
      : typeof (error as any)?.method === "string"
        ? String((error as any).method).toUpperCase()
        : null;
  const statusCode =
    (error as any)?.response?.status ?? (error as any)?.code ?? null;
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");

  console.log(
    `[LOG-API-FAILURE] Streaming API failed: operation=${operation}, endpoint=${endpoint}, status=${statusCode}, message=${message}`,
  );
  void accessLogService.log({
    event: "api_failure",
    activityType: "streaming",
    activityName: operation,
    apiEndpoint: endpoint,
    apiMethod: method,
    errorCode: statusCode,
    errorMessage: message,
    pageName: "/course",
    user: {
      userId: user?.id ?? null,
      username: user?.username ?? null,
      phoneNumber: user?.phoneNumber ?? null,
    },
    details: {
      operation,
      status: statusCode,
      ...details,
    },
  });
}

interface CourseStructureResponse {
  id: number;
  resource_uri: string;
  shortname: string;
  structure: string; // JSON string containing the course structure
}

export interface StreamedCourseStructure {
  id: number;
  shortname: string;
  title: string;
  version: number;
  server: string;
  sections: StreamedSection[];
  media: StreamedMedia[];
  totalPages: number;
  sequencing?: SequencingType;
}

export interface StreamedSection {
  id: string;
  order: number;
  type: "page" | "quiz" | "activity" | "feedback";
  title: string;
  sectionTitle?: string;
  sectionOrder?: number;
  htmlFile?: string;
  digest: string;
  quizData?: any; // Quiz data for compatibility with CourseSection
  content?: any; // Alternative quiz/feedback content from structure
  mediaFiles?: StreamedMedia[];
  password?: string; // Password for password-protected sections
  activityTime?: number; // Optional activity_time from module structure (seconds)
}

export interface StreamedMedia {
  filename: string;
  digest: string;
  filesize: string;
  downloadUrl: string;
  length?: string;
}

const getMediaActivityTimeSeconds = (
  mediaFiles: StreamedMedia[],
): number | null => {
  const lengths = mediaFiles
    .map((file) => parseFloat(file.length || ""))
    .filter((length) => Number.isFinite(length) && length > 0);

  if (lengths.length === 0) {
    return null;
  }

  const maxLength = Math.max(...lengths);
  return Math.ceil(maxLength * 0.8);
};

/**
 * Fetch course structure from API for streaming mode
 */
export async function fetchCourseStructure(
  shortname: string,
): Promise<StreamedCourseStructure> {
  try {
    if (!shortname || shortname.trim() === "") {
      throw new Error("Course shortname is required");
    }

    const apiPath = API_PATHS.COURSE_STRUCTURE(shortname);

    const response = await authenticatedGet<CourseStructureResponse>(apiPath);

    // Parse the structure JSON string
    const structureData = JSON.parse(response.structure);
    const moduleData = structureData.module;

    // Extract server URL and metadata
    const server = moduleData.meta.server;
    const title = moduleData.meta.title?.["#text"] || moduleData.meta.title;
    const version = moduleData.meta.versionid;

    // Parse sections
    const sections: StreamedSection[] = [];
    let sectionIndex = 0;

    // First, check for activities in meta section (e.g., pre-test)
    // These should be added before structure activities
    if (moduleData.meta?.activity) {
      const metaActivities = Array.isArray(moduleData.meta.activity)
        ? moduleData.meta.activity
        : [moduleData.meta.activity];

      for (const activity of metaActivities) {
        const activityTitle =
          activity.title?.["#text"] || activity.title || "Untitled Activity";
        const activityType = activity["@type"] || "page";
        const digest = activity["@digest"] || "";
        const htmlFile = activity.location?.["#text"];

        // Extract media files for this activity
        const mediaFiles: StreamedMedia[] = [];
        if (activity.media?.file) {
          const files = Array.isArray(activity.media.file)
            ? activity.media.file
            : [activity.media.file];

          for (const file of files) {
            mediaFiles.push({
              filename: file["@filename"],
              digest: file["@digest"],
              filesize: file["@filesize"],
              downloadUrl: file["@download_url"],
              length: file["@length"],
            });
          }
        }

        // Parse quiz/feedback content if present
        let content = null;
        if (activity.content?.["#text"]) {
          try {
            content = JSON.parse(activity.content["#text"]);
          } catch (e) {}
        }

        // For meta activities, we don't have a sectionOrder or sectionTitle
        // They're standalone activities (like pre-test)
        const activityTimeAttr =
          activity["@activity_time"] || activity["@activity-time"];
        const mediaActivityTime = getMediaActivityTimeSeconds(mediaFiles);
        const activityTime =
          mediaActivityTime ??
          (activityTimeAttr ? parseInt(activityTimeAttr, 10) : 3);

        sections.push({
          id: `meta_${sectionIndex}`,
          order: sectionIndex,
          type: activityType,
          title: activityTitle,
          sectionTitle: undefined, // Meta activities don't belong to a section
          sectionOrder: undefined, // Meta activities don't have a section order
          htmlFile,
          digest,
          quizData: content, // Use quizData for compatibility
          content,
          mediaFiles,
          activityTime,
        });

        sectionIndex++;
      }
    }

    if (moduleData.structure?.section) {
      const sectionsArray = Array.isArray(moduleData.structure.section)
        ? moduleData.structure.section
        : [moduleData.structure.section];

      let sectionOrderCounter = 1; // Track section order (1-based for lessons)

      for (const section of sectionsArray) {
        const sectionTitle =
          section.title?.["#text"] || section.title || "Untitled Section";
        const sectionPassword =
          section["@password"] || section.password || undefined;
        const activities = section.activities?.activity;
        const activitiesArray = Array.isArray(activities)
          ? activities
          : activities
            ? [activities]
            : [];

        for (const activity of activitiesArray) {
          const activityTitle =
            activity.title?.["#text"] || activity.title || "Untitled Activity";
          const activityType = activity["@type"] || "page";
          const digest = activity["@digest"] || "";
          const htmlFile = activity.location?.["#text"];

          // Extract media files for this activity
          const mediaFiles: StreamedMedia[] = [];
          if (activity.media?.file) {
            const files = Array.isArray(activity.media.file)
              ? activity.media.file
              : [activity.media.file];

            for (const file of files) {
              mediaFiles.push({
                filename: file["@filename"],
                digest: file["@digest"],
                filesize: file["@filesize"],
                downloadUrl: file["@download_url"],
                length: file["@length"],
              });
            }
          }

          // Parse quiz/feedback content if present
          let content = null;
          if (activity.content?.["#text"]) {
            try {
              content = JSON.parse(activity.content["#text"]);
            } catch (e) {}
          }

          const activityTimeAttr =
            activity["@activity_time"] || activity["@activity-time"];
          const mediaActivityTime = getMediaActivityTimeSeconds(mediaFiles);
          const activityTime =
            mediaActivityTime ??
            (activityTimeAttr ? parseInt(activityTimeAttr, 10) : 3);

          sections.push({
            id: `${sectionOrderCounter}_${
              sectionIndex - (sectionOrderCounter - 1) * activitiesArray.length
            }`,
            order: sectionIndex,
            type: activityType,
            title: activityTitle,
            sectionTitle,
            sectionOrder: sectionOrderCounter,
            htmlFile,
            digest,
            quizData: content, // Use quizData for compatibility
            content,
            mediaFiles,
            password: sectionPassword, // Store password for all activities in this section
            activityTime,
          });

          sectionIndex++;
        }

        sectionOrderCounter++; // Increment after processing all activities in a section
      }
    }

    // Extract global media files
    const media: StreamedMedia[] = [];
    if (moduleData.media?.file) {
      const files = Array.isArray(moduleData.media.file)
        ? moduleData.media.file
        : [moduleData.media.file];

      for (const file of files) {
        media.push({
          filename: file["@filename"],
          digest: file["@digest"],
          filesize: file["@filesize"],
          downloadUrl: file["@download_url"],
          length: file["@length"],
        });
      }
    }

    // Extract sequencing type from meta
    const sequencing = (moduleData.meta?.sequencing ||
      "none") as SequencingType;

    return {
      id: response.id,
      shortname: response.shortname,
      server,
      title,
      version: parseInt(version, 10),
      sections,
      media,
      totalPages: sections.length,
      sequencing,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Process HTML content to fix relative URLs for streaming mode
 * Proxy: CSS, JS, anchor links, inline url(). Direct server (no proxy): images, video, audio, poster.
 */
function processHtmlForStreaming(
  html: string,
  shortname: string,
  server: string,
): string {
  const baseUrl = `/media/courses/${shortname}/`;
  const serverBase = server.replace(/\/$/, "");
  const serverMediaBase = `${serverBase}/media/courses/${shortname}/`;

  // Process the HTML to fix relative URLs
  let processedHtml = html;

  // Moodle placeholder: replace @@PLUGINFILE@@ with course media base URL (so feedback HTML images etc. load)
  processedHtml = processedHtml.replace(/@@PLUGINFILE@@/g, baseUrl);

  // Fix stylesheet links (proxy)
  processedHtml = processedHtml.replace(
    /(<link[^>]+href=["'])(?!https?:\/\/|\/\/|\/|data:)([^"']+)(["'])/gi,
    `$1${baseUrl}$2$3`,
  );

  // Fix script sources (proxy)
  processedHtml = processedHtml.replace(
    /(<script[^>]+src=["'])(?!https?:\/\/|\/\/|\/|data:)([^"']+)(["'])/gi,
    `$1${baseUrl}$2$3`,
  );

  // Fix image sources: direct server URL (no proxy)
  // Map any relative or non-absolute img src to the streaming server media base,
  // preserving the path exactly as in the HTML (e.g. images/foo.png).
  processedHtml = processedHtml.replace(
    /(<img[^>]+src=["'])(?!https?:\/\/|\/\/|data:|blob:)([^"']+)(["'])/gi,
    (m, p1, p2, p3) => {
      const original = p2;
      const final = `${serverMediaBase}${p2.replace(/^\//, "")}`;
      return `${p1}${final}${p3}`;
    },
  );

  // Fix video sources: direct server URL (no proxy)
  processedHtml = processedHtml.replace(
    /(<video[^>]+src=["'])(?!https?:\/\/|\/\/|data:|blob:)([^"']+)(["'])/gi,
    (m, p1, p2, p3) => {
      const original = p2;
      const final = `${serverMediaBase}${p2.replace(/^\//, "")}`;
      return `${p1}${final}${p3}`;
    },
  );

  // Fix source elements (for video/audio): direct server URL (no proxy)
  processedHtml = processedHtml.replace(
    /(<source[^>]+src=["'])(?!https?:\/\/|\/\/|data:|blob:)([^"']+)(["'])/gi,
    (m, p1, p2, p3) => {
      const original = p2;
      const final = `${serverMediaBase}${p2.replace(/^\//, "")}`;
      return `${p1}${final}${p3}`;
    },
  );

  // Fix audio sources: direct server URL (no proxy)
  processedHtml = processedHtml.replace(
    /(<audio[^>]+src=["'])(?!https?:\/\/|\/\/|data:|blob:)([^"']+)(["'])/gi,
    (m, p1, p2, p3) => {
      const original = p2;
      const final = `${serverMediaBase}${p2.replace(/^\//, "")}`;
      return `${p1}${final}${p3}`;
    },
  );

  // --- Additional fixes ---
  // Helper to build and encode media URLs
  function buildMediaUrl(base: string, path: string) {
    const cleaned = path.replace(/^\.\//, "");
    // encodeURI keeps slashes but encodes spaces and special characters
    return encodeURI(base + cleaned);
  }

  // Handle leading-slash image paths (e.g. "/pluginfile.php/...")
  processedHtml = processedHtml.replace(
    /(<img[^>]+src=["'])(\/(?!media\/)[^"']+)(["'])/gi,
    (match, p1, p2, p3) => `${p1}${encodeURI(serverBase + p2)}${p3}`,
  );

  // Ensure any remaining relative img/src and source/src are encoded and use serverMediaBase
  processedHtml = processedHtml.replace(
    /(<img[^>]+src=["'])(?!https?:\/\/|\/\/|data:|blob:|\/)([^"']+)(["'])/gi,
    (m, p1, p2, p3) => `${p1}${buildMediaUrl(serverMediaBase, p2)}${p3}`,
  );
  processedHtml = processedHtml.replace(
    /(<source[^>]+src=["'])(?!https?:\/\/|\/\/|data:|blob:|\/)([^"']+)(["'])/gi,
    (m, p1, p2, p3) => `${p1}${buildMediaUrl(serverMediaBase, p2)}${p3}`,
  );

  // Rewrite srcset attributes (multiple comma-separated URLs)
  processedHtml = processedHtml.replace(
    /srcset=["']([^"']+)["']/gi,
    (m, val) => {
      const rewritten = val
        .split(",")
        .map((item: string) => {
          const parts = item.trim().split(/\s+/);
          const url = parts[0];
          const desc = parts[1] ? ` ${parts[1]}` : "";
          if (!/^(https?:)?\/\/|data:|blob:/.test(url)) {
            const newUrl = url.startsWith("/")
              ? encodeURI(serverBase + url)
              : buildMediaUrl(serverMediaBase, url);
            return `${newUrl}${desc}`;
          }
          return item.trim();
        })
        .join(", ");
      return `srcset="${rewritten}"`;
    },
  );

  // Handle lazy-loading attributes like data-src, data-original-src, data-srcset
  processedHtml = processedHtml.replace(
    /(data-src|data-original-src|data-srcset)=["'](?!https?:\/\/|\/\/|data:|blob:)([^"']+)["']/gi,
    (m, attr, url) => {
      const newUrl = url.startsWith("/")
        ? encodeURI(serverBase + url)
        : buildMediaUrl(serverMediaBase, url);
      return `${attr}="${newUrl}"`;
    },
  );

  // Normalization fallback:
  // 1. Collapse accidental double slashes after course media base
  const doubleSlashPattern = `/media/courses/${shortname}//`;
  if (processedHtml.includes(doubleSlashPattern)) {
    processedHtml = processedHtml
      .split(doubleSlashPattern)
      .join(`/media/courses/${shortname}/`);
  }

  // 2. If image URLs were rewritten to the course root (no subfolder), try inserting `images/`
  //    e.g. /media/courses/shortname/mom-front.png -> /media/courses/shortname/images/mom-front.png
  try {
    const escapedBase = serverMediaBase.replace(
      /[-/\\^$*+?.()|[\]{}]/g,
      "\\$&",
    );
    const rootFileRegex = new RegExp(
      `${escapedBase}(?!images/)([^"'\\s>]+)`,
      "gi",
    );
    processedHtml = processedHtml.replace(rootFileRegex, (match, filename) => {
      // Don't modify if filename already contains a path separator
      if (filename.includes("/")) return match;
      return `${serverMediaBase}images/${filename}`;
    });
  } catch (e) {}

  // Fix anchor hrefs for resources (proxy, not for /video/ paths which are handled separately)
  processedHtml = processedHtml.replace(
    /(<a[^>]+href=["'])(?!https?:\/\/|\/\/|\/|#|mailto:|tel:|data:)([^"']+)(["'])/gi,
    (match, prefix, url, suffix) => {
      if (url.includes("/video/") || url.includes("/audio/")) {
        return match;
      }
      return `${prefix}${baseUrl}${url}${suffix}`;
    },
  );

  // Fix CSS url() references in inline styles (proxy)
  processedHtml = processedHtml.replace(
    /url\(["']?(?!https?:\/\/|\/\/|\/|data:|blob:)([^"')]+)["']?\)/gi,
    `url("${baseUrl}$1")`,
  );

  // Fix poster attributes on video elements: direct server URL (no proxy)
  processedHtml = processedHtml.replace(
    /(<video[^>]+poster=["'])(?!https?:\/\/|\/\/|\/|data:|blob:)([^"']+)(["'])/gi,
    `$1${serverMediaBase}$2$3`,
  );

  return processedHtml;
}

/**
 * Fetch HTML content from server for streaming
 */
export async function fetchHtmlContent(
  server: string,
  shortname: string,
  htmlFile: string,
): Promise<string> {
  try {
    // Try Next.js proxy first (works in dev and production with rewrites)
    // Use cache: 'no-store' to ensure fresh content is always fetched (no browser cache)
    const proxyUrl = `/media/courses/${shortname}/${htmlFile}`;

    let response = await fetch(proxyUrl, {
      cache: "no-store", // Always fetch fresh content, bypass browser cache
    });

    // If proxy fails (e.g., in static export), try direct server URL
    if (!response.ok) {
      const directUrl = `${server}/media/courses/${shortname}/${htmlFile}`;
      response = await fetch(directUrl, {
        cache: "no-store", // Always fetch fresh content, bypass browser cache
      });
    }

    if (!response.ok) {
      throw new Error(
        `Failed to fetch HTML: ${response.status} ${response.statusText}`,
      );
    }

    const content = await response.text();

    // Process HTML to fix relative URLs

    const processedContent = processHtmlForStreaming(
      content,
      shortname,
      server,
    );
    return processedContent;
  } catch (error) {
    logStreamingApiFailure("fetchHtmlContent", error, {
      endpoint: `/api/proxy-html?server=${encodeURIComponent(server)}&course=${encodeURIComponent(shortname)}&file=${encodeURIComponent(htmlFile)}`,
      server,
      shortname,
      htmlFile,
    });
    throw error;
  }
}

/**
 * Prefetch multiple HTML files in background
 */
export async function prefetchHtmlFiles(
  server: string,
  shortname: string,
  htmlFiles: string[],
): Promise<Map<string, string>> {
  const cache = new Map<string, string>();

  const fetchPromises = htmlFiles.map(async (htmlFile) => {
    try {
      const content = await fetchHtmlContent(server, shortname, htmlFile);
      cache.set(htmlFile, content);
    } catch (error) {}
  });

  await Promise.all(fetchPromises);
  return cache;
}
