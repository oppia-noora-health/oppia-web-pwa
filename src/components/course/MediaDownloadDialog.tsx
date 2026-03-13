"use client";

import { Download, AlertCircle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Media, MediaDownloadProgress } from "@/types/media";

interface MediaDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingMedia: Media[];
  onDownload: () => void;
  downloadingMedia: boolean;
  downloadProgress: MediaDownloadProgress | null;
}

export default function MediaDownloadDialog({
  open,
  onOpenChange,
  missingMedia,
  onDownload,
  downloadingMedia,
  downloadProgress,
}: MediaDownloadDialogProps) {
  const totalSize = missingMedia.reduce((sum, m) => sum + (m.fileSize || 0), 0);

  return (
    <>
      {/* Missing Media Prompt Dialog */}
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Media Files Not Downloaded
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This course contains {missingMedia.length} video file
                {missingMedia.length > 1 ? "s" : ""} that need to be downloaded
                for offline viewing.
              </p>
              {missingMedia.length > 0 && (
                <div className="rounded-md p-3 max-h-40 overflow-y-auto">
                  <ul className="space-y-1 text-sm">
                    {missingMedia.slice(0, 5).map((media, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <Download className="w-3 h-3 text-gray-400" />
                        <span className="truncate">{media.filename}</span>
                        {media.fileSize && (
                          <span className="text-gray-500 text-xs ml-auto shrink-0">
                            {(media.fileSize / (1024 * 1024)).toFixed(1)} MB
                          </span>
                        )}
                      </li>
                    ))}
                    {missingMedia.length > 5 && (
                      <li className="text-gray-500 text-xs italic">
                        ...and {missingMedia.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              )}
              <p className="text-xs text-gray-600">
                Total size: {(totalSize / (1024 * 1024)).toFixed(1)} MB
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Without Media</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDownload}
              className="bg-cyan-500 hover:bg-cyan-600">
              <Download className="w-4 h-4 mr-2" />
              Download Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Download Progress Indicator */}
      {downloadingMedia && downloadProgress && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm z-50 border border-gray-200">
          <div className="flex items-start gap-3">
            <Loader2 className="w-5 h-5 text-cyan-500 animate-spin shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 mb-1">
                Downloading Media Files
              </p>
              <p className="text-xs text-gray-600 truncate mb-2">
                {downloadProgress.filename}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-cyan-500 h-full transition-all duration-300 ease-out"
                  style={{ width: `${downloadProgress.progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {downloadProgress.progress.toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
