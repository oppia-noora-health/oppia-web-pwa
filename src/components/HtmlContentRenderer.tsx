"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadFileFromCourse } from "@/utils/courseLoaderIDB";
import { initDB } from "@/utils/courseStorageIDB";
import { getMediaFromCache } from "@/utils/mediaCacheStorage";
import { getApiUrl } from "@/config/constants";
import VideoModal from "@/components/modals/VideoModal";
import { useLanguageStore } from "@/store/useLanguageStore";
import { useAuthStore } from "@/store/useStore";
import { getSetting } from "@/utils/settingsStorage";
import { translations } from "@/locales";
import { useAccessLog } from "@/hooks/useAccessLog";

// Media file info for streaming mode
export interface StreamingMediaFile {
  filename: string;
  downloadUrl: string;
  digest?: string;
  filesize?: string;
  length?: string;
}

interface HtmlContentRendererProps {
  html: string;
  className?: string;
  courseId?: string; // Required for video playback from IndexedDB (offline mode)
  mediaFiles?: StreamingMediaFile[]; // Media files for streaming mode
  allCourseMedia?: StreamingMediaFile[]; // All media files from course structure (fallback)
  serverUrl?: string; // Server URL for streaming mode (to resolve relative asset URLs)
  shortname?: string; // Course shortname for streaming mode
  onVideoTracking?: (
    filename: string,
    timeWatched: number,
    duration: number,
  ) => void; // Callback for video tracking
  onAudioTracking?: (
    filename: string,
    timeWatched: number,
    duration: number,
  ) => void; // Callback for audio tracking
  onAudioComplete?: (
    filename: string,
    timeWatched: number,
    duration: number,
  ) => void; // Callback when audio finishes playing (100%)
  onVideoComplete?: (
    filename: string,
    timeWatched: number,
    duration: number,
  ) => void; // Callback when video finishes playing (100%)
  onNext?: () => void; // Callback when user clicks Next after video completion
  digest?: string; // Current activity digest for video tracking
  onHasSlidesChange?: (
    hasSlides: boolean,
    isOnLastSlide?: boolean,
    isOnFirstSlide?: boolean,
  ) => void; // Callback to notify parent if activity has slides with internal navigation and slide position
  onPdfOpen?: () => void; // Callback when user opens a PDF (for activity completion tracking)
}

/**
 * Component that renders HTML content directly with CSS scoping
 * Uses CSS attribute scoping ([data-moodle-content]) to isolate course styles
 * Replaces script tags to trigger execution (React's dangerouslySetInnerHTML doesn't execute scripts)
 */
export default function HtmlContentRenderer({
  html,
  courseId,
  mediaFiles,
  allCourseMedia,
  serverUrl,
  shortname,
  onVideoTracking,
  onAudioTracking,
  onAudioComplete,
  onVideoComplete,
  onNext,
  digest,
  onHasSlidesChange,
  onPdfOpen,
}: HtmlContentRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguageStore();
  const t = translations[language as keyof typeof translations];
  const { user } = useAuthStore();
  const userId = user?.id?.toString();
  // Track the HTML we've already processed to avoid re-checking
  const processedHtmlRef = useRef<string>("");
  // Track the last reported state to avoid unnecessary callbacks
  const lastReportedStateRef = useRef<boolean | null>(null);
  // Track last reported slide states
  const lastReportedLastSlideRef = useRef<boolean | null>(null);
  const lastReportedFirstSlideRef = useRef<boolean | null>(null);
  // Track if user is on last slide
  const isOnLastSlideRef = useRef<boolean>(false);
  // Track if user is on first slide
  const isOnFirstSlideRef = useRef<boolean>(true); // Start on first slide
  // Store callbacks in refs to avoid stale closures in event listeners
  const callbackRef = useRef(onHasSlidesChange);
  const pdfOpenCallbackRef = useRef(onPdfOpen);
  const mediaFilesRef = useRef<StreamingMediaFile[] | undefined>(mediaFiles);
  const allCourseMediaRef = useRef<StreamingMediaFile[] | undefined>(
    allCourseMedia,
  );

  // Update callback refs when they change (without triggering main effect)
  useEffect(() => {
    const callbackChanged = callbackRef.current !== onHasSlidesChange;
    if (callbackChanged) {
      callbackRef.current = onHasSlidesChange;
    }
    pdfOpenCallbackRef.current = onPdfOpen;
  }, [onHasSlidesChange, onPdfOpen]);

  useEffect(() => {
    mediaFilesRef.current = mediaFiles;
    allCourseMediaRef.current = allCourseMedia;
  }, [mediaFiles, allCourseMedia]);
  const [videoModal, setVideoModal] = useState<{
    isOpen: boolean;
    videoUrl: string;
    videoTitle: string;
    posterUrl?: string;
    hasError?: boolean;
    filename?: string;
    digest?: string;
  }>({
    isOpen: false,
    videoUrl: "",
    videoTitle: "",
    hasError: false,
  });

  // Unavailable media modal state
  const [unavailableMediaModal, setUnavailableMediaModal] = useState<{
    isOpen: boolean;
    mediaName: string;
    mediaType: "video" | "audio" | "pdf";
    downloadUrl?: string;
    retrying: boolean;
  }>({
    isOpen: false,
    mediaName: "",
    mediaType: "video",
    retrying: false,
  });

  // Track online status for retry
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Retry loading media when network becomes available
  const handleRetryMedia = useCallback(async () => {
    if (!isOnline || !unavailableMediaModal.downloadUrl) {
      return;
    }

    setUnavailableMediaModal((prev) => ({ ...prev, retrying: true }));

    try {
      // Open media directly. HEAD checks can fail on some servers even when GET playback works.
      if (unavailableMediaModal.mediaType === "video") {
        setUnavailableMediaModal({
          isOpen: false,
          mediaName: "",
          mediaType: "video",
          retrying: false,
        });
        setVideoModal({
          isOpen: true,
          videoUrl: unavailableMediaModal.downloadUrl,
          videoTitle: unavailableMediaModal.mediaName,
          filename: unavailableMediaModal.mediaName,
          digest: digest,
        });
      } else {
        window.open(unavailableMediaModal.downloadUrl, "_blank");
        setUnavailableMediaModal({
          isOpen: false,
          mediaName: "",
          mediaType: "video",
          retrying: false,
        });
      }
    } catch (error) {
      setUnavailableMediaModal((prev) => ({ ...prev, retrying: false }));
    }
  }, [
    isOnline,
    unavailableMediaModal.downloadUrl,
    unavailableMediaModal.mediaType,
    unavailableMediaModal.mediaName,
  ]);

  // Handle ESC key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (videoModal.isOpen) {
          setVideoModal({ isOpen: false, videoUrl: "", videoTitle: "" });
        }
        if (unavailableMediaModal.isOpen) {
          setUnavailableMediaModal({
            isOpen: false,
            mediaName: "",
            mediaType: "video",
            retrying: false,
          });
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [videoModal.isOpen]);

  // Track previous dependency values to detect what's changing
  const prevDepsRef = useRef<{
    html?: string;
    courseId?: string;
    mediaFiles?: StreamingMediaFile[];
    allCourseMedia?: StreamingMediaFile[];
    serverUrl?: string;
    shortname?: string;
  }>({});

  useEffect(() => {
    const prevDeps = prevDepsRef.current;
    const depsChanged = {
      html: prevDeps.html !== html,
      courseId: prevDeps.courseId !== courseId,
      mediaFiles: prevDeps.mediaFiles !== mediaFiles,
      allCourseMedia: prevDeps.allCourseMedia !== allCourseMedia,
      serverUrl: prevDeps.serverUrl !== serverUrl,
      shortname: prevDeps.shortname !== shortname,
    };

    // Update refs for next comparison
    prevDepsRef.current = {
      html,
      courseId,
      mediaFiles,
      allCourseMedia,
      serverUrl,
      shortname,
    };

    if (!containerRef.current) return;

    let timeoutId: NodeJS.Timeout | null = null;
    let retryTimeoutId: NodeJS.Timeout | null = null;
    let isCleanedUp = false;

    // Create wrapper first with hidden state
    const wrapper = document.createElement("div");
    wrapper.className = "moodle-content-wrapper";
    wrapper.style.cssText = `
      opacity: 0;
      transition: opacity 0.15s ease-in;
    `;

    // Set the HTML content into wrapper
    wrapper.innerHTML = html;

    // Clear and add wrapper to container
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(wrapper);

    // Helper to get content wrapper
    const getContentWrapper = () =>
      containerRef.current?.querySelector(
        ".moodle-content-wrapper",
      ) as HTMLElement | null;

    // Helper function to scope CSS selectors to .moodle-content-wrapper
    const scopeCSSToWrapper = (css: string): string => {
      const scopePrefix = ".moodle-content-wrapper";

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
          },
        );

        // Scope the remaining (non-nested) rules
        processedCSS = scopeRules(processedCSS);

        return processedCSS;
      } catch (e) {
        return css;
      }

      // Helper to scope individual CSS rules
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
              if (trimmed.startsWith(scopePrefix)) {
                return trimmed;
              }

              // Skip if it's a pseudo-element/class only (e.g., ":root", "::before")
              if (trimmed.startsWith(":")) {
                return `${scopePrefix} ${trimmed}`;
              }

              // Add scope prefix
              return `${scopePrefix} ${trimmed}`;
            });

            return `${selectors.join(", ")}{${rules}}`;
          },
        );
      }
    };

    // Convert linked stylesheets to inline styles
    const convertLinkedStylesToInline = async () => {
      const wrapper = getContentWrapper();
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
                  "",
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
            cssText = cssText.replace(
              /url\(["']?(?!https?:\/\/|\/\/|data:|blob:)([^"')]+)["']?\)/gi,
              (match, urlPath) => {
                let cleanPath = urlPath
                  .replace(/^\.\//, "")
                  .replace(/^\.\.\//, "");
                return `url("${cssBaseUrl}${cleanPath}")`;
              },
            );
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
              /content-section.*#(prevBtn|nextBtn)[^}]+}/g,
            );
            if (buttonStyleMatch) {
            }
          }
        } catch (error) {}
      }
    };

    // Convert external script tags to inline scripts
    const convertExternalScriptsToInline = async () => {
      const wrapper = getContentWrapper();
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
                    script.getAttribute(attrName)!,
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
                "",
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
              inlineScript.setAttribute(
                attrName,
                script.getAttribute(attrName)!,
              );
            }
          });
          inlineScript.setAttribute("data-original-src", src);
          inlineScript.textContent = scriptText;

          // Replace external script with inline script
          script.parentNode?.replaceChild(inlineScript, script);
        } catch (error) {}
      }
    };

    // Fix relative asset URLs: images = direct server (no proxy); inline style url() = proxy
    const fixRelativeAssetUrls = () => {
      const wrapper = getContentWrapper();
      if (!serverUrl || !shortname || !wrapper) return;

      const proxyBase = `/media/courses/${shortname}/`;
      const imageBaseUrl = `${serverUrl.replace(
        /\/$/,
        "",
      )}/media/courses/${shortname}/`;

      // Fix image sources: direct server URL (no proxy)
      const images = wrapper.querySelectorAll("img[src]");
      images.forEach((img) => {
        const src = img.getAttribute("src");
        if (
          src &&
          !src.startsWith("http") &&
          !src.startsWith("//") &&
          !src.startsWith("data:") &&
          !src.startsWith("blob:") &&
          !src.startsWith("/media/")
        ) {
          const newSrc = `${imageBaseUrl}${src.replace(/^\.\//, "")}`;
          img.setAttribute("src", newSrc);
        }
      });

      // Fix background images in inline styles: proxy (unchanged – keeps styles working)
      const elementsWithStyle = wrapper.querySelectorAll('[style*="url("]');
      elementsWithStyle.forEach((el) => {
        const style = el.getAttribute("style");
        if (style) {
          const newStyle = style.replace(
            /url\(["']?(?!https?:\/\/|\/\/|data:|blob:)([^"')]+)["']?\)/gi,
            (match, urlPath) => {
              const cleanPath = urlPath.replace(/^\.\//, "");
              return `url("${proxyBase}${cleanPath}")`;
            },
          );
          if (newStyle !== style) {
            el.setAttribute("style", newStyle);
          }
        }
      });
    };

    const executeInlineScripts = () => {
      const contentWrapper = getContentWrapper();
      if (!contentWrapper) return;

      const scripts = contentWrapper.querySelectorAll("script");

      let executedCount = 0;
      let errorCount = 0;

      scripts.forEach((oldScript) => {
        const newScript = document.createElement("script");

        Array.from(oldScript.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });

        const scriptSource =
          oldScript.getAttribute("data-original-src") ||
          oldScript.getAttribute("src") ||
          "inline";

        newScript.onerror = () => {
          errorCount++;
        };

        newScript.onload = () => {};

        newScript.textContent = oldScript.textContent;

        try {
          oldScript.parentNode?.replaceChild(newScript, oldScript);
          executedCount++;

          // Keep jQuery aliases in sync as soon as jQuery script executes
          if (/jquery/i.test(scriptSource)) {
            const jQueryGlobal = (window as any).jQuery || (window as any).$;
            if (jQueryGlobal) {
              (window as any).jQuery = jQueryGlobal;
              (window as any).$ = jQueryGlobal;
            }
          }
        } catch (error) {
          errorCount++;
        }
      });

      setTimeout(() => {
        const jQueryLoaded =
          typeof (window as any).$ !== "undefined" ||
          typeof (window as any).jQuery !== "undefined";

        if (jQueryLoaded) {
          const jQuery = (window as any).$ || (window as any).jQuery;
          (window as any).$ = jQuery;
          (window as any).jQuery = jQuery;
        }
      }, 200);
    };

    // Execute stylesheet conversion
    convertLinkedStylesToInline().then(() => {
      // After CSS is loaded, fade in the content
      const wrapper = getContentWrapper();
      if (wrapper) {
        wrapper.style.opacity = "1";
      }
    });

    // Fix relative asset URLs for streaming mode
    fixRelativeAssetUrls();

    // Add responsive wrapper styles for desktop/tablet
    const responsiveWrapper = document.createElement("style");
    responsiveWrapper.setAttribute("data-responsive-wrapper", "true");
    responsiveWrapper.textContent = `
      
    `;

    // Scope responsive wrapper styles
    const scopedResponsiveCSS = scopeCSSToWrapper(
      responsiveWrapper.textContent || "",
    );
    responsiveWrapper.textContent = scopedResponsiveCSS;

    // Insert responsive wrapper at the beginning
    const contentWrapper = getContentWrapper();
    if (contentWrapper) {
      contentWrapper.insertBefore(responsiveWrapper, contentWrapper.firstChild);
    }

    // Scope all inline style tags from Moodle
    if (contentWrapper) {
      const inlineStyles = contentWrapper.querySelectorAll(
        "style:not([data-responsive-wrapper])",
      );
      inlineStyles.forEach((styleTag) => {
        const originalCSS = styleTag.textContent || "";
        const scopedCSS = scopeCSSToWrapper(originalCSS);
        styleTag.textContent = scopedCSS;
      });
    }

    // Only run detection if HTML has changed (computed early so we can reference inside .finally)
    const htmlChanged = processedHtmlRef.current !== html && html.length > 0;

    // Convert external scripts to inline BEFORE execution, then execute in DOM order.
    // fixNavigationButtons is chained AFTER script execution to eliminate the race
    // condition where the 1500ms fixed timeout fired before oppia.js created buttons.
    convertExternalScriptsToInline()
      .catch(() => {
        // Fall back to best-effort script execution even if conversion fails
      })
      .finally(() => {
        if (isCleanedUp) return;
        executeInlineScripts();

        // Run navigation detection AFTER scripts have been injected & executed.
        // 500ms gives $(document).ready handlers time to run.
        if (htmlChanged) {
          timeoutId = setTimeout(() => {
            if (isCleanedUp) return;
            fixNavigationButtons();

            // Retry: if buttons weren't found (oppia.js may create them late),
            // try once more after an additional delay.
            const wrapper = getContentWrapper();
            const buttonsExist =
              wrapper?.querySelector("#prevBtn") ||
              wrapper?.querySelector("#nextBtn");
            if (!buttonsExist && wrapper?.querySelectorAll("slide").length) {
              retryTimeoutId = setTimeout(() => {
                if (isCleanedUp) return;
                fixNavigationButtons();
              }, 2000);
            }
          }, 500);
        }
      });

    // Wait for scripts to execute then trigger any initialization
    setTimeout(() => {
      // Dispatch custom event for Noora Academy scripts to reinitialize
      const event = new CustomEvent("nooraContentLoaded", {
        bubbles: true,
        detail: { container: getContentWrapper() },
      });
      getContentWrapper()?.dispatchEvent(event);

      // Trigger window resize to recalculate any layout-dependent scripts
      window.dispatchEvent(new Event("resize"));

      try {
        // Try to find the same globals the legacy script uses
        const slidesGlobal =
          (window as any).slides ||
          Array.from(document.querySelectorAll("slide"));
        const sliderContainerGlobal =
          (slidesGlobal &&
            slidesGlobal.length > 0 &&
            slidesGlobal[0].parentNode) ||
          document.querySelector("#slider-container") ||
          document.body;

        // Override global updateSlider to center slides when possible
        (window as any).updateSlider = function centeredUpdateSlider() {
          try {
            const current = (window as any).currentSlide || 0;
            const slides = slidesGlobal;
            if (!slides || slides.length === 0) return;
            const slide = slides[current];
            if (!slide) return;

            // Prefer scrollIntoView center for robustness, fallback to manual centered scroll
            try {
              slide.scrollIntoView({
                behavior: "smooth",
                inline: "center",
                block: "nearest",
              });
            } catch (err) {
              const container: HTMLElement =
                sliderContainerGlobal as HTMLElement;
              const targetLeft =
                slide.offsetLeft -
                Math.max(
                  0,
                  Math.floor((container.clientWidth - slide.offsetWidth) / 2),
                );
              container.scroll({ left: targetLeft, behavior: "smooth" });
            }
          } catch (err) {
            // swallow - defensive
          }
        };

        // Override changeSlide to update currentSlide then call centered updateSlider
        (window as any).changeSlide = function centeredChangeSlide(
          direction: number,
        ) {
          try {
            const slides = slidesGlobal;
            if (!slides || slides.length === 0) return;
            let current = (window as any).currentSlide || 0;
            current = Math.max(
              0,
              Math.min(current + direction, slides.length - 1),
            );
            (window as any).currentSlide = current;
            (window as any).updateSlider && (window as any).updateSlider();
          } catch (err) {}
        };
      } catch (e) {}

      // Verify script functionality
      const wrapper = getContentWrapper();
      if (wrapper) {
        // Check for navigation buttons created by oppia.js
        const prevButtons = wrapper.querySelectorAll("#prevBtn");
        const nextButtons = wrapper.querySelectorAll("#nextBtn");

        // Check for pagination elements
        const pagination = wrapper.querySelectorAll(".pagination");

        // Check for active slides
        const activeSlides = wrapper.querySelectorAll("slide.active");

        // Check for cards
        const cards = wrapper.querySelectorAll("card");
        const activeCards = wrapper.querySelectorAll("card.active");
        if (cards.length > 0) {
        }

        // Check for know-more modals
        const knowMoreItems = wrapper.querySelectorAll("know-more item");
        if (knowMoreItems.length > 0) {
        }

        // Check for event listeners on carousel sections
        const carouselSections = wrapper.querySelectorAll(
          "content-section, audio-section, info-section, noor-section",
        );
      }
    }, 100);

    // Helper function to get cached video from Cache Storage or IndexedDB
    const getCachedVideo = async (
      courseId: string,
      filename: string,
    ): Promise<string | null> => {
      try {
        const cachedUrl = await getMediaFromCache(courseId, filename);

        if (cachedUrl) {
          return cachedUrl;
        }

        const db = await initDB();
        const tx = db.transaction("files", "readonly");
        const store = tx.objectStore("files");
        // Use same key format as mediaDownloadService: courseId_filename
        const key = `${courseId}_${filename}`;
        const file = await store.get(key);

        if (file && file.content) {
          // Create blob URL from stored content
          const blob = new Blob([file.content as any], { type: "video/mp4" });
          const blobUrl = URL.createObjectURL(blob);
          return blobUrl;
        }

        return null;
      } catch (error) {
        return null;
      }
    };

    // Helper function to cache video for offline viewing
    // Stores in Cache Storage (optimized for large media files)
    const cacheVideo = async (
      courseId: string,
      filename: string,
      videoUrl: string,
    ): Promise<void> => {
      try {
        const response = await fetch(videoUrl);
        if (!response.ok) throw new Error("Failed to download video");

        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const content = new Uint8Array(arrayBuffer);

        // Store in Cache Storage (better for large video files)
        const cache = await caches.open("noora-health-media-v1");
        const cacheUrl = `/media-cache/${courseId}/${filename}`;

        const cacheResponse = new Response(blob, {
          headers: {
            "Content-Type": "video/mp4",
            "Content-Length": content.length.toString(),
          },
        });

        await cache.put(cacheUrl, cacheResponse);
      } catch (error) {}
    };

    // Helper to normalize filename for comparison (handles encoding, spaces, etc.)
    const normalizeFilename = (name: string): string => {
      return decodeURIComponent(name).toLowerCase().trim().replace(/\s+/g, " "); // Normalize multiple spaces to single space
    };

    // Helper function to get video download URL from module.xml
    const getVideoUrlFromModuleXml = async (
      filename: string,
    ): Promise<string | null> => {
      try {
        if (!courseId) {
          return null;
        }

        // Load module.xml from IndexedDB
        const moduleXml = await loadFileFromCourse(courseId, "module.xml");
        if (!moduleXml) {
          return null;
        }

        // Parse XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(moduleXml, "text/xml");

        // Find ALL file elements (both under media and activity > media)
        const allFiles = xmlDoc.querySelectorAll("file");
        const normalizedSearchName = normalizeFilename(filename);

        // Log all available files for debugging
        const availableFiles: string[] = [];
        for (const file of Array.from(allFiles)) {
          const xmlFilename = file.getAttribute("filename");
          if (xmlFilename) {
            availableFiles.push(xmlFilename);
          }
        }

        for (const file of Array.from(allFiles)) {
          const xmlFilename = file.getAttribute("filename");
          const downloadUrl = file.getAttribute("download_url");

          if (!xmlFilename || !downloadUrl) continue;

          // Try exact match first
          if (xmlFilename === filename) {
            return downloadUrl;
          }

          // Try normalized comparison (handles encoding, case, spaces)
          if (normalizeFilename(xmlFilename) === normalizedSearchName) {
            return downloadUrl;
          }
        }

        return null;
      } catch (error) {
        return null;
      }
    };

    // Helper function to find media URL from streaming media files
    const getMediaUrlFromStreamingData = (filename: string): string | null => {
      // Decode the filename for comparison
      const decodedFilename = decodeURIComponent(filename);
      const normalizedSearchName = normalizeFilename(filename);
      const latestMediaFiles = mediaFilesRef.current;
      const latestAllCourseMedia = allCourseMediaRef.current;

      // For streaming mode, use direct download URLs to avoid proxy size limits
      // Videos are large files that shouldn't go through the application proxy

      // Check activity-specific media files first
      if (latestMediaFiles && latestMediaFiles.length > 0) {
        for (const media of latestMediaFiles) {
          // Exact match
          if (
            media.filename === decodedFilename ||
            media.filename === filename
          ) {
            return media.downloadUrl; // Use direct URL, not proxied
          }
          // Normalized match
          if (normalizeFilename(media.filename) === normalizedSearchName) {
            return media.downloadUrl; // Use direct URL, not proxied
          }
        }
      }

      // Check all course media as fallback
      if (latestAllCourseMedia && latestAllCourseMedia.length > 0) {
        for (const media of latestAllCourseMedia) {
          // Exact match
          if (
            media.filename === decodedFilename ||
            media.filename === filename
          ) {
            return media.downloadUrl; // Use direct URL, not proxied
          }
          // Normalized match
          if (normalizeFilename(media.filename) === normalizedSearchName) {
            return media.downloadUrl; // Use direct URL, not proxied
          }
        }
      }

      return null;
    };

    // Handle video links (OppiaMobile style: /video/filename.mp4)
    const handleVideoLinks = async () => {
      const wrapper = getContentWrapper();
      if (!wrapper) return;

      const links = wrapper.querySelectorAll("a[href*='/video/']");

      for (const link of Array.from(links)) {
        const href = link.getAttribute("href");
        if (!href || !href.includes("/video/")) continue;

        // Extract video filename from URL: /video/M1L1%20-%20S%202.mp4
        const videoSubpath = "/video/";
        const startPos = href.indexOf(videoSubpath) + videoSubpath.length;
        let videoFilename = href.substring(startPos);

        // Decode URL-encoded characters (e.g., %20 -> space)
        videoFilename = decodeURIComponent(videoFilename);

        let videoUrl: string | null = null;
        let isOffline = false;

        // For offline mode (courseId provided), try cached video first
        if (courseId) {
          videoUrl = await getCachedVideo(courseId, videoFilename);
          isOffline = !!videoUrl;

          // If not cached, get online URL from module.xml
          if (!videoUrl) {
            videoUrl = await getVideoUrlFromModuleXml(videoFilename);
          }
        }

        // For streaming mode, get URL from streaming media data
        if (!videoUrl) {
          videoUrl = getMediaUrlFromStreamingData(videoFilename);
        }

        // Get poster image if it exists
        const poster = link.querySelector("img.video-poster");
        const posterSrc = poster?.getAttribute("src");

        // Get link text or use filename
        const linkText = link.textContent?.trim() || videoFilename;

        // Add custom play button element if it doesn't exist
        if (!link.querySelector(".custom-play-btn")) {
          const playBtn = document.createElement("div");
          playBtn.className = "custom-play-btn";
          link.appendChild(playBtn);
        }

        if (videoUrl) {
          // Add click handler to open modal
          link.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();

            // If video is online and not cached, cache it in background
            if (!isOffline && courseId) {
              cacheVideo(courseId, videoFilename, videoUrl).catch(
                (err) => void 0,
              );
            }

            setVideoModal({
              isOpen: true,
              videoUrl: videoUrl,
              videoTitle: linkText,
              posterUrl: posterSrc || undefined,
              hasError: false,
              filename: videoFilename,
              digest: digest,
            });
          });
        } else {
          // No URL found - show unavailable media popup
          const linkEl = link as HTMLElement;
          linkEl.style.opacity = "0.7";
          linkEl.style.cursor = "pointer";

          // Try to get URL from module.xml for retry functionality (offline mode)
          // Or from streaming media data (streaming mode)
          let potentialUrl: string | null = null;

          if (courseId) {
            // Offline/downloaded mode - try module.xml
            potentialUrl = await getVideoUrlFromModuleXml(videoFilename);
          }

          // If still no URL, try streaming media data as fallback
          if (!potentialUrl) {
            potentialUrl = getMediaUrlFromStreamingData(videoFilename);
            if (potentialUrl) {
            }
          }

          link.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            setUnavailableMediaModal({
              isOpen: true,
              mediaName: videoFilename,
              mediaType: "video",
              downloadUrl: potentialUrl || undefined,
              retrying: false,
            });
          });

          if (!potentialUrl) {
          }
        }
      }
    }; // Execute video link handler
    handleVideoLinks();

    // Handle PDF links (resources/filename.pdf)
    const handlePdfLinks = async () => {
      const wrapper = getContentWrapper();
      if (!wrapper) return;

      const pdfLinks = wrapper.querySelectorAll(
        "a[href*='.pdf'], a[href*='resources/']",
      );

      for (const link of Array.from(pdfLinks)) {
        const originalHref = link.getAttribute("href");
        if (!originalHref) continue;

        // Skip if it's already a full URL - just open in new tab
        if (
          originalHref.startsWith("http://") ||
          originalHref.startsWith("https://")
        ) {
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener noreferrer");
          continue;
        }

        // IMMEDIATELY replace href to prevent navigation
        const anchorLink = link as HTMLAnchorElement;
        anchorLink.href = "#";

        // Store the original href as a data attribute
        anchorLink.setAttribute("data-pdf-href", originalHref);

        // Create a promise to handle PDF loading
        const pdfLoadPromise = (async () => {
          // Try to load PDF from IndexedDB (for offline courses)
          if (courseId) {
            try {
              // Import getFileFromIDB to get raw binary data
              const { getFileFromIDB } =
                await import("@/utils/courseStorageIDB");
              const pdfBinaryData = await getFileFromIDB(
                courseId,
                originalHref,
              );

              if (pdfBinaryData) {
                // Create blob from binary data (Uint8Array)
                const uint8Array = new Uint8Array(pdfBinaryData);
                const blob = new Blob([uint8Array], {
                  type: "application/pdf",
                });
                const objectUrl = URL.createObjectURL(blob);

                // Return blob opener
                return () => {
                  const pdfWindow = window.open(objectUrl, "_blank");
                  if (!pdfWindow) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      const dataUrl = reader.result as string;
                      window.open(dataUrl, "_blank");
                    };
                    reader.readAsDataURL(blob);
                  }
                };
              } else {
                // If PDF not in IndexedDB but we have courseId, try to get shortname from course data
                if (!shortname) {
                  try {
                    const { getCourseFromIDB } =
                      await import("@/utils/courseStorageIDB");
                    const courseData = await getCourseFromIDB(courseId);
                    if (courseData?.shortname) {
                      const fallbackShortname = courseData.shortname;
                      const customUrl = getSetting("custom_api_url", userId);
                      const baseUrl =
                        customUrl?.replace(/\/api\/v2\/?$/, "") ||
                        getApiUrl().replace(/\/api\/v2\/?$/, "") ||
                        "https://academy-indonesia.noorahealth.org";

                      let pdfUrl;
                      if (originalHref.startsWith("/media/courses/")) {
                        pdfUrl = `${baseUrl}${originalHref}`;
                      } else {
                        pdfUrl = `${baseUrl}/media/courses/${fallbackShortname}/${originalHref}`;
                      }

                      return () => {
                        window.open(pdfUrl, "_blank");
                      };
                    }
                  } catch (err) {}
                }
              }
            } catch (error) {}
          }

          // Streaming mode or fallback - construct full URL
          if (serverUrl && shortname) {
            // Extract base URL (domain) from serverUrl
            let baseUrl = serverUrl;
            try {
              const urlObj = new URL(serverUrl);
              baseUrl = `${urlObj.protocol}//${urlObj.host}`;
            } catch (e) {
              baseUrl = serverUrl.replace(/\/+$/, "");
            }

            // Check if href already contains the full path
            let pdfUrl;
            if (originalHref.startsWith("/media/courses/")) {
              pdfUrl = `${baseUrl}${originalHref}`;
            } else {
              pdfUrl = `${baseUrl}/media/courses/${shortname}/${originalHref}`;
            }

            // Return streaming opener
            return () => {
              window.open(pdfUrl, "_blank");
            };
          }

          return null;
        })();

        // Add click handler that waits for PDF to load
        anchorLink.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();

          const handler = await pdfLoadPromise;
          if (handler) {
            handler();
            // Notify parent that user opened a PDF (for activity completion tracking)
            pdfOpenCallbackRef.current?.();
          } else {
          }
        });
      }
    };

    handlePdfLinks();

    // Handle audio files (similar to video files)
    const handleAudioFiles = async () => {
      const wrapper = getContentWrapper();
      if (!wrapper) return;

      // Find all audio elements (with or without /audio/ in src)
      const audioElements = wrapper.querySelectorAll("audio[src]");

      for (const audio of Array.from(audioElements)) {
        const src = audio.getAttribute("src");
        if (!src) continue;

        // Check if this is an audio file path that needs processing
        // Could be /audio/filename.mp3 or just filename.mp3
        let audioFilename: string;

        if (src.includes("/audio/")) {
          // Extract audio filename from /audio/ path
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
          // Relative path - use as-is
          audioFilename = src;
        }

        audioFilename = decodeURIComponent(audioFilename);

        let audioUrl: string | null = null;

        // For offline mode, try to load from IndexedDB first
        if (courseId) {
          try {
            // Try to load directly from IndexedDB (after media download)
            const { getMediaBlobUrl } =
              await import("@/services/mediaDownloadService");
            const blobUrl = await getMediaBlobUrl(courseId, audioFilename);

            if (blobUrl) {
              audioUrl = blobUrl;
            } else {
              // Fallback: get URL from module.xml for streaming
              const moduleXml = await loadFileFromCourse(
                courseId,
                "module.xml",
              );
              if (moduleXml) {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(moduleXml, "text/xml");
                const xmlMediaFiles = xmlDoc.querySelectorAll("file");
                const normalizedSearchName = normalizeFilename(audioFilename);

                for (const file of Array.from(xmlMediaFiles)) {
                  const xmlFilename = file.getAttribute("filename");
                  let downloadUrl = file.getAttribute("download_url");

                  if (!xmlFilename || !downloadUrl) continue;

                  // Try exact match first
                  if (xmlFilename === audioFilename) {
                    // Convert absolute URL to proxied URL
                    try {
                      const urlObj = new URL(downloadUrl);
                      if (urlObj.pathname.startsWith("/media/")) {
                        audioUrl = urlObj.pathname;
                      } else {
                        audioUrl = downloadUrl;
                      }
                    } catch (e) {
                      audioUrl = downloadUrl;
                    }
                    break;
                  }

                  // Try normalized comparison
                  if (normalizeFilename(xmlFilename) === normalizedSearchName) {
                    try {
                      const urlObj = new URL(downloadUrl);
                      if (urlObj.pathname.startsWith("/media/")) {
                        audioUrl = urlObj.pathname;
                      } else {
                        audioUrl = downloadUrl;
                      }
                    } catch (e) {
                      audioUrl = downloadUrl;
                    }
                    break;
                  }
                }

                if (!audioUrl) {
                }
              }
            }
          } catch (error) {}
        }

        // For streaming mode, get URL from streaming media data
        if (!audioUrl) {
          audioUrl = getMediaUrlFromStreamingData(audioFilename);
          if (audioUrl) {
          } else {
          }
        }

        if (audioUrl) {
          audio.setAttribute("src", audioUrl);

          // Reload the audio element to apply the new source
          const audioEl = audio as HTMLAudioElement;
          audioEl.load();

          if (onAudioTracking) {
            const alreadyAttached = audioEl.dataset.trackingAttached === "true";
            if (!alreadyAttached) {
              audioEl.dataset.trackingAttached = "true";
              let hasEverSeeked = false; // Track if ANY seeking has occurred

              // Track when user starts seeking/dragging
              const handleSeeking = () => {
                hasEverSeeked = true; // Mark that seeking happened - disqualify from points
              };

              const handleTimeUpdate = () => {
                // Only count progress if user has NEVER seeked and audio is playing
                if (hasEverSeeked || audioEl.paused) {
                  return;
                }

                const duration = audioEl.duration || 0;
                const currentTime = audioEl.currentTime || 0;
                if (duration <= 0 || currentTime <= 0) return;

                // Throttled continuous tracking: report every 5 seconds
                // so page.tsx always has a recent timeWatched for interval-mode exit scoring.
                // Also fires at 80% threshold for backward-compatible threshold mode.
                const lastUpdate = parseFloat(
                  audioEl.dataset.lastTrackingUpdate || "0",
                );
                const isThreshold =
                  currentTime / duration >= 0.8 &&
                  audioEl.dataset.thresholdReached !== "true";

                if (currentTime - lastUpdate >= 5 || isThreshold) {
                  audioEl.dataset.lastTrackingUpdate = String(currentTime);
                  if (isThreshold) audioEl.dataset.thresholdReached = "true";
                  onAudioTracking(audioFilename, currentTime, duration);
                }
              };

              // Handle audio ended — fire final tracking update AND onAudioComplete
              const handleEnded = () => {
                // Final tracking update (existing behavior)
                handleTimeUpdate();
                // Notify parent that audio finished playing (100%)
                if (onAudioComplete && !hasEverSeeked) {
                  const duration = audioEl.duration || 0;
                  const currentTime = audioEl.currentTime || 0;
                  if (duration > 0) {
                    onAudioComplete(audioFilename, currentTime, duration);
                  }
                }
              };

              audioEl.addEventListener("timeupdate", handleTimeUpdate);
              audioEl.addEventListener("seeking", handleSeeking);
              audioEl.addEventListener("ended", handleEnded);
            }
          }
        } else {
          // Audio not available - add click handler to show unavailable modal
          const audioEl = audio as HTMLAudioElement;
          audioEl.style.opacity = "0.7";

          // Get potential URL from module.xml for retry
          let potentialUrl: string | null = null;
          if (courseId) {
            try {
              const moduleXml = await loadFileFromCourse(
                courseId,
                "module.xml",
              );
              if (moduleXml) {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(moduleXml, "text/xml");
                const xmlMediaFiles = xmlDoc.querySelectorAll("file");
                const normalizedSearchName = normalizeFilename(audioFilename);

                for (const file of Array.from(xmlMediaFiles)) {
                  const xmlFilename = file.getAttribute("filename");
                  const downloadUrl = file.getAttribute("download_url");

                  if (!xmlFilename || !downloadUrl) continue;

                  // Try both exact and normalized match
                  if (
                    xmlFilename === audioFilename ||
                    normalizeFilename(xmlFilename) === normalizedSearchName
                  ) {
                    potentialUrl = downloadUrl;
                    break;
                  }
                }
              }
            } catch (e) {}
          }

          // If still no URL, try streaming data as fallback
          if (!potentialUrl) {
            potentialUrl = getMediaUrlFromStreamingData(audioFilename);
            if (potentialUrl) {
            }
          }

          audioEl.addEventListener("play", (e) => {
            e.preventDefault();
            setUnavailableMediaModal({
              isOpen: true,
              mediaName: audioFilename,
              mediaType: "audio",
              downloadUrl: potentialUrl || undefined,
              retrying: false,
            });
          });
        }
      }
    };

    handleAudioFiles();

    // Fix navigation buttons to work on desktop (add click handlers in addition to touchstart)
    const fixNavigationButtons = () => {
      const wrapper = getContentWrapper();
      if (!wrapper) {
        // No wrapper means no content, report false if we haven't already
        if (callbackRef.current && lastReportedStateRef.current !== false) {
          lastReportedStateRef.current = false;
          isOnLastSlideRef.current = false;
          isOnFirstSlideRef.current = false;
          callbackRef.current(false, false, false);
        }
        return;
      }

      // Inject !important CSS rules so pagination colors follow the .active
      // class automatically. This overrides any inline style.backgroundColor
      // that may have been set (by initialization or oppia.js), ensuring that
      // when oppia.js toggles the .active class, colors update immediately.
      if (!wrapper.querySelector("[data-pagination-override]")) {
        const paginationOverrideStyle = document.createElement("style");
        paginationOverrideStyle.setAttribute(
          "data-pagination-override",
          "true",
        );
        paginationOverrideStyle.textContent = `
          .moodle-content-wrapper .pagination-item {
            background-color: darkgrey !important;
          }
          .moodle-content-wrapper .pagination-item.active {
            background-color: #04966e !important;
          }
        `;
        wrapper.insertBefore(paginationOverrideStyle, wrapper.firstChild);
      }

      // Check if HTML contains <slides> tag directly
      const hasSlidesTag = html.toLowerCase().includes("<slides");

      // Build candidate slide containers dynamically from actual <slide> nodes.
      // This is more robust than relying only on a fixed set of custom tags,
      // because different courses can use different wrapper elements.
      const allSlides = Array.from(wrapper.querySelectorAll("slide"));
      const parentSections = allSlides
        .map((slide) => slide.parentElement)
        .filter((section): section is HTMLElement => section !== null);

      // Keep known section selectors as fallback for legacy structures.
      const knownSections = Array.from(
        wrapper.querySelectorAll(
          "content-section, audio-section, info-section, noor-section, definition-section, intro-section, video-section, what-we-learned-section, chapter-section, index-section, activity-time-section",
        ),
      ).filter(
        (section): section is HTMLElement => section instanceof HTMLElement,
      );

      const sections = Array.from(
        new Set<HTMLElement>([...parentSections, ...knownSections]),
      );

      // Check if any section has slides with navigation buttons
      let hasSlidesWithNavigation = hasSlidesTag || allSlides.length > 1;
      // Track slide positions for all sections
      const sectionSlideStates = new Map<
        Element,
        { current: number; total: number }
      >();

      sections.forEach((section) => {
        // Use direct slides under this section when possible; fallback to
        // direct-child <content> elements.  We MUST use `:scope >` for
        // the <content> fallback so that <content> tags nested inside
        // other elements (e.g. <card><content>…) are NOT counted as
        // slides — that would falsely flag the section as a slider,
        // hide the Next button, and block navigation.
        const directSlides = section.querySelectorAll(":scope > slide");
        const slides =
          directSlides.length > 0
            ? directSlides
            : section.querySelectorAll(":scope > slide, :scope > content");

        if (slides.length > 1) {
          // Multiple slides means this section has internal navigation
          hasSlidesWithNavigation = true;
        }

        if (slides.length === 0) {
          return;
        }

        const prevBtn = section.querySelector("#prevBtn");
        const nextBtn = section.querySelector("#nextBtn");

        // If buttons don't exist, mark as having slides but skip button setup
        if (!prevBtn || !nextBtn) {
          // Even if buttons aren't found yet, if slides exist, mark as having slides
          // Buttons might be created dynamically by oppia.js
          if (slides.length > 1) {
            hasSlidesWithNavigation = true;
          }
          // Skip button setup but continue to mark as having slides
          return;
        }

        let currentSlide = 0;
        // Calculate slide geometry including margins so scrolling aligns slides correctly
        const firstSlide = slides[0] as HTMLElement;
        const slideRect = firstSlide.getBoundingClientRect();
        const slideWidth = slideRect.width;
        const slideStyle = window.getComputedStyle(firstSlide);
        const marginLeft = parseFloat(slideStyle.marginLeft || "0") || 0;
        const marginRight = parseFloat(slideStyle.marginRight || "0") || 0;
        const totalSlideWidth = slideWidth + marginLeft + marginRight;
        const totalSlides = slides.length;

        // Initialize slide state for this section
        sectionSlideStates.set(section, { current: 0, total: totalSlides });

        // Function to check if any section is on its last slide
        const checkIfOnLastSlide = () => {
          // Check if ANY section with slides is on its last slide
          // This allows course navigation to show when user finishes viewing slides in any section
          for (const [sec, state] of sectionSlideStates.entries()) {
            if (state.total > 1 && state.current === state.total - 1) {
              // This section is on its last slide
              return true;
            }
          }
          return false;
        };

        // Function to check if all sections are on their first slide
        const checkIfOnFirstSlide = () => {
          // Check if ALL sections with slides are on their first slide
          for (const [sec, state] of sectionSlideStates.entries()) {
            if (state.total > 1 && state.current !== 0) {
              // This section is not on its first slide
              return false;
            }
          }
          return sectionSlideStates.size > 0; // Return true if we have sections and all are on first slide
        };

        // Function to update slide position and notify parent
        const updateSlidePosition = (newSlideIndex: number) => {
          // Safety check: ensure buttons exist before using them
          if (!prevBtn || !nextBtn) {
            return;
          }

          currentSlide = newSlideIndex;
          // Update state for this section
          const state = sectionSlideStates.get(section);
          if (state) {
            state.current = newSlideIndex;
          }

          // Update button visibility
          (prevBtn as HTMLElement).style.visibility =
            currentSlide === 0 ? "hidden" : "visible";
          (nextBtn as HTMLElement).style.visibility =
            currentSlide === slides.length - 1 ? "hidden" : "visible";

          // Sync pagination progress with current slide.
          // Needed because renderer-managed navigation (scroll/click handlers)
          // can bypass oppia.js changeSlide(), leaving dots stale.
          // Target ONLY the direct .pagination container child to avoid duplicates.
          const paginationContainer = section.querySelector(
            ":scope > .pagination",
          );

          if (paginationContainer) {
            const paginationItems =
              paginationContainer.querySelectorAll(".pagination-item");

            if (paginationItems.length > 0) {
              // Only toggle classes — the injected !important CSS handles colors.
              // NEVER set inline backgroundColor: it blocks CSS from responding
              // to oppia.js class toggles.
              paginationItems.forEach((item, index) => {
                if (index <= currentSlide) {
                  item.classList.add("active");
                } else {
                  item.classList.remove("active");
                }
              });
            }
          }

          // Check if we're on the last slide across all sections
          const isOnLastSlide = checkIfOnLastSlide();
          // Check if we're on the first slide across all sections
          const isOnFirstSlide = checkIfOnFirstSlide();

          // Notify parent about slide position if activity has slides
          // Only notify if slide position actually changed to prevent infinite loops
          const slideStateChanged =
            lastReportedLastSlideRef.current !== isOnLastSlide ||
            lastReportedFirstSlideRef.current !== isOnFirstSlide;

          if (
            hasSlidesWithNavigation &&
            callbackRef.current &&
            slideStateChanged
          ) {
            isOnLastSlideRef.current = isOnLastSlide;
            isOnFirstSlideRef.current = isOnFirstSlide;
            lastReportedLastSlideRef.current = isOnLastSlide;
            lastReportedFirstSlideRef.current = isOnFirstSlide;
            callbackRef.current(true, isOnLastSlide, isOnFirstSlide);
          } else {
          }
        };

        // Add scroll listener to track slide position (only if buttons exist)
        if (prevBtn && nextBtn) {
          let scrollTimeout: NodeJS.Timeout;
          let isScrolling = false; // Prevent multiple simultaneous scroll updates
          section.addEventListener("scroll", () => {
            if (isScrolling) return; // Skip if already processing scroll
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
              isScrolling = true;
              const containerEl = section as HTMLElement;
              const scrollLeft = containerEl.scrollLeft;

              // Use slide center positions to determine the nearest slide to container center
              const containerCenter = scrollLeft + containerEl.clientWidth / 2;
              let closestIndex = 0;
              let closestDistance = Infinity;
              for (let i = 0; i < slides.length; i++) {
                const s = slides[i] as HTMLElement;
                const slideCenter = s.offsetLeft + s.offsetWidth / 2;
                const dist = Math.abs(slideCenter - containerCenter);
                if (dist < closestDistance) {
                  closestDistance = dist;
                  closestIndex = i;
                }
              }

              const newSlideIndex = closestIndex;

              // Only update if slide actually changed and is valid
              if (
                newSlideIndex !== currentSlide &&
                newSlideIndex >= 0 &&
                newSlideIndex < slides.length
              ) {
                updateSlidePosition(newSlideIndex);
              }
              isScrolling = false;
            }, 150); // Slightly longer delay to debounce scroll events
          });

          // Add click handler for prev button
          prevBtn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();

            if (currentSlide > 0) {
              const newSlideIndex = currentSlide - 1;
              const containerEl = section as HTMLElement;
              const targetSlide = slides[newSlideIndex] as HTMLElement;
              // Center the target slide using its actual offset (more robust)
              const centerOffset = Math.max(
                0,
                Math.floor(
                  (containerEl.clientWidth - targetSlide.offsetWidth) / 2,
                ),
              );
              const targetLeft = Math.max(
                0,
                targetSlide.offsetLeft - centerOffset,
              );
              containerEl.scroll({
                left: targetLeft,
                behavior: "smooth",
              });
              updateSlidePosition(newSlideIndex);
            }
          });

          // Add touchstart handler for prev button (mobile: oppia.js touchstart
          // calls preventDefault which blocks click, so we need touchstart too)
          prevBtn.addEventListener("touchstart", function (e) {
            // Don't preventDefault — let oppia.js handle its own scroll.
            // Just sync pagination after a short delay to let oppia.js finish.
            setTimeout(() => {
              if (currentSlide > 0) {
                updateSlidePosition(currentSlide - 1);
              }
            }, 50);
          });

          // Add click handler for next button
          nextBtn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();

            if (currentSlide < slides.length - 1) {
              const newSlideIndex = currentSlide + 1;
              const containerEl = section as HTMLElement;
              const targetSlide = slides[newSlideIndex] as HTMLElement;
              // Center the target slide using its actual offset (more robust)
              const centerOffset = Math.max(
                0,
                Math.floor(
                  (containerEl.clientWidth - targetSlide.offsetWidth) / 2,
                ),
              );
              const targetLeft = Math.max(
                0,
                targetSlide.offsetLeft - centerOffset,
              );
              containerEl.scroll({
                left: targetLeft,
                behavior: "smooth",
              });
              updateSlidePosition(newSlideIndex);
            }
          });

          // Add touchstart handler for next button (mobile: oppia.js touchstart
          // calls preventDefault which blocks click, so we need touchstart too)
          nextBtn.addEventListener("touchstart", function (e) {
            // Don't preventDefault — let oppia.js handle its own scroll.
            // Just sync pagination after a short delay to let oppia.js finish.
            setTimeout(() => {
              if (currentSlide < slides.length - 1) {
                updateSlidePosition(currentSlide + 1);
              }
            }, 50);
          });

          // Initialize button visibility
          (prevBtn as HTMLElement).style.visibility = "hidden";
          (nextBtn as HTMLElement).style.visibility =
            slides.length > 1 ? "visible" : "hidden";

          // Initialize pagination state for first slide.
          // Target ONLY the direct .pagination container child to avoid duplicates.
          const initialPaginationContainer = section.querySelector(
            ":scope > .pagination",
          );

          if (initialPaginationContainer) {
            const initialPaginationItems =
              initialPaginationContainer.querySelectorAll(".pagination-item");

            if (initialPaginationItems.length > 0) {
              // Only toggle classes — the injected !important CSS handles colors.
              // NEVER set inline backgroundColor: it would block CSS from
              // responding to oppia.js class toggles later.
              initialPaginationItems.forEach((item, index) => {
                if (index === 0) {
                  item.classList.add("active");
                } else {
                  item.classList.remove("active");
                }
              });
            }
          }
        }
      });

      if (
        callbackRef.current &&
        lastReportedStateRef.current !== hasSlidesWithNavigation
      ) {
        lastReportedStateRef.current = hasSlidesWithNavigation;

        const initialIsOnLastSlide = false; // Start at first slide
        const initialIsOnFirstSlide = true; // Start at first slide
        isOnLastSlideRef.current = initialIsOnLastSlide;
        isOnFirstSlideRef.current = initialIsOnFirstSlide;
        lastReportedLastSlideRef.current = initialIsOnLastSlide;
        lastReportedFirstSlideRef.current = initialIsOnFirstSlide;
        callbackRef.current(
          hasSlidesWithNavigation,
          initialIsOnLastSlide,
          initialIsOnFirstSlide,
        );
      } else {
      }

      processedHtmlRef.current = html;
    };

    // htmlChanged was computed earlier (before .finally chain) so both code
    // paths share the same value.

    if (htmlChanged) {
      // DON'T reset processedHtmlRef here - let fixNavigationButtons set it after processing
      // This prevents the cleanup from resetting it and causing infinite loops
      lastReportedStateRef.current = null;
      lastReportedLastSlideRef.current = null;
      lastReportedFirstSlideRef.current = null;
      isOnLastSlideRef.current = false;
      isOnFirstSlideRef.current = true;
      // NOTE: The timeout for fixNavigationButtons is now inside
      // convertExternalScriptsToInline().finally() above so it runs AFTER
      // scripts have finished loading & executing.
    } else {
    }
    // Note: We don't re-run detection if only callback changed - this prevents infinite loops

    // Cleanup function
    return () => {
      isCleanedUp = true;
      // Clear timeout if it was set
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      // DON'T reset processedHtmlRef in cleanup - this causes infinite loops!
      // The cleanup runs when dependencies change, but HTML might be the same
      // Only reset state refs, keep processedHtmlRef to detect actual HTML changes
      const wasReported = lastReportedStateRef.current;
      // CRITICAL FIX: Don't reset processedHtmlRef in cleanup unless HTML actually changed
      // Resetting it unconditionally causes the next effect run to think HTML changed, creating infinite loop
      // Only reset if HTML actually changed (different from what we processed)
      if (processedHtmlRef.current && processedHtmlRef.current !== html) {
        processedHtmlRef.current = "";
      } else {
      }
      // Reset state refs but NOT processedHtmlRef (unless HTML changed)
      lastReportedStateRef.current = null;
      lastReportedLastSlideRef.current = null;
      lastReportedFirstSlideRef.current = null;
      isOnLastSlideRef.current = false;
      isOnFirstSlideRef.current = true;
      // Only notify parent if we had reported true AND HTML is actually changing
      // Don't notify if HTML is the same (just dependency change like mediaFiles)
      if (
        callbackRef.current &&
        wasReported === true &&
        processedHtmlRef.current !== html
      ) {
        callbackRef.current(false, false, false);
      } else {
      }
    };
  }, [html, courseId, serverUrl, shortname]); // Removed mediaFiles and allCourseMedia - they cause infinite loops in streaming mode

  return (
    <>
      <div ref={containerRef} className=" overflow-y-auto pb-40 md:pb-0" />
      {/* Video Modal */}
      <VideoModal
        isOpen={videoModal.isOpen}
        videoUrl={videoModal.videoUrl}
        videoTitle={videoModal.videoTitle}
        posterUrl={videoModal.posterUrl}
        hasError={videoModal.hasError}
        filename={videoModal.filename}
        onClose={() =>
          setVideoModal({ isOpen: false, videoUrl: "", videoTitle: "" })
        }
        onError={() => setVideoModal((prev) => ({ ...prev, hasError: true }))}
        onNext={onNext}
        onThresholdReached={(filename, timeWatched, duration) => {
          if (onVideoTracking) {
            onVideoTracking(filename, timeWatched, duration);
          }
        }}
        onNextWithVideoData={(filename, timeWatched, duration) => {
          // Call the parent's video tracking callback
          if (onVideoTracking) {
            onVideoTracking(filename, timeWatched, duration);
          }
        }}
        onVideoComplete={(timeWatched, duration) => {
          // Notify parent that video finished playing (100%)
          if (onVideoComplete && videoModal.filename) {
            onVideoComplete(videoModal.filename, timeWatched, duration);
          }
        }}
      />
      {/* Unavailable Media Modal */}
      {unavailableMediaModal.isOpen && (
        <div
          className="fixed inset-0 z-99999 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() =>
            setUnavailableMediaModal({
              isOpen: false,
              mediaName: "",
              mediaType: "video",
              retrying: false,
            })
          }>
          <div
            className="relative w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            {/* Modal Content */}
            <div className="p-6">
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                  <WifiOff className="w-8 h-8 text-gray-500" />
                </div>
              </div>

              {/* Title */}
              <h3 className="text-lg font-semibold text-center text-gray-900 mb-2">
                {unavailableMediaModal.mediaType === "video"
                  ? isOnline
                    ? t.media.videoNotAvailable
                    : t.media.videoNotAvailableOffline
                  : unavailableMediaModal.mediaType === "audio"
                    ? isOnline
                      ? t.media.audioNotAvailable
                      : t.media.audioNotAvailableOffline
                    : isOnline
                      ? t.media.fileNotAvailable
                      : t.media.fileNotAvailableOffline}
              </h3>

              {/* Description */}
              <p className="text-sm text-gray-600 text-center mb-2">
                <span className="font-medium break-all">
                  {unavailableMediaModal.mediaName}
                </span>
              </p>
              <p className="text-sm text-gray-500 text-center mb-6">
                {isOnline
                  ? t.media.mediaUnavailableOnlineDesc
                  : t.media.mediaUnavailableOfflineDesc}
              </p>

              {/* Online Status Indicator */}
              <div
                className={`flex items-center justify-center gap-2 mb-4 text-sm ${
                  isOnline ? "text-green-600" : "text-gray-500"
                }`}>
                <div
                  className={`w-2 h-2 rounded-full ${
                    isOnline ? "bg-green-500 animate-pulse" : "bg-gray-400"
                  }`}
                />
                {isOnline ? t.media.connected : t.media.offline}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() =>
                    setUnavailableMediaModal({
                      isOpen: false,
                      mediaName: "",
                      mediaType: "video",
                      retrying: false,
                    })
                  }>
                  {t.common.close}
                </Button>
                <Button
                  className="flex-1 bg-primary-500 hover:bg-primary-600"
                  disabled={
                    !isOnline ||
                    unavailableMediaModal.retrying ||
                    !unavailableMediaModal.downloadUrl
                  }
                  onClick={handleRetryMedia}>
                  {unavailableMediaModal.retrying ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      {t.common.loading}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      {isOnline ? t.media.playNow : t.media.retry}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
