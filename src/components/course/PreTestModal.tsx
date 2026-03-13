"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PreTestModalProps {
  onCancel: () => void;
  onOpen: () => void;
}

export default function PreTestModal({ onCancel, onOpen }: PreTestModalProps) {
  const handleCancel = () => {
    onCancel();
  };

  const handleOpen = () => {
    onOpen();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">
          Pre-test Required
        </h2>

        {/* Message */}
        <p className="text-gray-600 text-center mb-6">
          This course has a pre-test and you should complete it to view the
          course activities.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleCancel}
            variant="outline"
            className="flex-1 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-3 rounded-xl font-medium">
            Cancel
          </Button>
          <Button
            onClick={handleOpen}
            className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-xl font-medium">
            Open Pre-test
          </Button>
        </div>
      </div>
    </div>
  );
}
