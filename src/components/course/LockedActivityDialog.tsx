"use client";

import { Lock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "@/hooks/useTranslation";
import type { SequencingType } from "@/services/courseDownloadService";

interface LockedActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lockedType: "section" | "activity";
  currentSectionTitle?: string;
  currentActivityTitle?: string;
  isInActivityViewer?: boolean; // true when user is viewing an activity, false when on course modules page
  clickedActivityTitle?: string; // Name of the activity user tried to access (for modules page)
  sequencing?: SequencingType; // Sequencing type to customize messages
}

export default function LockedActivityDialog({
  open,
  onOpenChange,
  lockedType,
  currentSectionTitle,
  currentActivityTitle,
  isInActivityViewer = false,
  clickedActivityTitle,
  sequencing,
}: LockedActivityDialogProps) {
  const { t } = useTranslation();

  const getMessage = () => {
    // Special message for "course" sequencing
    if (sequencing === "course") {
      const activityTitle = t("course.lockedActivity");
      return {
        title: activityTitle !== "course.lockedActivity" ? activityTitle : "Activity Locked",
        description: "Please complete all the previous activities.",
      };
    }

    // Special message for "sequencingThroughSection" sequencing
    if (sequencing === "sequencingThroughSection" && lockedType === "section") {
      const sectionTitle = t("course.lockedSection");
      return {
        title: sectionTitle !== "course.lockedSection" ? sectionTitle : "Section Locked",
        description: "Please complete all activities in the previous section before moving to this section.",
      };
    }

    if (lockedType === "section") {
      const sectionTitle = t("course.lockedSection");
      const sectionDesc = t("course.completePreviousSection");
      return {
        title: sectionTitle !== "course.lockedSection" ? sectionTitle : "Section Locked",
        description:
          sectionDesc !== "course.completePreviousSection"
            ? sectionDesc
            : `Please complete all activities in "${
                currentSectionTitle || "the current section"
              }" before moving to the next section.`,
      };
    }
    
    // Different messages based on context
    if (isInActivityViewer) {
      // User is currently viewing an activity and trying to go to next
      const activityTitle = t("course.lockedActivity");
      const activityDesc = t("course.completeCurrentActivity");
      return {
        title: activityTitle !== "course.lockedActivity" ? activityTitle : "Activity Locked",
        description:
          activityDesc !== "course.completeCurrentActivity"
            ? activityDesc
            : `Please complete the current activity before proceeding to the next activity.`,
      };
    } else {
      // User is on course modules page trying to access a locked activity
      const activityTitle = t("course.lockedActivity");
      return {
        title: activityTitle !== "course.lockedActivity" ? activityTitle : "Activity Locked",
        description: `Please complete previous activities before accessing ${
          clickedActivityTitle || currentActivityTitle || "this activity"
        }.`,
      };
    }
  };

  const { title, description } = getMessage();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Lock className="w-5 h-5 text-amber-600" />
            </div>
            <span>{title}</span>
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base pt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction className="w-full bg-blue-600 hover:bg-blue-700">
            {t("common.ok")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
