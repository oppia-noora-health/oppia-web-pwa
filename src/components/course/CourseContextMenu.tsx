import React from "react";
import { Trash2, Download, RotateCcw, RefreshCw } from "lucide-react";
import { useLanguageStore } from "@/store/useLanguageStore";
import { translations } from "@/locales";

interface ContextMenuPosition {
  x: number;
  y: number;
}

interface CourseContextMenuProps<T extends { isDownloaded?: boolean }> {
  position: ContextMenuPosition;
  onDelete?: (data: T) => void;
  onDownload?: (data: T) => void;
  onReset?: (data: T) => void;
  onUpdate?: (data: T) => void;
  data: T;
}

export const CourseContextMenu = <T extends { isDownloaded?: boolean }>({
  position,
  onDelete,
  onDownload,
  onReset,
  onUpdate,
  data,
}: CourseContextMenuProps<T>) => {
  const { language } = useLanguageStore();
  const t = translations[language as keyof typeof translations];
  const isDownloaded = data.isDownloaded ?? true; // Default to true for backward compatibility

  return (
    <div
      className="fixed bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[180px]"
      style={{
        left: `${Math.min(position.x, window.innerWidth - 200)}px`,
        top: `${Math.min(position.y, window.innerHeight - 250)}px`,
      }}
      onClick={(e) => e.stopPropagation()}>
      {!isDownloaded && onDownload && (
        <button
          onClick={() => onDownload(data)}
          className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 text-sm text-gray-700">
          <Download className="w-4 h-4 text-cyan-600" />
          {t.contextMenu.downloadCourse}
        </button>
      )}
      {isDownloaded && (
        <>
          {onDelete && (
            <button
              onClick={() => onDelete(data)}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 text-sm text-red-600">
              <Trash2 className="w-4 h-4" />
              {t.contextMenu.deleteCourse}
            </button>
          )}
          {onReset && (
            <button
              onClick={() => onReset(data)}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 text-sm text-orange-600">
              <RotateCcw className="w-4 h-4" />
              {t.contextMenu.resetProgress}
            </button>
          )}
          {onUpdate && (
            <button
              onClick={() => onUpdate(data)}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 text-sm text-blue-600">
              <RefreshCw className="w-4 h-4" />
              {t.contextMenu.updateActivity}
            </button>
          )}
        </>
      )}
    </div>
  );
};
