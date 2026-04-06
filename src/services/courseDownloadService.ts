import JSZip from "jszip";
import {
  storeCourse,
  isCourseDownloaded as checkIDB,
  initDB,
} from "@/utils/courseStorageIDB";
import {
  parseMediaFromXml,
  downloadMedia,
  type Media,
} from "./mediaDownloadService";
import { activityTrackingService } from "@/services/activityTrackingService";
import { parseActivityTrackingXML } from "@/types/activityTracking";
import { useActivityCompletionStore } from "@/store/useStore";
import { analytics } from "@/lib/analytics";
import { getLocalizedText } from "@/utils/localization";

/**
 * Extract all resource URLs from HTML (scripts, stylesheets, etc.)
 */
function extractResourcesFromHtml(html: string, baseUrl: string): string[] {
  const resources: string[] = [];

  // Extract script src
  const scriptMatches = html.matchAll(/<script[^>]+src=["']([^"']+)["']/g);
  for (const match of scriptMatches) {
    resources.push(match[1]);
  }

  // Extract link href (stylesheets, preload, etc.)
  const linkMatches = html.matchAll(/<link[^>]+href=["']([^"']+)["']/g);
  for (const match of linkMatches) {
    const href = match[1];
    // Only include stylesheets and preload resources
    if (href.includes(".css") || href.includes("/_next/")) {
      resources.push(href);
    }
  }

  // Convert relative URLs to absolute
  return resources.map((url) => {
    if (url.startsWith("http")) return url;
    if (url.startsWith("/")) return `${baseUrl}${url}`;
    return url;
  });
}

/**
 * Cache actual Next.js course pages for offline access
 * The pages will be cached by the Service Worker when the user visits them
 * This function just ensures the cache exists and is ready
 */
async function cacheCoursePages(
  courseId: number,
  shortname: string,
  structure: any,
): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) {
    console.warn("[cacheCoursePages] Caches API not available");
    return;
  }

  try {
    const cacheName = `noora-courses-${courseId}`;

    // Create the cache so it's ready for the Service Worker to use
    await caches.open(cacheName);
  } catch (error) {
    console.error("[cacheCoursePages] Error creating cache:", error);
    // Non-fatal - Service Worker will create it when needed
  }
}

export type SequencingType =
  | "none"
  | "sequencingThroughSection"
  | "sequencingThroughActivity"
  | "section"
  | "course";

export interface CourseStructure {
  id: number;
  title: string;
  shortname: string;
  version: number;
  sections: CourseSection[];
  totalPages: number;
  sequencing?: SequencingType;
}

export interface CourseSection {
  id: string;
  title: string;
  sectionTitle?: string;
  sectionOrder?: number;
  order: number;
  type: "page" | "quiz" | "activity" | "feedback";
  htmlFile?: string;
  quizData?: any;
  content?: any;
  digest?: string;
  password?: string;
  activityTime?: number;
  mediaFiles?: CourseMediaFile[];
}

export interface CourseMediaFile {
  filename: string;
  digest?: string;
  filesize?: string;
  downloadUrl?: string;
  length?: string;
}

const getMediaFilesFromActivity = (activityEl: Element): CourseMediaFile[] => {
  const fileElements = activityEl.querySelectorAll("media > file");

  return Array.from(fileElements)
    .map((fileEl) => ({
      filename: fileEl.getAttribute("filename") || "",
      digest: fileEl.getAttribute("digest") || "",
      filesize: fileEl.getAttribute("filesize") || "",
      downloadUrl: fileEl.getAttribute("download_url") || "",
      length: fileEl.getAttribute("length") || "",
    }))
    .filter((file) => file.filename);
};

const getMediaActivityTimeSeconds = (
  mediaFiles: CourseMediaFile[],
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

export interface CoursePackage {
  id: number;
  shortname: string;
  version: number;
  downloadedAt: string;
  files: Map<string, string>;
  structure: CourseStructure;
}

class CourseDownloadService {
  private readonly STORAGE_KEY = "noorahealth_courses";
  private courses: Map<string, CoursePackage> = new Map();
  // Track active controllers so downloads can be cancelled by courseId
  private controllers: Map<number, AbortController> = new Map();

  constructor() {
    if (typeof window !== "undefined") {
      this.loadFromLocalStorage();
    }
  }

  /**
   * Download and extract a course package with progress tracking
   */
  async downloadCourseWithProgress(
    url: string,
    courseId: number,
    shortname: string,
    version: number,
    onProgress: (phase: string, progress: number, message: string) => void,
    isDownloaded: boolean = false,
    controller?: AbortController,
  ): Promise<CoursePackage> {
    try {
      // If a controller is provided, track it so callers can cancel by courseId
      if (controller) {
        this.controllers.set(courseId, controller);
      }
      // Phase 1: Download (0-50%)
      onProgress("downloading", 0, "Starting download...");

      const fetchOptions: RequestInit = {};
      if (controller) {
        fetchOptions.signal = controller.signal;
      }
      const response = await fetch(url, fetchOptions);
      if (!response.ok) {
        throw new Error(`Failed to download course: ${response.statusText}`);
      }

      const contentLength = response.headers.get("content-length");
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      if (!response.body) {
        throw new Error("Response body is null");
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      // Read the response stream with progress
      while (true) {
        // If the controller signal was aborted, cancel the reader and throw
        if (controller?.signal?.aborted) {
          try {
            await reader.cancel();
          } catch (err) {}
          throw new DOMException("Download aborted", "AbortError");
        }
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        if (total > 0) {
          const downloadProgress = Math.floor((receivedLength / total) * 50); // 0-50%
          onProgress(
            "downloading",
            downloadProgress,
            `Downloading... ${Math.floor((receivedLength / total) * 100)}%`,
          );
        }
      }

      // Combine chunks into a single blob
      const blob = new Blob(chunks as BlobPart[]);
      onProgress("downloading", 50, "Download complete");

      // Phase 2: Installation (50-100%)
      onProgress("installing", 51, "Extracting course files...");

      // Extract the ZIP
      const zip = await JSZip.loadAsync(blob);
      const blobArrayBuffer = await blob.arrayBuffer();
      const files = new Map<string, string>();

      onProgress("installing", 60, "Processing course content...");

      // Extract all files sequentially so cancellation can be respected during extraction
      const filenames = Object.keys(zip.files);
      for (let fi = 0; fi < filenames.length; fi++) {
        // Allow cancellation between files
        if (controller?.signal?.aborted) {
          throw new DOMException("Download aborted", "AbortError");
        }
        const filename = filenames[fi];
        const file = zip.files[filename];

        if (!file.dir) {
          // Handle different file types
          try {
            if (filename.endsWith(".html")) {
              const content = await file.async("text");
              files.set(filename, content);
            } else if (filename.endsWith(".xml")) {
              const content = await file.async("text");
              files.set(filename, content);
            } else if (filename.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) {
              const content = await file.async("base64");
              files.set(
                filename,
                `data:image/${filename.split(".").pop()};base64,${content}`,
              );
            } else if (filename.match(/\.(mp4|webm|ogg)$/i)) {
              const content = await file.async("base64");
              files.set(
                filename,
                `data:video/${filename.split(".").pop()};base64,${content}`,
              );
            } else if (filename.match(/\.(mp3|wav|ogg)$/i)) {
              const content = await file.async("base64");
              files.set(
                filename,
                `data:audio/${filename.split(".").pop()};base64,${content}`,
              );
            } else {
              // For other files, store as text or base64
              try {
                const content = await file.async("text");
                files.set(filename, content);
              } catch {
                const content = await file.async("base64");
                files.set(filename, content);
              }
            }
          } catch (err) {
            // If extraction of a specific file errors and controller aborted, propagate abort
            if (controller?.signal?.aborted) {
              throw new DOMException("Download aborted", "AbortError");
            }
          }
        }
      }

      onProgress("installing", 70, "Parsing course structure...");

      // Parse the course structure from module.xml
      const structure = this.parseModuleXml(
        files,
        courseId,
        shortname,
        version,
      );

      onProgress("installing", 80, "Saving course to database...");

      // Create course package
      const coursePackage: CoursePackage = {
        id: courseId,
        shortname,
        version,
        downloadedAt: new Date().toISOString(),
        files,
        structure,
      };

      // Store in IndexedDB
      try {
        await storeCourse(
          courseId.toString(),
          shortname,
          version,
          blobArrayBuffer,
          structure,
          isDownloaded,
        );

        if (isDownloaded) {
          try {
            const { markCourseAsDownloaded } =
              await import("@/utils/courseStorageIDB");
            await markCourseAsDownloaded(courseId.toString());
          } catch (markErr) {} // Non-critical if marking fails, course is still stored
        }
        onProgress("installing", 90, "Creating indexes...");

        // Parse tracker.xml from the extracted course package - contains all activity tracking data
        try {
          // Look for tracker.xml in the files map (exact or with path)
          let trackerXml = files.get("tracker.xml");
          if (!trackerXml) {
            for (const [key, value] of files.entries()) {
              if (key.endsWith("tracker.xml")) {
                trackerXml = value;
                break;
              }
            }
          }

          if (trackerXml) {
            try {
              const trackingResponse = parseActivityTrackingXML(trackerXml);
              const trackerCompletionMap =
                activityTrackingService.createCompletionMap(trackingResponse);
              // Only populate Zustand from tracker.xml if no data exists yet.
              // If Zustand already has data (even empty from a reset), don't
              // overwrite — the existing state is authoritative.
              try {
                const store = useActivityCompletionStore.getState();
                const cid = String(courseId);
                const existingMap = store.getCompletionData(cid);
                if (existingMap !== null) {
                  // Zustand already has data — skip stale tracker.xml
                } else {
                  store.setCompletionData(cid, trackerCompletionMap);
                }
              } catch (storeErr) {}
            } catch (parseErr) {}
          }
        } catch (trackerErr) {}
      } catch (idbError: unknown) {
        if (
          idbError instanceof Error &&
          idbError.name === "QuotaExceededError"
        ) {
          throw idbError;
        }
        // Fall back to localStorage for other errors
        const courseKey = `${courseId}_${version}`;
        this.courses.set(courseKey, coursePackage);
        this.saveToLocalStorage();
      }

      onProgress("installing", 95, "Finalizing installation...");

      // ✅ NEW: Cache course pages for offline access
      try {
        await cacheCoursePages(courseId, shortname, structure);
      } catch (pagesCacheError) {
        console.warn(
          "[downloadCourseWithProgress] Failed to cache course pages (non-fatal):",
          pagesCacheError,
        );
        // Continue - course still works with IndexedDB + app shell fallback
      }

      try {
        // module.xml is extracted from ZIP as "module.xml" or with path
        let moduleXml = files.get("module.xml");

        // If not found, try to find it with a path prefix
        if (!moduleXml) {
          for (const [key, value] of files.entries()) {
            if (key.endsWith("module.xml") || key === "module.xml") {
              moduleXml = value;
              break;
            }
          }
        }

        if (moduleXml) {
          const mediaMetadata = parseMediaFromXml(moduleXml);

          if (mediaMetadata.length > 0) {
            onProgress(
              "installing",
              96,
              `Downloading ${mediaMetadata.length} media file(s)...`,
            );

            // Download media files with progress
            let completedMedia = 0;
            let failedMedia = 0;

            for (let i = 0; i < mediaMetadata.length; i++) {
              // Allow cancellation between media downloads
              if (controller?.signal?.aborted) {
                throw new DOMException("Download aborted", "AbortError");
              }
              const mediaFile = mediaMetadata[i];
              const mediaFileName =
                mediaFile.filename.length > 30
                  ? mediaFile.filename.substring(0, 27) + "..."
                  : mediaFile.filename;

              const media: Media = {
                ...mediaFile,
                courses: [courseId.toString()],
                downloading: false,
                downloaded: false,
                failed: false,
                progress: 0,
              };

              try {
                onProgress(
                  "installing",
                  96 + Math.floor((i / mediaMetadata.length) * 3),
                  `Downloading ${mediaFileName}...`,
                );

                const downloadSuccess = await downloadMedia(
                  courseId.toString(),
                  media,
                  (progress) => {},
                );

                if (downloadSuccess) {
                  completedMedia++;
                } else {
                  failedMedia++;
                }

                onProgress(
                  "installing",
                  96 + Math.floor(((i + 1) / mediaMetadata.length) * 3),
                  `Downloaded ${completedMedia}/${mediaMetadata.length} media files`,
                );
              } catch (error) {
                failedMedia++;
              }
            }

            if (completedMedia > 0) {
              onProgress(
                "installing",
                99,
                `✓ Downloaded ${completedMedia} media file(s)`,
              );
            }

            if (failedMedia > 0) {
            }

            // Track course download completion with media count
            analytics.trackEvent("course_downloaded", {
              course_id: courseId,
              course_shortname: shortname,
              course_version: version,
              media_files: completedMedia,
              media_failed: failedMedia,
            });
          } else {
            // Track course download completion without media
            analytics.trackEvent("course_downloaded", {
              course_id: courseId,
              course_shortname: shortname,
              course_version: version,
              media_files: 0,
            });
          }
        } else {
          // Track course download completion
          analytics.trackEvent("course_downloaded", {
            course_id: courseId,
            course_shortname: shortname,
            course_version: version,
            media_files: 0,
          });
        }
      } catch (error) {
        // Don't fail the entire course download if media download fails

        // Track course download completion (with error note)
        analytics.trackEvent("course_downloaded", {
          course_id: courseId,
          course_shortname: shortname,
          course_version: version,
          media_files: 0,
          media_download_error: true,
        });
      }

      // Small delay for UI feedback
      await new Promise((resolve) => setTimeout(resolve, 300));

      onProgress("complete", 100, "Course installed successfully!");

      // Cleanup controller tracking
      if (controller) {
        this.controllers.delete(courseId);
      }
      return coursePackage;
    } catch (error) {
      // Cleanup controller tracking on error/abort
      if (controller) {
        this.controllers.delete(courseId);
      }
      onProgress(
        "error",
        0,
        error instanceof Error ? error.message : "Download failed",
      );
      throw error;
    }
  }

  async downloadCourse(
    url: string,
    courseId: number,
    shortname: string,
    version: number,
    isDownloaded: boolean = false,
  ): Promise<CoursePackage> {
    try {
      // Download the ZIP file
      const response = await fetch(url);

      if (!response.ok) {
        // Try to get error body for more details
        let errorBody = "";
        try {
          errorBody = await response.text();
        } catch (e) {}
        throw new Error(
          `Failed to download course: ${response.status} ${
            response.statusText
          }${errorBody ? ` - ${errorBody}` : ""}`,
        );
      }

      const blob = await response.blob();

      // Extract the ZIP
      const zip = await JSZip.loadAsync(blob);
      const blobArrayBuffer = await blob.arrayBuffer();
      const files = new Map<string, string>();

      // Extract all files
      const filePromises = Object.keys(zip.files).map(async (filename) => {
        const file = zip.files[filename];

        if (!file.dir) {
          // Handle different file types
          if (filename.endsWith(".html")) {
            const content = await file.async("text");
            files.set(filename, content);
          } else if (filename.endsWith(".xml")) {
            const content = await file.async("text");
            files.set(filename, content);
          } else if (filename.endsWith(".css")) {
            // CSS files - store as text for inlining
            const content = await file.async("text");
            files.set(filename, content);
          } else if (filename.endsWith(".js")) {
            // JavaScript files - store as text for inlining
            const content = await file.async("text");
            files.set(filename, content);
          } else if (filename.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) {
            const content = await file.async("base64");
            files.set(
              filename,
              `data:image/${filename.split(".").pop()};base64,${content}`,
            );
          } else if (filename.match(/\.(mp4|webm|ogg)$/i)) {
            const content = await file.async("base64");
            files.set(
              filename,
              `data:video/${filename.split(".").pop()};base64,${content}`,
            );
          } else if (filename.match(/\.(mp3|wav|ogg)$/i)) {
            const content = await file.async("base64");
            files.set(
              filename,
              `data:audio/${filename.split(".").pop()};base64,${content}`,
            );
          } else if (filename.match(/\.(woff|woff2|ttf|eot|otf)$/i)) {
            // Font files - store as base64
            const content = await file.async("base64");
            const ext = filename.split(".").pop()?.toLowerCase();
            const mimeTypes: { [key: string]: string } = {
              woff: "font/woff",
              woff2: "font/woff2",
              ttf: "font/ttf",
              eot: "application/vnd.ms-fontobject",
              otf: "font/otf",
            };
            files.set(
              filename,
              `data:${mimeTypes[ext || "woff"]};base64,${content}`,
            );
          } else {
            // For other files, store as text or base64
            try {
              const content = await file.async("text");
              files.set(filename, content);
            } catch {
              const content = await file.async("base64");
              files.set(filename, content);
            }
          }
        }
      });

      await Promise.all(filePromises);

      // Parse the course structure from module.xml
      const structure = this.parseModuleXml(
        files,
        courseId,
        shortname,
        version,
      );

      // Create course package
      const coursePackage: CoursePackage = {
        id: courseId,
        shortname,
        version,
        downloadedAt: new Date().toISOString(),
        files,
        structure,
      };

      // Store in IndexedDB
      try {
        await storeCourse(
          courseId.toString(),
          shortname,
          version,
          blobArrayBuffer, // Pass the ArrayBuffer
          structure,
          isDownloaded,
        );
      } catch (idbError: any) {
        // Check if it's a quota exceeded error
        if (idbError.name === "QuotaExceededError") {
          // Re-throw the enhanced error from storeCourse
          throw idbError;
        }

        // Fall back to localStorage for other errors
        const courseKey = `${courseId}_${version}`;
        this.courses.set(courseKey, coursePackage);
        this.saveToLocalStorage();
      }

      return coursePackage;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Parse module.xml to extract course structure
   */
  private parseModuleXml(
    files: Map<string, string>,
    courseId: number,
    shortname: string,
    version: number,
  ): CourseStructure {
    // Try to find module.xml - it might be at root or in a subfolder
    let moduleXml: string | undefined;
    let moduleXmlPath: string | undefined;

    // First try exact match
    moduleXml = files.get("module.xml");
    if (moduleXml) {
      moduleXmlPath = "module.xml";
    } else {
      // Try to find module.xml in any subfolder
      for (const [path, content] of files.entries()) {
        if (path.endsWith("module.xml") || path.endsWith("/module.xml")) {
          moduleXml = content;
          moduleXmlPath = path;
          break;
        }
      }
    }

    if (!moduleXml) {
      // Fallback: generate structure from HTML files
      return this.generateStructureFromFiles(
        files,
        courseId,
        shortname,
        version,
      );
    }

    try {
      // Parse XML
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(moduleXml, "text/xml");

      const parseError = xmlDoc.querySelector("parsererror");
      if (parseError) {
        throw new Error("XML parsing failed");
      }

      // Get course title
      const titleElement = xmlDoc.querySelector("meta > title");
      const courseTitle = titleElement?.textContent || shortname;

      // Get sequencing type from meta
      const sequencingElement = xmlDoc.querySelector("meta > sequencing");
      const sequencing = (sequencingElement?.textContent ||
        "none") as SequencingType;

      // Get all sections
      const sectionElements = xmlDoc.querySelectorAll("structure > section");
      const sections: CourseSection[] = [];

      // First, check for activities in meta section (e.g., pre-test)
      // These should be added before structure activities
      const metaActivityElements = xmlDoc.querySelectorAll("meta > activity");
      let metaActivityOrder = 0;
      metaActivityElements.forEach((activityEl) => {
        const activityType = activityEl.getAttribute("type") || "page";
        const activityOrder =
          activityEl.getAttribute("order") || String(metaActivityOrder);
        const activityDigest = activityEl.getAttribute("digest") || "";
        const activityTimeAttr = activityEl.getAttribute("activity_time");
        const mediaFiles = getMediaFilesFromActivity(activityEl);
        const mediaActivityTime = getMediaActivityTimeSeconds(mediaFiles);
        const activityTime =
          mediaActivityTime ??
          (activityTimeAttr ? parseInt(activityTimeAttr, 10) : 3);
        const activityTitleEl = activityEl.querySelector("title");
        const activityTitle =
          activityTitleEl?.textContent || `Activity ${activityOrder}`;
        const locationEl = activityEl.querySelector("location");
        let location = locationEl?.textContent?.trim() || "";

        // Extract quiz/feedback data from JSON content
        let quizDataObject = null;
        if (activityType === "quiz" || activityType === "feedback") {
          const contentEl = activityEl.querySelector("content");
          const contentJson = contentEl?.textContent?.trim();

          if (contentJson) {
            try {
              quizDataObject = JSON.parse(contentJson);

              // Look for htmlfile in the questions (only if location is empty)
              if (
                !location &&
                quizDataObject.questions &&
                quizDataObject.questions.length > 0
              ) {
                const firstQuestion = quizDataObject.questions[0];
                if (
                  firstQuestion.question &&
                  firstQuestion.question.props &&
                  firstQuestion.question.props.htmlfile
                ) {
                  const htmlfileJson = firstQuestion.question.props.htmlfile;
                  // Parse the nested JSON (it's a JSON string containing language-specific files)
                  const htmlfiles = JSON.parse(htmlfileJson);
                  // Get localized file (en, kn, etc. - any language key)
                  location = getLocalizedText(htmlfiles, "") || "";
                }
              }
            } catch (error) {}
          }
        }

        sections.push({
          id: `meta_${metaActivityOrder}`,
          title: activityTitle,
          sectionTitle: undefined, // Meta activities don't belong to a section
          sectionOrder: undefined, // Meta activities don't have a section order
          order: parseInt(activityOrder),
          type: activityType as "page" | "quiz" | "activity" | "feedback",
          htmlFile: location,
          quizData: quizDataObject, // Store quiz data for rendering
          digest: activityDigest, // Store digest for completion tracking
          activityTime, // seconds to consider this activity complete
          mediaFiles: mediaFiles.length > 0 ? mediaFiles : undefined,
        });

        metaActivityOrder++;
      });

      sectionElements.forEach((sectionEl, sectionIndex) => {
        const sectionOrder =
          sectionEl.getAttribute("order") || String(sectionIndex + 1);
        const sectionPassword = sectionEl.getAttribute("password") || undefined;
        const sectionTitleEl = sectionEl.querySelector("title");
        const sectionTitle =
          sectionTitleEl?.textContent || `Section ${sectionOrder}`;

        // Get all activities in this section
        const activityElements = sectionEl.querySelectorAll(
          "activities > activity",
        );

        activityElements.forEach((activityEl, activityIndex) => {
          const activityType = activityEl.getAttribute("type") || "page";
          const activityOrder =
            activityEl.getAttribute("order") || String(activityIndex + 1);
          const activityDigest = activityEl.getAttribute("digest") || "";
          const activityTimeAttr = activityEl.getAttribute("activity_time");
          const mediaFiles = getMediaFilesFromActivity(activityEl);
          const mediaActivityTime = getMediaActivityTimeSeconds(mediaFiles);
          const activityTime =
            mediaActivityTime ??
            (activityTimeAttr ? parseInt(activityTimeAttr, 10) : 3);
          const activityTitleEl = activityEl.querySelector("title");
          const activityTitle =
            activityTitleEl?.textContent || `Activity ${activityOrder}`;
          const locationEl = activityEl.querySelector("location");
          let location = locationEl?.textContent?.trim() || "";

          // Extract quiz/feedback data from JSON content
          let quizDataObject = null;
          if (activityType === "quiz" || activityType === "feedback") {
            const contentEl = activityEl.querySelector("content");
            const contentJson = contentEl?.textContent?.trim();

            if (contentJson) {
              try {
                quizDataObject = JSON.parse(contentJson);

                // Look for htmlfile in the questions (only if location is empty)
                if (
                  !location &&
                  quizDataObject.questions &&
                  quizDataObject.questions.length > 0
                ) {
                  const firstQuestion = quizDataObject.questions[0];
                  if (
                    firstQuestion.question &&
                    firstQuestion.question.props &&
                    firstQuestion.question.props.htmlfile
                  ) {
                    const htmlfileJson = firstQuestion.question.props.htmlfile;
                    // Parse the nested JSON (it's a JSON string containing language-specific files)
                    const htmlfiles = JSON.parse(htmlfileJson);
                    // Get the Kannada version (or first available)
                    location =
                      htmlfiles.kn || Object.values(htmlfiles)[0] || "";
                  }
                }
              } catch (error) {}
            }
          }

          sections.push({
            id: `${sectionOrder}_${activityOrder}`,
            title: activityTitle,
            sectionTitle: sectionTitle,
            sectionOrder: parseInt(sectionOrder),
            order: parseInt(activityOrder),
            type: activityType as "page" | "quiz" | "activity" | "feedback",
            htmlFile: location,
            quizData: quizDataObject, // Store quiz data for rendering
            digest: activityDigest, // Store digest for completion tracking
            password: sectionPassword, // Store password for all activities in this section
            activityTime, // seconds to consider this activity complete
            mediaFiles: mediaFiles.length > 0 ? mediaFiles : undefined,
          });
        });
      });

      return {
        id: courseId,
        title: courseTitle,
        shortname,
        version,
        sections,
        totalPages: sections.length,
        sequencing,
      };
    } catch (error) {
      // Fallback to file-based generation
      return this.generateStructureFromFiles(
        files,
        courseId,
        shortname,
        version,
      );
    }
  }

  /**
   * Generate course structure from files when XML is not available
   */
  private generateStructureFromFiles(
    files: Map<string, string>,
    courseId: number,
    shortname: string,
    version: number,
  ): CourseStructure {
    const sections: CourseSection[] = [];
    let order = 1;

    // Get all HTML files and organize them
    const htmlFiles = Array.from(files.keys())
      .filter(
        (f) =>
          f.endsWith(".html") &&
          !f.includes("response") &&
          !f.includes("feedback"),
      )
      .sort();

    htmlFiles.forEach((filename) => {
      const basename = filename.replace(".html", "").replace(/^.*\//, "");
      const isQuestion = filename.includes("question");

      sections.push({
        id: basename,
        title: this.generateTitleFromFilename(filename),
        order: order++,
        type: isQuestion ? "quiz" : "page",
        htmlFile: filename,
      });
    });

    return {
      id: courseId,
      title: shortname,
      shortname,
      version,
      sections,
      totalPages: sections.length,
    };
  }

  /**
   * Generate a readable title from filename
   */
  private generateTitleFromFilename(filename: string): string {
    const basename = filename.replace(".html", "").replace(/^.*\//, "");

    if (basename.includes("question")) {
      return `Quiz ${basename.split("_")[1] || ""}`;
    }

    return `Section ${basename.split("_")[0] || basename}`;
  }

  /**
   * Get a downloaded course
   */
  getCourse(courseId: number, version?: number): CoursePackage | null {
    if (version) {
      return this.courses.get(`${courseId}_${version}`) || null;
    }

    // Find latest version
    const courseKeys = Array.from(this.courses.keys())
      .filter((key) => key.startsWith(`${courseId}_`))
      .sort((a, b) => {
        const versionA = parseInt(a.split("_")[1]);
        const versionB = parseInt(b.split("_")[1]);
        return versionB - versionA;
      });

    return courseKeys.length > 0
      ? this.courses.get(courseKeys[0]) || null
      : null;
  }

  /**
   * Check if a course is downloaded
   */
  async isDownloadedAsync(
    courseId: number,
    version?: number,
  ): Promise<boolean> {
    // Check IndexedDB first
    const inIDB = await checkIDB(courseId.toString());
    if (inIDB) return true;

    // Fallback to localStorage/memory
    return this.getCourse(courseId, version) !== null;
  }

  isDownloaded(courseId: number, version?: number): boolean {
    return this.getCourse(courseId, version) !== null;
  }

  /**
   * Get file content from a course
   */
  getFileContent(
    courseId: number,
    filename: string,
    version?: number,
  ): string | null {
    const course = this.getCourse(courseId, version);
    return course ? course.files.get(filename) || null : null;
  }

  /**
   * Delete a downloaded course
   */
  deleteCourse(courseId: number, version?: number): void {
    if (version) {
      this.courses.delete(`${courseId}_${version}`);
    } else {
      // Delete all versions
      const keysToDelete = Array.from(this.courses.keys()).filter((key) =>
        key.startsWith(`${courseId}_`),
      );

      keysToDelete.forEach((key) => this.courses.delete(key));
    }

    this.saveToLocalStorage();
  }

  /**
   * Get all downloaded courses
   */
  getAllDownloadedCourses(): CoursePackage[] {
    return Array.from(this.courses.values());
  }

  /**
   * Save to localStorage (without file content to save space)
   */
  private saveToLocalStorage(): void {
    try {
      const courseMeta = Array.from(this.courses.entries()).map(
        ([key, pkg]) => ({
          key,
          id: pkg.id,
          shortname: pkg.shortname,
          version: pkg.version,
          downloadedAt: pkg.downloadedAt,
          structure: pkg.structure,
        }),
      );

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(courseMeta));
    } catch (error) {}
  }

  /**
   * Load from localStorage
   */
  private loadFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const courseMeta = JSON.parse(stored);
        // Note: File content is not persisted in localStorage due to size
        // In a real app, you might use IndexedDB for larger storage
      }
    } catch (error) {}
  }
}

// Export singleton instance
export const courseDownloadService = new CourseDownloadService();
