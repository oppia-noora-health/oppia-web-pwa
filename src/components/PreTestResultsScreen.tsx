"use client";

import { Button } from "@/components/ui/button";

interface PreTestResultsScreenProps {
  onContinue: () => void;
}

export default function PreTestResultsScreen({
  onContinue,
}: PreTestResultsScreenProps) {
  return (
    <div className="pre-test-results-screen flex items-center justify-center min-h-[60vh] p-6">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Pre-test Completed
          </h2>
          <p className="text-gray-600">
            Thank you for completing the pre-test. You can now continue to the
            course.
          </p>
        </div>

        <Button
          onClick={onContinue}
          className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-3 rounded-xl font-medium w-full sm:w-auto">
          Continue to Course
        </Button>
      </div>
    </div>
  );
}
