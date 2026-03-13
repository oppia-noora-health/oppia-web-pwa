"use client";

import { usePWA } from "@/hooks/usePWA";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PWAStatus() {
  const { isUpdateAvailable, updateApp } = usePWA();

  if (!isUpdateAvailable) {
    return null;
  }

  return (
    <div className="fixed z-9999 bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-blue-500 text-white rounded-lg shadow-lg p-4  flex items-center justify-between">
      <div className="flex items-center gap-3">
        <RefreshCw size={20} />
        <div>
          <p className="font-medium">Update Available</p>
          <p className="text-sm opacity-90">
            A new version is ready to install
          </p>
        </div>
      </div>
      <Button
        onClick={updateApp}
        size="sm"
        className="bg-white text-blue-500 hover:bg-gray-100">
        Update
      </Button>
    </div>
  );
}
