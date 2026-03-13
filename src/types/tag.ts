// Tag types for course grouping

export interface Tag {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  count: number;
  count_new_downloads_enabled: number;
  course_statuses: Record<string, string>; // { courseName: "live" | "draft" | "archived" }
  highlight: boolean;
  order_priority: number;
}

export interface TagsResponse {
  meta: {
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total_count: number;
  };
  tags: Tag[];
}
