"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
  version: string;
}

const changelogData = {
  "1.1.0": {
    title: "Version 1.1.0",
    date: "February 18, 2026",
    sections: [
      {
        category: "Bug Fixes",
        improvements: [
          "Fixed scorecard graph displaying wrong data.",
          "Fixed quiz average not showing correctly.",
          "Fixed activity toast showing even after disabling in settings.",
          "Fixed audio slider not working when audio playback is finished.",
          "Fixed course not opening even though it's downloaded in offline mode.",
          "Fixed some sections missing next button.",
          "Changed leaderboard API to leaderboard cohort.",
          "Removed badges API data from points chart.",
          "Fixed right answer display for all quizzes in AP Facility course.",
          "Fixed quiz feedback to show when showfeedback value is 'After question and end of quiz'.",
          "Made 'install app' prompt show every time.",
        ],
      },
      {
        category: "New Features",
        improvements: [
          "Added password lock for course sections.",
          "Added sequencing inside course sections.",
          "Added draft status indicator for draft courses in course management page.",
          "Added course update functionality.",
        ],
      },
      {
        category: "UI/UX Improvements",
        improvements: [
          "Fixed responsiveness of 'What we learnt' card in courses.",
          "Resolved issue where slides did not center when navigating to the next slide in courses.",
          ,
        ],
      },
    ],
  },
};

export function WhatsNewModal({
  isOpen,
  onClose,
  version,
}: WhatsNewModalProps) {
  if (!isOpen) return null;

  const changelog = changelogData[version as keyof typeof changelogData];

  if (!changelog) return null;

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-9999 p-4"
      onClick={onClose}>
      <div
        className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden border border-gray-200 shadow-lg animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="relative px-6 py-6 border-b border-gray-200">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close">
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-2xl font-semibold text-gray-900">What's New</h2>
          <div className="flex items-center gap-3 text-gray-600 mt-1">
            <p className="text-sm font-medium">{changelog.title}</p>
            <span className="text-xs border border-gray-200 px-2.5 py-0.5 rounded-full">
              {changelog.date}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-180px)] px-6 py-6">
          <div className="space-y-6">
            {changelog.sections.map((section, idx) => (
              <div key={idx} className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  {section.category}
                </h3>
                <ul className="space-y-2.5 ml-4">
                  {section.improvements.map((improvement, improvementIdx) => (
                    <li
                      key={improvementIdx}
                      className="text-sm text-gray-700 leading-relaxed list-disc">
                      {improvement}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-white px-6 py-6">
          <Button onClick={onClose} className="w-full  ">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
