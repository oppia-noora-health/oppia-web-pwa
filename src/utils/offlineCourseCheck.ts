import { loadCourseFromIDB } from "@/utils/courseLoaderIDB";

export interface CourseOfflineCheckResult {
  isAvailable: boolean;
  reason?: string;
  suggestions?: string[];
}

/**
 * Comprehensive check for course offline availability
 * Used to provide user-friendly error messages
 */
export async function checkCourseOfflineAvailability(
  courseId: string,
): Promise<CourseOfflineCheckResult> {
  try {
    if (!courseId || courseId === "undefined" || courseId === "null") {
      return {
        isAvailable: false,
        reason: "Invalid course ID",
        suggestions: ["Please go back and select a valid course"],
      };
    }

    const course = await loadCourseFromIDB(courseId);

    if (!course) {
      return {
        isAvailable: false,
        reason: "Course not downloaded",
        suggestions: [
          "Download this course while online",
          "Connect to the internet and try again",
          "Check your downloads in course management",
        ],
      };
    }

    if (!course.structure) {
      return {
        isAvailable: false,
        reason: "Course data corrupted",
        suggestions: [
          "Delete and re-download this course",
          "Check available storage space",
        ],
      };
    }

    if (!course.structure.sections || course.structure.sections.length === 0) {
      return {
        isAvailable: false,
        reason: "Course has no sections",
        suggestions: ["Course data may be incomplete", "Try downloading again"],
      };
    }

    return {
      isAvailable: true,
      reason: "Course is ready to view offline",
    };
  } catch (error) {
    console.error("[checkCourseOfflineAvailability] Error:", error);
    return {
      isAvailable: false,
      reason: `Error checking course: ${error instanceof Error ? error.message : "Unknown error"}`,
      suggestions: [
        "Try refreshing the page",
        "Check your storage space",
        "Download the course again when online",
      ],
    };
  }
}

/**
 * Get helpful error message for offline course access failures
 */
export function getOfflineCourseErrorMessage(
  courseId: string,
  error?: string,
): {
  title: string;
  message: string;
  actions: Array<{ label: string; action: string }>;
} {
  const defaultMessage = {
    title: "Course Not Available Offline",
    message:
      "This course hasn't been downloaded yet or the download data is corrupted.",
    actions: [
      { label: "Go to Downloads", action: "/course-management" },
      { label: "View Other Courses", action: "/course" },
    ],
  };

  if (error?.includes("network") || error?.includes("offline")) {
    return {
      title: "No Internet Connection",
      message:
        "You're offline and this course isn't available offline. Download it while online to access it anytime.",
      actions: [
        { label: "View Downloaded Courses", action: "/course" },
        { label: "Go Home", action: "/" },
      ],
    };
  }

  if (error?.includes("corrupted") || error?.includes("data")) {
    return {
      title: "Course Data Corrupted",
      message: "The downloaded course data appears to be corrupted.",
      actions: [
        { label: "Delete & Re-download", action: `/course-management` },
        { label: "View Other Courses", action: "/course" },
      ],
    };
  }

  if (error?.includes("storage") || error?.includes("quota")) {
    return {
      title: "Storage Full",
      message:
        "Not enough storage space. Free up space or delete some downloaded courses.",
      actions: [
        { label: "Manage Downloads", action: "/course" },
        { label: "Go Home", action: "/" },
      ],
    };
  }

  return defaultMessage;
}

/**
 * Validate multiple courses for offline availability
 */
export async function validateOfflineCourses(
  courseIds: string[],
): Promise<Record<string, CourseOfflineCheckResult>> {
  const results: Record<string, CourseOfflineCheckResult> = {};

  await Promise.all(
    courseIds.map(async (id) => {
      try {
        results[id] = await checkCourseOfflineAvailability(id);
      } catch {
        results[id] = {
          isAvailable: false,
          reason: "Error checking availability",
        };
      }
    }),
  );

  return results;
}
