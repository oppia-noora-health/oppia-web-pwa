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
  const persistApi = (useActivityCompletionStore as any).persist;
  const hasPersistApi =
    persistApi &&
    typeof persistApi.hasHydrated === "function" &&
    typeof persistApi.onHydrate === "function" &&
    typeof persistApi.onFinishHydration === "function";

  const [hasRehydrated, setHasRehydrated] = useState(
    hasPersistApi ? persistApi.hasHydrated() : true,
  );

  useEffect(() => {
    if (!hasPersistApi) {
      // Fallback for runtimes where Zustand persist API is not attached.
      setHasRehydrated(true);
      return;
    }

    // Zustand persist exposes hydration lifecycle hooks; this is the reliable way
    // to know when persisted state is ready.
    setHasRehydrated(persistApi.hasHydrated());

    const unsubscribeHydrate = persistApi.onHydrate(() => {
      setHasRehydrated(false);
    });

    const unsubscribeFinish = persistApi.onFinishHydration(() => {
      if (typeof window !== "undefined") {
      }
      setHasRehydrated(true);
    });

    return () => {
      unsubscribeHydrate();
      unsubscribeFinish();
    };
  }, [hasPersistApi, persistApi]);

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
