"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Download, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface OfflineErrorProps {
  message?: string;
  courseId?: string;
  showDownloadOption?: boolean;
}

/**
 * Component to display when user tries to access online-only content while offline
 */
export function OfflineError({
  message = "You are offline and this content is not available offline.",
  courseId,
  showDownloadOption = true,
}: OfflineErrorProps) {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    // Set initial status
    updateOnlineStatus();

    // Listen for online/offline events
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  const handleRetry = () => {
    if (navigator.onLine) {
      window.location.reload();
    }
  };

  const handleGoHome = () => {
    router.push("/");
  };

  const handleDownloadCourse = () => {
    if (courseId) {
      router.push(`/course/${courseId}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="mb-6">
        {isOnline ? (
          <Wifi className="w-16 h-16 text-cyan-600 animate-pulse" />
        ) : (
          <WifiOff className="w-16 h-16 text-red-500" />
        )}
      </div>

      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg max-w-md">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-left">
            <h3 className="font-semibold text-red-900 mb-1">
              {isOnline ? "Content Not Available" : "You're Offline"}
            </h3>
            <p className="text-sm text-red-700">{message}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 w-full max-w-xs">
        {!isOnline && (
          <div className="text-sm text-gray-600 mb-4">
            {isOnline ? (
              <p className="flex items-center justify-center gap-2">
                <Wifi className="w-4 h-4 text-green-500" />
                Connection restored
              </p>
            ) : (
              <p className="flex items-center justify-center gap-2">
                <WifiOff className="w-4 h-4 text-red-500" />
                No internet connection
              </p>
            )}
          </div>
        )}

        {isOnline && (
          <Button onClick={handleRetry} className="w-full">
            Try Again
          </Button>
        )}

        <Button onClick={handleGoHome} variant="outline" className="w-full">
          Go to Home
        </Button>
      </div>

      <div className="mt-8 text-sm text-gray-500 max-w-md">
        <p>
          <strong>Tip:</strong> Download courses while online to access them
          anytime, even without internet connection.
        </p>
      </div>
    </div>
  );
}
