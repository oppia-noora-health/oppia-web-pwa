interface CourseDownloadErrorLogInput {
  user?: {
    id?: string;
    username?: string;
  } | null;
  course: {
    id: number;
    shortname: string;
    version: number;
    downloadUrl?: string;
  };
  tagId?: string;
  tagName?: string;
  error: unknown;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    };
  }

  if (typeof error === "string") {
    return {
      message: error,
    };
  }

  return {
    message: "Unknown error",
    details: error,
  };
}

export async function logCourseDownloadError(
  input: CourseDownloadErrorLogInput,
): Promise<void> {
  try {
    await fetch("/api/logs/course-download-error", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user: input.user ?? null,
        course: input.course,
        tagId: input.tagId ?? null,
        tagName: input.tagName ?? null,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : null,
        error: serializeError(input.error),
      }),
    });
  } catch (logError) {
    console.error("Failed to write course download error log", logError);
  }
}
