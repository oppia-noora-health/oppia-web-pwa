// services/courseService.ts

import { authenticatedGet } from "@/utils/apiClient";
import { API_PATHS } from "../utils/apiPaths";
import { CoursesResponse } from "@/types/course";
import { withOfflineFallback } from "@/utils/networkUtils";
import {
  cacheCoursesList,
  getCachedCoursesList,
} from "@/utils/offlineStorageIDB";

// Define TypeScript interfaces for the response data
interface Course {
  id: string;
  name: string;
  description: string;
  // Add more course fields as needed
}

interface CourseActivity {
  id: string;
  name: string;
  progress: number;
  // Add more activity fields as needed
}

// Function to get all courses (network-aware with offline fallback)
export const getAllCourses = async (): Promise<CoursesResponse> => {
  try {
    const result = await withOfflineFallback(
      // Online action
      async () => {
        const data = await authenticatedGet<CoursesResponse>(
          API_PATHS.SERVER_COURSES(),
        );
        // Cache the response for offline access
        await cacheCoursesList("all", data.courses || []);
        return data;
      },
      // Offline fallback
      async () => {
        const cachedCourses = await getCachedCoursesList("all");
        if (!cachedCourses) {
          throw new Error("No cached courses available offline");
        }
        return { courses: cachedCourses } as CoursesResponse;
      },
    );

    return result.data;
  } catch (error) {
    throw error;
  }
};

// Function to get course information
export const getCourseInfo = async (courseId: string): Promise<Course> => {
  try {
    const data = await authenticatedGet<Course>(
      API_PATHS.COURSE_INFO(courseId),
    );
    return data; // Return course data
  } catch (error) {
    throw error; // Rethrow to handle in the component
  }
};

// Function to get course activity
export const getCourseActivity = async (
  courseId: string,
): Promise<CourseActivity[]> => {
  try {
    const data = await authenticatedGet<CourseActivity[]>(
      API_PATHS.COURSE_ACTIVITY(courseId),
    );
    return data; // Return course activity data
  } catch (error) {
    throw error;
  }
};
