/**
 * Offline Completion Tracker Debug Utility
 * Helps diagnose completion data persistence issues
 */

export function debugOfflineCompletion(courseId: string) {
  console.log("\n" + "=".repeat(80));
  console.log("[OFFLINE_TRACKER] DEBUG REPORT");
  console.log("=".repeat(80));

  // Check Zustand rehydration status
  console.log("\n🔄 Zustand Rehydration Status:");
  try {
    const { useActivityCompletionStore } = require("@/store/useStore");
    const state = useActivityCompletionStore.getState() as any;
    const hasHydrated = state._hasHydrated ?? "Unknown";
    console.log(`  Rehydrated: ${hasHydrated}`);

    if (!hasHydrated) {
      console.warn("  ⚠️  Store not yet rehydrated! Data may not be available");
    }
  } catch (e) {
    console.log("  ⚠️  Could not check rehydration status:", e);
  }

  // Check localStorage
  const LOCAL_STORAGE_KEY = "persist:root";
  const rawStorage = localStorage.getItem(LOCAL_STORAGE_KEY);

  console.log("\n📦 localStorage State:");
  console.log(`  Key: ${LOCAL_STORAGE_KEY}`);

  if (rawStorage) {
    try {
      const parsed = JSON.parse(rawStorage);
      const activityCompletion = parsed.activityCompletion
        ? JSON.parse(parsed.activityCompletion)
        : null;

      if (activityCompletion && activityCompletion.completionData) {
        console.log("  ✅ localStorage has activity completion data");

        const courseData = activityCompletion.completionData[courseId];
        if (courseData) {
          const completedCount =
            Object.values(courseData).filter(Boolean).length;
          const totalCount = Object.keys(courseData).length;
          console.log(
            `  📊 Course ${courseId}: ${completedCount}/${totalCount} completed`,
          );
          console.log("  Data:", courseData);
        } else {
          console.log(`  ⚠️  Course ${courseId} not found in localStorage`);
          console.log(
            "  Available courses:",
            Object.keys(activityCompletion.completionData || {}),
          );
        }
      } else {
        console.log("  ❌ activity completion object malformed");
      }
    } catch (e) {
      console.log("  ❌ Error parsing localStorage:", e);
    }
  } else {
    console.log("  ❌ localStorage is empty!");
  }

  // Check Zustand state
  console.log("\n🎯 Zustand In-Memory State:");
  try {
    const { useActivityCompletionStore } = require("@/store/useStore");
    const state = useActivityCompletionStore.getState() as any;
    const courseData = state.completionData?.[courseId];

    if (courseData) {
      const completedCount = Object.values(courseData).filter(Boolean).length;
      const totalCount = Object.keys(courseData).length;
      console.log(
        `  ✅ Course ${courseId}: ${completedCount}/${totalCount} completed`,
      );
      console.log("  Data:", courseData);
    } else {
      console.log(`  ⚠️  Course ${courseId} not in Zustand memory`);
      console.log(
        "  Available courses:",
        Object.keys(state.completionData || {}),
      );
    }
  } catch (e) {
    console.log("  ❌ Error accessing Zustand:", e);
  }

  // Verify persistence integrity
  console.log("\n✔️  Persistence Verification:");
  try {
    const localStorageData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (localStorageData) {
      const parsed = JSON.parse(localStorageData);
      const activityCompletion = parsed.activityCompletion
        ? JSON.parse(parsed.activityCompletion)
        : null;
      const courseDataLocal = activityCompletion?.completionData?.[courseId];

      const { useActivityCompletionStore } = require("@/store/useStore");
      const zustandState = useActivityCompletionStore.getState() as any;
      const courseDataZustand = zustandState.completionData?.[courseId];

      if (
        JSON.stringify(courseDataLocal) === JSON.stringify(courseDataZustand)
      ) {
        console.log("  ✅ localStorage and Zustand are synchronized");
      } else {
        console.warn("  ⚠️  MISMATCH between localStorage and Zustand");
        console.log("  localStorage:", courseDataLocal);
        console.log("  Zustand:", courseDataZustand);
      }
    }
  } catch (e) {
    console.error("  ❌ Error verifying persistence:", e);
  }

  console.log("\n" + "=".repeat(80) + "\n");
}

export function debugOfflineCompletionAllCourses() {
  console.log("\n" + "=".repeat(80));
  console.log("[OFFLINE_TRACKER] DEBUG ALL COURSES");
  console.log("=".repeat(80));

  const LOCAL_STORAGE_KEY = "persist:root";
  const rawStorage = localStorage.getItem(LOCAL_STORAGE_KEY);

  if (rawStorage) {
    try {
      const parsed = JSON.parse(rawStorage);
      const activityCompletion = parsed.activityCompletion
        ? JSON.parse(parsed.activityCompletion)
        : null;

      if (activityCompletion && activityCompletion.completionData) {
        const allCourses = activityCompletion.completionData;
        console.log("\n📚 All Courses with Completion Data:");

        Object.entries(allCourses).forEach(
          ([courseId, data]: [string, any]) => {
            const completedCount = Object.values(data).filter(Boolean).length;
            const totalCount = Object.keys(data).length;
            console.log(
              `  📖 Course ${courseId}: ${completedCount}/${totalCount} activities completed`,
            );
          },
        );
      }
    } catch (e) {
      console.log("  ❌ Error parsing localStorage:", e);
    }
  } else {
    console.log("  ❌ No completion data in localStorage");
  }

  console.log("\n" + "=".repeat(80) + "\n");
}
