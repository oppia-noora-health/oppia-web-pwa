"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAccessLog } from "@/hooks/useAccessLog";

function buildPageName(
  pathname: string,
  searchParams: URLSearchParams,
): string {
  void searchParams;
  return pathname;
}

export function AccessLogTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { logPageVisit, logStreamingPageView } = useAccessLog();
  const lastVisitKeyRef = useRef<string>("");

  useEffect(() => {
    const pageName = buildPageName(pathname, searchParams);
    if (lastVisitKeyRef.current === pageName) {
      return;
    }

    lastVisitKeyRef.current = pageName;

    const details = Object.fromEntries(searchParams.entries());
    void logPageVisit(pageName, details);

    const mode = searchParams.get("mode");
    if (mode === "streaming") {
      void logStreamingPageView({
        pageName,
        details: {
          ...details,
          mode,
        },
      });
    }
  }, [logPageVisit, logStreamingPageView, pathname, searchParams]);

  return null;
}
