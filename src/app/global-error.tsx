"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
          onClick={reset}
          className="mt-4 text-sm text-primary hover:underline">
          Try again
        </button>
      </body>
    </html>
  );
}
