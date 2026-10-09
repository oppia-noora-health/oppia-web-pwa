"use client";

import { useEffect } from "react";

function isChunkLoadError(error: Error) {
  return (
    error.name === "ChunkLoadError" ||
    error.message?.includes("Loading chunk") ||
    error.message?.includes("Failed to fetch dynamically imported module") ||
    error.message?.includes("error loading dynamically imported module") ||
    error.message?.includes("Importing a module script failed")
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!isChunkLoadError(error)) return;
    // Only auto-reload when online — reloading offline won't help and would loop
    if (!navigator.onLine) return;

    // Limit auto-reloads to 2 attempts per session to avoid infinite loops
    const key = "global_error_reload_count";
    const attempts = parseInt(sessionStorage.getItem(key) || "0", 10);
    if (attempts >= 2) return;

    sessionStorage.setItem(key, String(attempts + 1));
    const t = setTimeout(() => window.location.reload(), 1500);
    return () => clearTimeout(t);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col items-center justify-center bg-white p-4">
        <h1 className="text-xl font-semibold text-black mb-2">Noora</h1>
        <p className="text-base text-gray-600 text-center mb-6">
          This page isn&apos;t available right now. You may be offline or the
          page hasn&apos;t been cached yet.
        </p>
        <a
          href="/course"
          className="bg-[#3ABFF8] hover:bg-[#2BA8DB] text-white font-medium px-8 py-3 rounded-full">
          Go to courses
        </a>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 text-sm text-[#3ABFF8] hover:underline">
          Reload page
        </button>
        <button
          type="button"
          onClick={reset}
          className="mt-2 text-xs text-gray-400 hover:underline">
          Try again
        </button>
      </body>
    </html>
  );
}
