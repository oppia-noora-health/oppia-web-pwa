"use client";

import { useAuthStore } from "@/store/useStore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageLoading } from "@/components/Loading";
import Welcome from "@/components/Welcome";

export default function Home() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Small delay to check authentication state
    const timer = setTimeout(() => {
      setIsChecking(false);

      // Only redirect if authenticated
      if (isAuthenticated) {
        router.replace("/course");
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isAuthenticated, router]);

  // Show loading while checking authentication
  if (isChecking) {
    return <PageLoading />;
  }

  // Show welcome page if not authenticated
  if (!isAuthenticated) {
    return <Welcome />;
  }

  // Show loading while redirecting to course
  return <PageLoading />;
}
