import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface LoadingProps {
  variant?: "spinner" | "skeleton" | "page";
  text?: string;
  subText?: string;
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
}

export function Loading({
  variant = "spinner",
  text = "Loading...",
  subText,
  size = "md",
  fullScreen = false,
}: LoadingProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const containerClasses = fullScreen
    ? "min-h-dvh w-full flex items-center justify-center "
    : "w-full flex items-center justify-center p-8";

  if (variant === "spinner") {
    return (
      <div className={containerClasses}>
        <div className="text-center">
          <Loader2
            className={`${sizeClasses[size]} animate-spin  text-cyan-500 mx-auto mb-4`}
          />
          {text && <p className="text-lg  text-gray-900">{text}</p>}
          {subText && <p className="text-sm text-gray-500 mt-2">{subText}</p>}
        </div>
      </div>
    );
  }

  if (variant === "skeleton") {
    return (
      <div className={containerClasses}>
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
    );
  }

  if (variant === "page") {
    return (
      <div className={containerClasses}>
        <div className="text-center">
          <Skeleton className="h-8 w-64 mb-4 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    );
  }

  return null;
}

// Specific loading components for common use cases
export function PageLoading({
  text,
  subText,
}: Pick<LoadingProps, "text" | "subText">) {
  return <Loading variant="spinner" fullScreen text={text} subText={subText} />;
}

export function ContentLoading({ text }: Pick<LoadingProps, "text">) {
  return <Loading variant="spinner" size="md" text={text} />;
}

export function SkeletonLoading() {
  return <Loading variant="skeleton" />;
}

export function InlineLoading({
  text,
  size = "sm",
}: Pick<LoadingProps, "text" | "size">) {
  return (
    <Loading variant="spinner" size={size} text={text} fullScreen={false} />
  );
}
