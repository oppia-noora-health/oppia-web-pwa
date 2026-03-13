import type { CourseStructure } from "@/services/courseDownloadService";
import { isPreTestTitle } from "@/utils/preTestStorage";
import { getLocalizedText } from "@/utils/localization";

export interface Lesson {
  id: string;
  title: string;
  activitiesCompleted: number;
  totalActivities: number;
  activities: Activity[];
  password?: string; // Password for password-protected sections
}

export interface Activity {
  id: string;
  title: string;
  type: "page" | "quiz" | "activity" | "feedback";
  completed: boolean;
  digest?: string;
}

/**
 * Extract lesson title from filename or use default pattern
 */
export const extractLessonTitle = (
  filename: string,
  lessonNum: number,
): string => {
  // Map common lesson patterns to titles (can be customized)
  const lessonTitles: Record<number, string> = {
    1: "Setting Context And Understanding",
    2: "Introduction To Care Companion Program",
    3: "Roles And Responsibilities Of Nurses And Noora Academy",
    4: "Understanding The Program Content",
    5: "Implementation And Best Practices",
  };

  const title = `Lesson ${lessonNum}: ${
    lessonTitles[lessonNum] || `Module ${lessonNum}`
  }`;

  return title;
};

/**
 * Extract activity title from filename
 */
export const extractActivityTitle = (filename: string): string => {
  const basename = filename.replace(/\.(html|htm)$/i, "");

  let title: string;

  if (basename.includes("question")) {
    title = "Quiz Question";
  } else if (basename.includes("response")) {
    title = `Quiz Response Option`;
  } else if (basename.includes("feedback")) {
    title = "Quiz Feedback";
  } else {
    // Regular content page
    const parts = basename.split("_");
    const pageNum = parts[1] || "1";
    title = `Content Page ${pageNum}`;
  }

  return title;
};

/**
 * Parse course structure into organized lessons with completion data
 */
export const parseLessonsFromCourse = (
  structure: CourseStructure,
  completionData: Map<string, boolean>,
): Lesson[] => {
  // Group sections into lessons using sectionOrder from XML
  const lessonsMap = new Map<number, Lesson>();

  structure.sections.forEach((section, index) => {
    // Skip pretest sections - they should not appear in lessons
    if (section.type === "quiz") {
      // Check multiple sources for quiz title (meta activities use section.title)
      const rawQuizTitle =
        section.quizData?.title ||
        (section as any).content?.title ||
        section.title;

      // Handle multilingual titles (e.g., {"en": "Pre-test"}, {"kn": "Pre Test"})
      let quizTitle = "";
      if (typeof rawQuizTitle === "object" && rawQuizTitle !== null) {
        quizTitle = getLocalizedText(rawQuizTitle, "");
      } else {
        quizTitle = String(rawQuizTitle || "");
      }

      // Check if this is a pretest (case-insensitive, handles spaces/hyphens)
      if (isPreTestTitle(quizTitle)) {
        return; // Skip this section
      }
    }

    // Use sectionOrder from XML, fallback to extracting from filename
    let lessonNum: number;
    let lessonTitle: string;

    if (section.sectionOrder !== undefined && section.sectionTitle) {
      // Use data from module.xml (keeps original language - Kannada, etc.)
      lessonNum = section.sectionOrder;
      lessonTitle = section.sectionTitle;
    } else {
      // Fallback: extract from filename
      const match = section.htmlFile?.match(/^(\d+)_/);
      lessonNum = match ? parseInt(match[1]) : 1;
      lessonTitle = extractLessonTitle(section.htmlFile || "", lessonNum);
    }

    if (!lessonsMap.has(lessonNum)) {
      lessonsMap.set(lessonNum, {
        id: String(lessonNum),
        title: lessonTitle,
        activitiesCompleted: 0,
        totalActivities: 0,
        activities: [],
        password: section.password, // Store password for the lesson
      });
    }

    const lesson = lessonsMap.get(lessonNum)!;

    // Use XML title if available (preserves original language), otherwise extract from filename
    const activityTitle =
      section.title || extractActivityTitle(section.htmlFile || "");

    // Check if activity is completed using digest
    const isCompleted = section.digest
      ? completionData.get(section.digest) || false
      : false;

    lesson.activities.push({
      id: section.id,
      title: activityTitle,
      type: section.type,
      completed: isCompleted,
      digest: section.digest,
    });

    lesson.totalActivities++;

    // Update completed count
    if (isCompleted) {
      lesson.activitiesCompleted++;
    }
  });

  lessonsMap.forEach((lesson, lessonNum) => {});

  // Sort lessons by order and convert to array
  const sortedLessons = Array.from(lessonsMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, lesson]) => lesson);

  return sortedLessons;
};
