"use client";

import { CourseToastProvider } from "@/contexts/CourseToastContext";

export default function CourseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CourseToastProvider>{children}</CourseToastProvider>;
}
