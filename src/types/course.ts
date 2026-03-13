/**
 * Course types for API responses
 */

export interface Course {
  id: number;
  shortname: string;
  title: Record<string, string | null>;
  description: Record<string, string | null>;
  author: string;
  username: string;
  organisation: string;
  version: number;
  url: string;
  resource_uri: string;
  restricted: boolean;
  status: "draft" | "live" | "archived";
  priority: number;
}

export interface CoursesResponse {
  courses: Course[];
}
