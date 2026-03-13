"use client";

import { useEffect } from "react";
import { OfflinePageUnavailable } from "@/components/OfflinePageUnavailable";

/**
 * Next.js route segment error boundary (error.js convention).
 * Catches uncaught errors during render in the app and shows "page not available offline"
 * instead of the default client-side exception overlay.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {}, [error]);

  return (
    <div className="min-h-screen flex flex-col">
      <OfflinePageUnavailable />
      <div className="flex justify-center pb-8">
        <button
          type="button"
          onClick={reset}
          className="text-sm text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
