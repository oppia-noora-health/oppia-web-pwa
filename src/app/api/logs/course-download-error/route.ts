import { NextResponse } from "next/server";
import { appendUserLog } from "@/lib/server/fileLogger";

export const runtime = "nodejs";

function normalizeError(error: unknown) {
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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const logPath = await appendUserLog({
      event: "course_download_failed",
      level: "error",
      userId: body?.user?.id ? String(body.user.id) : null,
      username: body?.user?.username ? String(body.user.username) : null,
      context: {
        courseId: body?.course?.id ?? null,
        courseShortname: body?.course?.shortname ?? null,
        courseVersion: body?.course?.version ?? null,
        downloadUrl: body?.course?.downloadUrl ?? null,
        tagId: body?.tagId ?? null,
        tagName: body?.tagName ?? null,
        userAgent: body?.userAgent ?? null,
      },
      error: normalizeError(body?.error),
    });

    return NextResponse.json({
      success: true,
      logPath,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to write log",
      },
      { status: 500 },
    );
  }
}
