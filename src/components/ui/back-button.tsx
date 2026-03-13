"use client";

import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as React from "react";

interface BackButtonProps extends React.ComponentProps<typeof Button> {
  label?: string;
  showIcon?: boolean;
  iconSize?: "sm" | "md" | "lg";
}

export function BackButton({
  label = "Back",
  showIcon = true,
  iconSize = "md",
  variant = "ghost",
  className,
  ...props
}: BackButtonProps) {
  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  return (
    <Button
      variant={variant}
      className={cn("text-gray-600 hover:text-gray-900", className)}
      {...props}>
      {showIcon && (
        <ChevronLeft className={cn(iconSizes[iconSize], label && "mr-2")} />
      )}
      {label}
    </Button>
  );
}
