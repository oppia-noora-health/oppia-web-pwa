import React from "react";
import type { Activity } from "@/utils/lessonParser";

interface ActivityListProps {
  activities: Activity[];
  onActivityClick: (activityId: string) => void;
}

export const ActivityList: React.FC<ActivityListProps> = ({
  activities,
  onActivityClick,
}) => {
  return (
    <div className="text-sm text-gray-600">
      <p className="mb-3 font-medium">Activities in this lesson:</p>
      <ul className="space-y-2 max-h-96 overflow-y-auto">
        {activities.map((activity) => (
          <li
            key={activity.id}
            onClick={() => onActivityClick(activity.id)}
            className="flex items-center gap-3 py-2 px-3 hover:bg-white rounded-lg transition-colors cursor-pointer">
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${
                activity.completed ? "bg-blue-500" : "bg-gray-300"
              }`}
            />
            <div className="flex-1">
              <span className="text-gray-900">{activity.title}</span>
              {activity.type === "quiz" && (
                <span className="ml-2 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                  Quiz
                </span>
              )}
              {activity.type === "feedback" && (
                <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  Feedback
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
