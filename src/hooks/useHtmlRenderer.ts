import { useRef, useEffect } from "react";
import {
  convertLinkedStylesToInline,
  convertExternalScriptsToInline,
  addResponsiveStyles,
  scopeInlineStyles,
  fixRelativeAssetUrls,
  fixNavigationButtons,
} from "@/utils/htmlRenderer";
import { initDB } from "@/utils/courseStorageIDB";
import { loadFileFromCourse } from "@/utils/courseLoaderIDB";
import { getMediaFromCache } from "@/utils/mediaCacheStorage";
import type { StreamingMediaFile } from "@/components/HtmlContentRenderer";

interface UseHtmlRendererProps {
  html: string;
  courseId?: string;
  mediaFiles?: StreamingMediaFile[];
  allCourseMedia?: StreamingMediaFile[];
  serverUrl?: string;
  shortname?: string;
  onOpenVideoModal: (url: string, title: string, posterUrl?: string) => void;
  onOpenUnavailableMediaModal: (
    name: string,
    type: "video" | "audio" | "pdf",
    downloadUrl?: string
  ) => void;
}

/**
 * Custom hook to handle HTML content rendering with all processing logic
 * Manages content wrapper, CSS/JS processing, and media link handling
 */
export function useHtmlRenderer({
  html,
  courseId,
  mediaFiles,
  allCourseMedia,
  serverUrl,
  shortname,
  onOpenVideoModal,
  onOpenUnavailableMediaModal,
}: UseHtmlRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Set the HTML content directly
    containerRef.current.innerHTML = html;

    // Wrap all content in a scoping div to isolate CSS
    const wrapper = document.createElement("div");
    wrapper.className = "moodle-content-wrapper";
    wrapper.style.cssText = `
      position: relative;
      isolation: isolate;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    `;

    while (containerRef.current.firstChild) {
      wrapper.appendChild(containerRef.current.firstChild);
    }
    containerRef.current.appendChild(wrapper);

    const getContentWrapper = () =>
      containerRef.current?.querySelector(
        ".moodle-content-wrapper"
      ) as HTMLElement | null;

    // Helper to normalize filename for comparison
    const normalizeFilename = (name: string): string => {
      return decodeURIComponent(name).toLowerCase().trim().replace(/\s+/g, " ");
    };

    // Get cached video from Cache Storage or IndexedDB
    const getCachedVideo = async (
      courseId: string,
      filename: string
    ): Promise<string | null> => {
      try {
        const cachedUrl = await getMediaFromCache(courseId, filename);
        if (cachedUrl) {
          return cachedUrl;
        }

        const db = await initDB();
        const tx = db.transaction("files", "readonly");
        const store = tx.objectStore("files");
        const key = `${courseId}_${filename}`;
        const file = await store.get(key);

        if (file && file.content) {
          const blob = new Blob([file.content as any], { type: "video/mp4" });
          return URL.createObjectURL(blob);
        }

        return null;
      } catch (error) {
        return null;
      }
    };

    // Get video URL from module.xml
    const getVideoUrlFromModuleXml = async (
      filename: string
    ): Promise<string | null> => {
      if (!courseId) return null;

      try {
        const moduleXml = await loadFileFromCourse(courseId, "module.xml");
        if (!moduleXml) return null;

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(moduleXml, "text/xml");
        const allFiles = xmlDoc.querySelectorAll("file");
        const normalizedSearchName = normalizeFilename(filename);

        for (const file of Array.from(allFiles)) {
          const xmlFilename = file.getAttribute("filename");
          const downloadUrl = file.getAttribute("download_url");
          if (!xmlFilename || !downloadUrl) continue;

          if (
            xmlFilename === filename ||
            normalizeFilename(xmlFilename) === normalizedSearchName
          ) {
            return downloadUrl;
          }
        }
        return null;
      } catch (error) {
        return null;
      }
    };

    // Get media URL from streaming data
    const getMediaUrlFromStreamingData = (filename: string): string | null => {
      const decodedFilename = decodeURIComponent(filename);
      const normalizedSearchName = normalizeFilename(filename);

      const convertToProxiedUrl = (url: string): string => {
        try {
          const urlObj = new URL(url);
          if (urlObj.pathname.startsWith("/media/")) {
            return urlObj.pathname;
          }
        } catch (e) {
          // Not a valid URL
        }
        return url;
      };

      if (mediaFiles?.length) {
        for (const media of mediaFiles) {
          if (
            media.filename === decodedFilename ||
            media.filename === filename ||
            normalizeFilename(media.filename) === normalizedSearchName
          ) {
            return convertToProxiedUrl(media.downloadUrl);
          }
        }
      }

      if (allCourseMedia?.length) {
        for (const media of allCourseMedia) {
          if (
            media.filename === decodedFilename ||
            media.filename === filename ||
            normalizeFilename(media.filename) === normalizedSearchName
          ) {
            return convertToProxiedUrl(media.downloadUrl);
          }
        }
      }

      return null;
    };

    // Main processing function
    const processContent = async () => {
      // Phase 1: Convert external resources to inline
      await convertLinkedStylesToInline(
        getContentWrapper(),
        courseId,
        serverUrl,
        shortname
      );

      await convertExternalScriptsToInline(
        getContentWrapper(),
        courseId,
        serverUrl,
        shortname
      );

      fixRelativeAssetUrls(getContentWrapper(), serverUrl, shortname);

      // Phase 2: Add responsive styles and scope inline styles
      addResponsiveStyles(getContentWrapper());
      scopeInlineStyles(getContentWrapper());

      // Phase 3: Execute scripts
      const executeScripts = () => {
        const wrapper = getContentWrapper();
        const scripts = wrapper?.querySelectorAll("script");
        if (!scripts) return;

        scripts.forEach((oldScript) => {
          const newScript = document.createElement("script");
          Array.from(oldScript.attributes).forEach((attr) => {
            newScript.setAttribute(attr.name, attr.value);
          });
          newScript.textContent = oldScript.textContent;
          oldScript.parentNode?.replaceChild(newScript, oldScript);
        });
      };

      executeScripts();

      // Phase 4: Setup media links
      setTimeout(async () => {
        await setupVideoLinks();
        await setupPdfLinks();
        await setupAudioFiles();
        fixNavigationButtons(getContentWrapper());
      }, 100);
    };

    // Setup video links
    const setupVideoLinks = async () => {
      const wrapper = getContentWrapper();
      if (!wrapper) return;

      const links = wrapper.querySelectorAll("a[href*='/video/']");

      for (const link of Array.from(links)) {
        const href = link.getAttribute("href");
        if (!href || !href.includes("/video/")) continue;

        const videoSubpath = "/video/";
        const startPos = href.indexOf(videoSubpath) + videoSubpath.length;
        let videoFilename = decodeURIComponent(href.substring(startPos));

        let videoUrl: string | null = null;
        let isOffline = false;

        if (courseId) {
          videoUrl = await getCachedVideo(courseId, videoFilename);
          isOffline = !!videoUrl;
          if (!videoUrl) {
            videoUrl = await getVideoUrlFromModuleXml(videoFilename);
          }
        }

        if (!videoUrl) {
          videoUrl = getMediaUrlFromStreamingData(videoFilename);
        }

        const poster = link.querySelector("img.video-poster");
        const posterSrc = poster?.getAttribute("src");
        const linkText = link.textContent?.trim() || videoFilename;

        if (!link.querySelector(".custom-play-btn")) {
          const playBtn = document.createElement("div");
          playBtn.className = "custom-play-btn";
          link.appendChild(playBtn);
        }

        if (videoUrl) {
          link.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenVideoModal(videoUrl, linkText, posterSrc || undefined);
          });
        } else {
          const potentialUrl =
            (courseId && (await getVideoUrlFromModuleXml(videoFilename))) ||
            getMediaUrlFromStreamingData(videoFilename);

          link.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenUnavailableMediaModal(
              videoFilename,
              "video",
              potentialUrl || undefined
            );
          });
        }
      }
    };

    // Setup PDF links
    const setupPdfLinks = async () => {
      const wrapper = getContentWrapper();
      if (!wrapper) return;

      const pdfLinks = wrapper.querySelectorAll(
        "a[href*='.pdf'], a[href*='resources/']"
      );

      for (const link of Array.from(pdfLinks)) {
        const originalHref = link.getAttribute("href");
        if (!originalHref) continue;

        if (
          originalHref.startsWith("http://") ||
          originalHref.startsWith("https://")
        ) {
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener noreferrer");
          continue;
        }

        const anchorLink = link as HTMLAnchorElement;
        anchorLink.href = "#";

        anchorLink.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();

          if (courseId) {
            try {
              const { getFileFromIDB } = await import(
                "@/utils/courseStorageIDB"
              );
              const pdfBinaryData = await getFileFromIDB(
                courseId,
                originalHref
              );

              if (pdfBinaryData) {
                const uint8Array = new Uint8Array(pdfBinaryData);
                const blob = new Blob([uint8Array], {
                  type: "application/pdf",
                });
                const objectUrl = URL.createObjectURL(blob);
                window.open(objectUrl, "_blank");
                return;
              }
            } catch (error) {}
          }

          if (serverUrl && shortname) {
            let baseUrl = serverUrl;
            try {
              const urlObj = new URL(serverUrl);
              baseUrl = `${urlObj.protocol}//${urlObj.host}`;
            } catch (e) {
              baseUrl = serverUrl.replace(/\/+$/, "");
            }

            const pdfUrl = originalHref.startsWith("/media/courses/")
              ? `${baseUrl}${originalHref}`
              : `${baseUrl}/media/courses/${shortname}/${originalHref}`;

            window.open(pdfUrl, "_blank");
          }
        });
      }
    };

    // Setup audio files
    const setupAudioFiles = async () => {
      const wrapper = getContentWrapper();
      if (!wrapper) return;

      const audioElements = wrapper.querySelectorAll("audio[src]");

      for (const audio of Array.from(audioElements)) {
        const src = audio.getAttribute("src");
        if (!src) continue;

        let audioFilename: string;

        if (src.includes("/audio/")) {
          const audioSubpath = "/audio/";
          const startPos = src.indexOf(audioSubpath) + audioSubpath.length;
          audioFilename = src.substring(startPos);
        } else if (
          src.startsWith("http") ||
          src.startsWith("blob:") ||
          src.startsWith("data:")
        ) {
          continue;
        } else {
          audioFilename = src;
        }

        audioFilename = decodeURIComponent(audioFilename);
        let audioUrl: string | null = null;

        if (courseId) {
          try {
            const { getMediaBlobUrl } = await import(
              "@/services/mediaDownloadService"
            );
            const blobUrl = await getMediaBlobUrl(courseId, audioFilename);

            if (blobUrl) {
              audioUrl = blobUrl;
            } else {
              audioUrl = await getVideoUrlFromModuleXml(audioFilename);
            }
          } catch (error) {}
        }

        if (!audioUrl) {
          audioUrl = getMediaUrlFromStreamingData(audioFilename);
        }

        if (audioUrl) {
          audio.setAttribute("src", audioUrl);
          (audio as HTMLAudioElement).load();
        } else {
          const audioEl = audio as HTMLAudioElement;
          audioEl.style.opacity = "0.7";

          const potentialUrl =
            (courseId && (await getVideoUrlFromModuleXml(audioFilename))) ||
            getMediaUrlFromStreamingData(audioFilename);

          audioEl.addEventListener("play", (e) => {
            e.preventDefault();
            onOpenUnavailableMediaModal(
              audioFilename,
              "audio",
              potentialUrl || undefined
            );
          });
        }
      }
    };

    processContent();

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [
    html,
    courseId,
    mediaFiles,
    allCourseMedia,
    serverUrl,
    shortname,
    onOpenVideoModal,
    onOpenUnavailableMediaModal,
  ]);

  return containerRef;
}
