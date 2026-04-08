import { useEffect, useRef, useState } from "react";
import { getApiUrl } from "@/config/constants";

type UseNetworkStatusOptions = {
  pingIntervalMs?: number;
  pingTimeoutMs?: number;
};

function buildPingBaseUrl(): string {
  if (typeof window === "undefined") return "";

  const base = getApiUrl();
  try {
    return new URL(base, window.location.origin).toString();
  } catch {
    return window.location.origin;
  }
}

async function ping(url: string, timeoutMs: number): Promise<boolean> {
  if (!url) return true;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const separator = url.includes("?") ? "&" : "?";
  const pingUrl = `${url}${separator}__ping=${Date.now()}`;

  try {
    await fetch(pingUrl, {
      method: "HEAD",
      cache: "no-store",
      mode: "no-cors",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function useNetworkStatus(options: UseNetworkStatusOptions = {}) {
  const { pingIntervalMs = 15000, pingTimeoutMs = 7000 } = options;
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const pingBaseUrlRef = useRef<string>("");
  const consecutiveFailuresRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    pingBaseUrlRef.current = buildPingBaseUrl();
    let isMounted = true;

    const checkStatus = async () => {
      if (!navigator.onLine) {
        consecutiveFailuresRef.current = 0;
        if (isMounted) setIsOnline(false);
        return;
      }

      const ok = await ping(pingBaseUrlRef.current, pingTimeoutMs);
      if (!isMounted) return;

      if (ok) {
        consecutiveFailuresRef.current = 0;
        setIsOnline(true);
        return;
      }

      // Treat a single failed ping as transient network jitter.
      // Only mark offline after repeated failures.
      consecutiveFailuresRef.current += 1;
      if (consecutiveFailuresRef.current >= 2) {
        setIsOnline(false);
      }
    };

    const handleOnline = () => {
      consecutiveFailuresRef.current = 0;
      if (isMounted) setIsOnline(true);
      checkStatus();
    };

    const handleOffline = () => {
      consecutiveFailuresRef.current = 0;
      if (isMounted) setIsOnline(false);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkStatus();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    checkStatus();
    const intervalId = window.setInterval(checkStatus, pingIntervalMs);

    return () => {
      isMounted = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(intervalId);
    };
  }, [pingIntervalMs, pingTimeoutMs]);

  return { isOnline };
}
