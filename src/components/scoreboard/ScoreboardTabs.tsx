import React from "react";
import { useTranslation } from "@/hooks/useTranslation";

export type TabType = "overview" | "activity" | "quizzes";

interface ScoreboardTabsProps {
  id?: string;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const ScoreboardTabs: React.FC<ScoreboardTabsProps> = ({
  id,
  activeTab,
  onTabChange,
}) => {
  const { t } = useTranslation();
  const tabs: TabType[] = ["overview", "activity", "quizzes"];

  const getTabLabel = (tab: TabType) => {
    switch (tab) {
      case "overview":
        return t("scoreboard.title");
      case "activity":
        return t("pointsPage.activity");
      case "quizzes":
        return t("course.quizzes");
      default:
        return tab;
    }
  };

  return (
    <div id={id} className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-around">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`py-5 px-4 text-base transition-colors relative ${
                activeTab === tab
                  ? "text-cyan-400 font-normal"
                  : "text-gray-500 font-normal"
              }`}>
              {getTabLabel(tab)}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
