import { scopeCSSToWrapper } from "./cssScoping";

/**
 * Fix relative asset URLs: images = direct server URL, inline style url() = proxy URL.
 */
export function fixRelativeAssetUrls(
  wrapper: HTMLElement | null,
  serverUrl?: string,
  shortname?: string
): void {
  if (!serverUrl || !shortname || !wrapper) return;

  const proxyBase = `/media/courses/${shortname}/`;
  const imageBaseUrl = `${serverUrl.replace(/\/$/, "")}/media/courses/${shortname}/`;

  // Fix image sources for streaming mode.
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

  // Keep inline CSS background URLs proxied.
  const elementsWithStyle = wrapper.querySelectorAll('[style*="url("]');
  elementsWithStyle.forEach((el) => {
    const style = el.getAttribute("style");
    if (!style) return;

    const newStyle = style.replace(
      /url\(["']?(?!https?:\/\/|\/\/|data:|blob:)([^"')]+)["']?\)/gi,
      (_match, urlPath: string) => {
        const cleanPath = urlPath.replace(/^\.\//, "");
        return `url("${proxyBase}${cleanPath}")`;
      }
    );

    if (newStyle !== style) {
      el.setAttribute("style", newStyle);
    }
  });
}

/**
 * Inject scoped wrapper styles to keep Moodle content responsive in app layout.
 */
export function addResponsiveStyles(wrapper: HTMLElement | null): void {
  if (!wrapper) return;

  if (wrapper.querySelector("style[data-responsive-wrapper='true']")) {
    return;
  }

  const responsiveWrapper = document.createElement("style");
  responsiveWrapper.setAttribute("data-responsive-wrapper", "true");
  responsiveWrapper.textContent = `
    .moodle-content-wrapper {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow-x: auto;
    }

    .moodle-content-wrapper img,
    .moodle-content-wrapper video,
    .moodle-content-wrapper iframe {
      max-width: 100%;
      height: auto;
    }

    @media (min-width: 768px) {
      .moodle-content-wrapper {
        max-width: 768px;
        margin: 0 auto;
      }
    }

    @media (min-width: 1024px) {
      .moodle-content-wrapper {
        max-width: 600px;
      }
    }
  `;

  responsiveWrapper.textContent = scopeCSSToWrapper(
    responsiveWrapper.textContent || ""
  );

  wrapper.insertBefore(responsiveWrapper, wrapper.firstChild);
}

/**
 * Scope all inline style tags from Moodle content to prevent global leakage.
 */
export function scopeInlineStyles(wrapper: HTMLElement | null): void {
  if (!wrapper) return;

  const inlineStyles = wrapper.querySelectorAll(
    "style:not([data-responsive-wrapper])"
  );

  inlineStyles.forEach((styleTag) => {
    const originalCSS = styleTag.textContent || "";
    styleTag.textContent = scopeCSSToWrapper(originalCSS);
  });
}
