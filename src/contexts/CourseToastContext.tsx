"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { ActivityCompletionToast } from "@/components/course/ActivityCompletionToast";
import { getSetting } from "@/utils/settingsStorage";
import { useAuthStore } from "@/store/useStore";

type ActivityType = "activity" | "media" | "quiz" | "feedback";

interface CourseToastContextValue {
  /** Show the activity completion toast. No-op if points ≤ 0. */
  triggerToast: (
    activityTitle: string,
    points: number,
    courseTitle?: string,
    activityType?: ActivityType,
  ) => void;
}

const CourseToastContext = createContext<CourseToastContextValue>({
  triggerToast: () => {},
});

export function CourseToastProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();
  const [showPointsPopup, setShowPointsPopup] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastData, setToastData] = useState<{
    activityTitle: string;
    courseTitle: string;
    points: number;
    activityType: ActivityType;
  } | null>(null);
  // Stable counter used as the toast key so remounting only happens on a new trigger,
  // not on re-renders, which prevents the double-audio bug.
  const triggerCountRef = useRef(0);
  const [toastKey, setToastKey] = useState(0);

  // Read user-scoped "show_points_popup" setting
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const userId = user?.id?.toString();
        const saved = getSetting("show_points_popup", userId);
        setShowPointsPopup(saved !== "false");
      } catch (_) {}
    }
  }, [user?.id]);

  const triggerToast = useCallback(
    (
      activityTitle: string,
      points: number,
      courseTitle?: string,
      activityType?: ActivityType,
    ) => {
      if (points <= 0) return;
      const resolved = courseTitle || "Course";
      triggerCountRef.current += 1;
      setToastKey(triggerCountRef.current);
      setToastData({
        activityTitle,
        courseTitle: resolved,
        points,
        activityType: activityType || "activity",
      });
      setShowToast(true);
    },
    [],
  );

  const handleClose = useCallback(() => {
    setShowToast(false);
    setToastData(null);
  }, []);

  return (
    <CourseToastContext.Provider value={{ triggerToast }}>
      {children}
      {showPointsPopup && toastData && toastData.points > 0 && (
        <ActivityCompletionToast
          key={toastKey}
          show={showToast}
          activityTitle={toastData.activityTitle}
          courseTitle={toastData.courseTitle}
          pointsEarned={toastData.points}
          onClose={handleClose}
          completionType={toastData.activityType}
        />
      )}
    </CourseToastContext.Provider>
  );
}

export const useCourseToast = () => useContext(CourseToastContext);
