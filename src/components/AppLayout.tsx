"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/store/useStore";
import {
  SidebarProvider,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import MobileNavbar from "@/components/MobileNavbar";
import { OfflinePageUnavailable } from "@/components/OfflinePageUnavailable";
import { OfflineErrorBoundary } from "@/components/OfflineErrorBoundary";
import {
  isPathAvailableOffline,
  preCacheStaticPagesOnLogin,
} from "@/utils/pageCaching";
import { StorageQuotaExceededDialog } from "@/components/course/StorageQuotaExceededDialog";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

// Settings is accessible without auth (AuthProvider) but gets sidebar when authenticated
const PUBLIC_ROUTES = ["/login", "/verify-otp", "/offline"];

function SidebarController({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { setOpen, setOpenMobile } = useSidebar();

  // Control sidebar visibility based on route
  useEffect(() => {
    // Close sidebar on course viewer page for full-page experience
    if (pathname.includes("/course/") && pathname.includes("/view")) {
      setOpen(false);
      setOpenMobile(false);
    } else {
      // Open sidebar on all other pages (desktop only, mobile stays as toggle)
      setOpen(true);
    }
  }, [pathname, setOpen, setOpenMobile]);

  return <>{children}</>;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated } = useAuthStore();
  // Use a ping-backed online signal so hard disconnects surface immediately.
  const { isOnline } = useNetworkStatus();

  // When authenticated and online, pre-cache settings/privacy/profile/about-help so they work offline (covers refresh on any page and visit to /course)
  useEffect(() => {
    if (isAuthenticated && isOnline) {
      preCacheStaticPagesOnLogin().catch((err) =>
        void 0
      );
    }
  }, [isAuthenticated, isOnline]);

  // When offline and current page is not in the cached allowlist, show "page not available offline"
  if (!isOnline && !isPathAvailableOffline(pathname)) {
    return <OfflinePageUnavailable />;
  }

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  // Show navigation only when authenticated and not on public routes
  const showNavigation = isAuthenticated && !isPublicRoute;

  // Key resets the boundary when path or online changes so navigation/online recovers from error state
  const boundaryKey = `${pathname}-${isOnline}`;

  if (!showNavigation) {
    // Public pages without sidebar/navbar
    return (
      <OfflineErrorBoundary key={boundaryKey}>
        <>{children}</>
        <StorageQuotaExceededDialog />
      </OfflineErrorBoundary>
    );
  }

  // Authenticated pages with sidebar and navbar — wrap so any page crash shows "page not available" instead of client exception
  return (
    <OfflineErrorBoundary key={boundaryKey}>
      <SidebarProvider defaultOpen={true}>
        <AppSidebar />
        <SidebarInset>
          <SidebarController>
            <main className="w-full min-h-screen pb-20 md:pb-0">
              {children}
            </main>
          </SidebarController>
        </SidebarInset>
        <MobileNavbar />
      </SidebarProvider>
      <StorageQuotaExceededDialog />
    </OfflineErrorBoundary>
  );
}
