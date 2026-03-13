// utils/useZustandRehydration.ts
// Hook to safely use Zustand stores and wait for rehydration

import { useEffect, useState } from "react";
import { useActivityCompletionStore } from "@/store/useStore";

/**
 * Determines if Zustand stores have finished rehydrating from persistence
 *
 * Usage:
 * const hasRehydrated = useZustandRehydration();
 *
 * if (!hasRehydrated) return <Loading />;
 *
 * const completionData = getCompletionData(...); // Now safe
 */
export function useZustandRehydration(): boolean {
  const [hasRehydrated, setHasRehydrated] = useState(
    useActivityCompletionStore.persist.hasHydrated(),
  );

  useEffect(() => {
    // Zustand persist exposes hydration lifecycle hooks; this is the reliable way
    // to know when persisted state is ready.
    setHasRehydrated(useActivityCompletionStore.persist.hasHydrated());

    const unsubscribeHydrate = useActivityCompletionStore.persist.onHydrate(
      () => {
        setHasRehydrated(false);
      },
    );

    const unsubscribeFinish =
      useActivityCompletionStore.persist.onFinishHydration(() => {
        if (typeof window !== "undefined") {
          console.log(
            "[OFFLINE_TRACKER] Zustand rehydration detected - completion data loaded",
          );
        }
        setHasRehydrated(true);
      });

    return () => {
      unsubscribeHydrate();
      unsubscribeFinish();
    };
  }, []);

  return hasRehydrated;
}

/**
 * Hook that waits for rehydration and returns completion data
 *
 * Usage:
 * const { isRehydrated, completionData } = useCompletionDataWithRehydration(courseId);
 */
export function useCompletionDataWithRehydration(courseId: string | number) {
  const hasRehydrated = useZustandRehydration();
  const { getCompletionData } = useActivityCompletionStore();
  const [completionData, setCompletionData] = useState<Map<
    string,
    boolean
  > | null>(null);

  useEffect(() => {
    if (hasRehydrated) {
      const data = getCompletionData(String(courseId));

      if (typeof window !== "undefined") {
        const count = data?.size || 0;
        console.log(
          `[OFFLINE_TRACKER] Rehydration complete - Retrieved completion data. Course: ${courseId}, Completed: ${count}`,
        );
      }

      setCompletionData(data);
    }
  }, [hasRehydrated, courseId, getCompletionData]);

  return {
    isRehydrated: hasRehydrated,
    completionData,
    completionCount: completionData?.size || 0,
  };
}
