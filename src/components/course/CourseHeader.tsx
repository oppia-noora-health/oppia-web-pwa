"use client";

import { BackButton } from "@/components/ui/back-button";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CourseHeaderProps {
  title: string;
  id?: string;
  onBack: () => void;
  onMenuClick?: () => void;
}

export default function CourseHeader({
  id,
  title,
  onBack,
  onMenuClick,
}: CourseHeaderProps) {
  return (
    <header
      id={id}
      className="sticky top-0 z-99999 bg-white  border-b border-white backdrop-blur-sm px-3 py-2 md:px-4 md:py-1 shadow-sm shrink-0">
      <div className="flex items-center bg-white gap-2 md:gap-3 max-w-7xl mx-auto">
        <BackButton
          onClick={onBack}
          size="sm"
          label=""
          className="p-1.5 md:p-1.5"
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-sm md:text-base font-semibold text-gray-900 truncate">
            {title}
          </h1>
        </div>
      </div>
    </header>
  );
}
