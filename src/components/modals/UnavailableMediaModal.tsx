"use client";

import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UnavailableMediaModalProps {
  isOpen: boolean;
  mediaName: string;
  mediaType: "video" | "audio" | "pdf";
  downloadUrl?: string;
  retrying: boolean;
  isOnline: boolean;
  onClose: () => void;
  onRetry: () => void;
}

/**
 * Modal component displayed when media is not available
 * Shows different messages for online/offline states
 * Allows retrying when connection is available
 */
export default function UnavailableMediaModal({
  isOpen,
  mediaName,
  mediaType,
  downloadUrl,
  retrying,
  isOnline,
  onClose,
  onRetry,
}: UnavailableMediaModalProps) {
  if (!isOpen) return null;

  const getTitle = () => {
    if (mediaType === "video") {
      return isOnline ? "Video Not Available" : "Video Not Available Offline";
    } else if (mediaType === "audio") {
      return isOnline ? "Audio Not Available" : "Audio Not Available Offline";
    } else {
      return isOnline ? "File Not Available" : "File Not Available Offline";
    }
  };

  const getDescription = () => {
    return isOnline
      ? "This media is not available. Please try again later or contact support if the issue persists."
      : "This media wasn't downloaded with the course. Connect to the internet to view it.";
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div
        className="relative w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        {/* Modal Content */}
        <div className="p-6">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <WifiOff className="w-8 h-8 text-gray-500" />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-center text-gray-900 mb-2">
            {getTitle()}
          </h3>

          {/* Description */}
          <p className="text-sm text-gray-600 text-center mb-2">
            <span className="font-medium break-all">{mediaName}</span>
          </p>
          <p className="text-sm text-gray-500 text-center mb-6">
            {getDescription()}
          </p>

          {/* Online Status Indicator */}
          <div
            className={`flex items-center justify-center gap-2 mb-4 text-sm ${
              isOnline ? "text-green-600" : "text-gray-500"
            }`}>
            <div
              className={`w-2 h-2 rounded-full ${
                isOnline ? "bg-green-500 animate-pulse" : "bg-gray-400"
              }`}
            />
            {isOnline ? "Connected" : "Offline"}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Close
            </Button>
            <Button
              className="flex-1 bg-primary-500 hover:bg-primary-600"
              disabled={!isOnline || retrying || !downloadUrl}
              onClick={onRetry}>
              {retrying ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {isOnline ? "Play Now" : "Retry"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
