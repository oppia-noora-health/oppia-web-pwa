import { NextResponse, NextRequest } from "next/server";
import type { AccessLogInput } from "@/types/accessLog";
import { logAccessEntries } from "@/lib/csvLogger";
import { scheduleCleanupIfNeeded } from "@/lib/logRotation";

export const runtime = "nodejs";
const ACCESS_LOGS_ENABLED =
  process.env.NEXT_PUBLIC_ACCESS_LOGS_ENABLED !== "false";

// Rate limiting state (simple in-memory)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * Simple rate limiting: max 100 requests per minute per IP
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || entry.resetTime < now) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
    return true;
  }

  if (entry.count >= 100) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Get client IP from request
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * Validate request body
 */
function validateRequest(body: unknown): {
  valid: boolean;
  entries?: AccessLogInput[];
  error?: string;
} {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  const { entries } = body as {
    entries?: unknown;
  };

  if (!Array.isArray(entries)) {
    return { valid: false, error: "entries must be an array" };
  }

  if (entries.length === 0) {
    return { valid: false, error: "entries array is empty" };
  }

  if (entries.length > 100) {
    return { valid: false, error: "entries array too large (max 100)" };
  }

  // Validate each entry has required fields
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry || typeof entry !== "object") {
      return { valid: false, error: `Invalid entry at index ${i}` };
    }

    const { event } = entry as Record<string, unknown>;
    if (!event || typeof event !== "string") {
      return { valid: false, error: `Missing event_type at index ${i}` };
    }
  }

  return {
    valid: true,
    entries: entries as AccessLogInput[],
  };
}

export async function POST(request: NextRequest) {
  if (!ACCESS_LOGS_ENABLED) {
    return NextResponse.json(
      { success: true, entriesLogged: 0, disabled: true },
      { status: 200 },
    );
  }

  try {
    const ip = getClientIP(request);

    // Rate limiting
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded" },
        { status: 429 },
      );
    }

    // Parse and validate request
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    const validation = validateRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 },
      );
    }

    const { entries } = validation;

    // Log entries to CSV files (RFC 4180 compliant, daily rotation)
    const result = await logAccessEntries(entries!);

    if (!result.success) {
      console.error("CSV logging failed:", result.errors);
      return NextResponse.json(
        {
          success: false,
          entriesLogged: result.entriesLogged,
          error: "Failed to log entries to CSV storage",
          details: result.errors, // Send all error details to frontend
          errorCount: result.errors.length,
        },
        { status: 500 },
      );
    }

    // Schedule cleanup (non-blocking, doesn't delay response)
    scheduleCleanupIfNeeded();

    return NextResponse.json(
      {
        success: true,
        entriesLogged: result.entriesLogged,
      },
      { status: 200 },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as { code?: string }).code || "UNKNOWN_ERROR";
    const errorStack =
      error instanceof Error ? error.stack?.split("\n").slice(0, 3) : undefined;

    console.error("Access log API fatal error:", {
      code: errorCode,
      message: errorMessage,
      stack: errorStack,
    });

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error while processing access logs",
        errorCode,
        errorMessage,
        details: [
          `Error Code: ${errorCode}`,
          `Message: ${errorMessage}`,
          "This could be a filesystem permission issue or a server configuration problem",
        ],
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/access-logs
 * Health check endpoint (useful for debugging)
 */
export async function GET() {
  if (!ACCESS_LOGS_ENABLED) {
    return NextResponse.json(
      {
        status: "disabled",
        message: "Access log API is disabled by environment flag",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  }

  return NextResponse.json(
    {
      status: "ok",
      message: "Access log API is operational",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
