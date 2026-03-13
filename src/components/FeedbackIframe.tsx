"use client";

import { useRef, useState, useCallback } from "react";

/** Renders HTML inside an isolated iframe with auto-height.
 *  Provides complete style isolation so Moodle CSS doesn't leak into the app. */
export default function FeedbackIframe({ srcDoc }: { srcDoc: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(150);

  const adjustHeight = useCallback(() => {
    const iframe = iframeRef.current;
    try {
      const body = iframe?.contentDocument?.body;
      if (body) {
        setHeight(body.scrollHeight + 16);
      }
    } catch {
      // cross-origin or not ready
    }
  }, []);

  const onLoad = useCallback(() => {
    adjustHeight();
    // Re-measure after CSS/images load
    setTimeout(adjustHeight, 300);
    setTimeout(adjustHeight, 1000);
  }, [adjustHeight]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      onLoad={onLoad}
      sandbox="allow-same-origin"
      title="Question feedback"
      style={{
        width: "100%",
        height: `${height}px`,
        border: "none",
        display: "block",
      }}
    />
  );
}
