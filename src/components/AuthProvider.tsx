"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/useStore";
import { usePathname, useRouter } from "next/navigation";
import { Loading } from "./Loading";
import {
  startBackgroundSync,
  stopBackgroundSync,
} from "@/services/gamificationSync";
import { analytics } from "@/lib/analytics";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/verify-otp",
  "/privacy-policy",
  "/offline",
  "/settings",
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const store = useAuthStore();
  const { user, isAuthenticated } = store;
  const [isLoading, setIsLoading] = useState(true);
  const [hasHydrated, setHasHydrated] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Wait for Zustand to hydrate from storage
  useEffect(() => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      // console.log("Zustand hydration finished");
      setHasHydrated(true);
      setIsLoading(false); // Set loading to false immediately after hydration
    });

    // Check if already hydrated
    if (useAuthStore.persist.hasHydrated()) {
      // console.log("Already hydrated");
      setHasHydrated(true);
      setIsLoading(false); // Set loading to false immediately
    }

    // Fallback timeout - if hydration doesn't complete in 2 seconds, proceed anyway
    // This helps with offline scenarios where hydration might be delayed
    const timeoutId = setTimeout(() => {
      if (!hasHydrated) {
        setHasHydrated(true);
        setIsLoading(false);
      }
    }, 2000);

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [hasHydrated]);

  // Initialize auth after hydration - just check, no API calls
  useEffect(() => {
    if (!hasHydrated) return;

    // console.log(
    //   "Auth check - user:",
    //   user?.username,
    //   "authenticated:",
    //   isAuthenticated
    // );

    // Just log the session state, no API validation needed
    if (user?.username && user?.apiKey) {
      // console.log("User session found:", user.username);

      // Set analytics user ID
      analytics.setUserId(user.username);
      analytics.setUserProperties({
        userId: user.id?.toString(),
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
      });

      // Start background sync for gamification trackers
      if (user.id) {
        const userId =
          typeof user.id === "string" ? parseInt(user.id) : user.id;
        // console.log("🎮 [AuthProvider] Starting gamification background sync");
        startBackgroundSync(userId, user.username, user.apiKey);
      }
    } else {
      // console.log("No existing session found");

      // Clear analytics user
      analytics.setUserId("anonymous");

      // Stop background sync if user logs out
      // console.log("🎮 [AuthProvider] Stopping gamification background sync");
      stopBackgroundSync();
    }

    // Cleanup on unmount
    return () => {
      if (!user || !user.id) {
        stopBackgroundSync();
      }
    };
  }, [hasHydrated, user, isAuthenticated]);

  useEffect(() => {
    // Redirect logic after loading is complete
    if (!isLoading) {
      const isPublicRoute = PUBLIC_ROUTES.some((route) =>
        pathname.startsWith(route),
      );

      if (!isAuthenticated && !isPublicRoute) {
        // Use window.location for offline reliability
        if (typeof window !== "undefined" && !navigator.onLine) {
          window.location.href = "/login";
        } else {
          router.push("/login");
        }
      } else if (isAuthenticated && pathname === "/login") {
        // Use window.location for offline reliability
        if (typeof window !== "undefined" && !navigator.onLine) {
          window.location.href = "/course";
        } else {
          router.push("/course");
        }
      }
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  // Show loading state while checking authentication (only for protected routes)
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  if (isLoading && !isPublicRoute) {
    return (
      <div className="">
        <Loading />
      </div>
    );
  }

  return <>{children}</>;
}
