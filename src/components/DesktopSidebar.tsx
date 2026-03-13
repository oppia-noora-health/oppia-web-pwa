"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import {
  useAuthStore,
  useActivityCompletionStore,
  useGamificationPointsStore,
} from "@/store/useStore";
import { useCourseStore } from "@/store/useCourseStore";
import { useGamification } from "@/hooks/useGamification";
import { useTranslation } from "@/hooks/useTranslation";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { fetchUserData } from "@/services/authService";
import { getUserPoints } from "@/utils/gamificationIDB";
import { getUserProfile } from "@/services/userDataService";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Home,
  Trophy,
  Star,
  Book,
  User,
  Settings,
  Lock,
  Info,
  LogOut,
  Compass,
  RefreshCw,
} from "lucide-react";
import { useTour } from "@/hooks/useTour";
import { getCompleteAppTour } from "@/config/tourSteps";
import { API_BASE_URL, getApiUrl } from "@/config/constants";

interface NavItem {
  icon: React.ElementType;
  label: string;
  route: string;
  id?: string; // For tour highlighting
}

interface NavSection {
  label: string;
  items: NavItem[];
}

// Navigation sections structure (labels will be translated in component)
const getNavigationSections = (t: (key: string) => string): NavSection[] => [
  {
    label: t("navigation.home").toUpperCase(),
    items: [
      {
        icon: Home,
        label: t("navigation.home"),
        route: "/course",
        id: "home-nav",
      },
      {
        icon: Trophy,
        label: t("navigation.scoreboard"),
        route: "/scoreboard",
        id: "scorecard-nav",
      },
      {
        icon: Star,
        label: t("navigation.points"),
        route: "/points",
        id: "points-nav",
      },
    ],
  },
  {
    label: t("course.courses").toUpperCase(),
    items: [
      {
        icon: Book,
        label: t("navigation.downloadCourses"),
        route: "/course-management",
        id: "download-courses-nav",
      },
    ],
  },
  {
    label: "MORE",
    items: [
      { icon: User, label: t("navigation.profile"), route: "/profile" },
      { icon: Settings, label: t("navigation.settings"), route: "/settings" },
      { icon: Lock, label: t("navigation.privacy"), route: "/privacy-policy" },
      // { icon: RefreshCw, label: "Synchronise", route: "/synchronise" },
      // { icon: FileText, label: "Activity Log", route: "/activity-log" },
      { icon: Info, label: t("navigation.aboutHelp"), route: "/about-help" },
    ],
  },
];

export default function DesktopSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, updateUser } = useAuthStore();
  const { clearCache } = useCourseStore();
  const { clearAllCompletionData } = useActivityCompletionStore();
  const { clearPoints } = useGamificationPointsStore();
  const { isMobile, setOpenMobile } = useSidebar();
  const { startTour } = useTour("complete-app");
  const { userPoints } = useGamification();
  const { t } = useTranslation();
  const { pendingCount } = useSyncStatus();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const navigationSections = getNavigationSections(t);

  // Detect if the app is pointing at a staging server
  const isStaging = React.useMemo(() => {
    const effectiveUrl = getApiUrl() || API_BASE_URL;
    return /staging/i.test(effectiveUrl);
  }, []);

  // Fetch fresh points only on initial page load (not on navigation)
  React.useEffect(() => {
    const fetchFreshPoints = async () => {
      // Only fetch if online and user is authenticated
      if (!user?.username || !user?.apiKey || !navigator.onLine) return;

      // CRITICAL: Detect if this is an actual page refresh/reload
      // Performance Navigation API tells us if user refreshed the page
      const navigation = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming;
      const isPageReload = navigation?.type === "reload";

      // Use a timestamp-based approach to prevent excessive API calls during navigation
      const sessionKey = `points-last-refresh-${user.id}`;
      const lastRefreshTime = sessionStorage.getItem(sessionKey);
      const now = Date.now();

      // ALWAYS refresh on page reload, but throttle for navigation-based mounts
      if (!isPageReload && lastRefreshTime) {
        const timeSinceRefresh = now - parseInt(lastRefreshTime, 10);
        // Skip if we refreshed less than 5 seconds ago (prevents excessive calls during navigation)
        if (timeSinceRefresh < 5000) {
          return;
        }
      }

      if (isPageReload) {
      }

      try {
        // Update last refresh timestamp
        sessionStorage.setItem(sessionKey, now.toString());

        // Fetch fresh user profile from API
        const userId = user.id
          ? typeof user.id === "string"
            ? parseInt(user.id, 10)
            : user.id
          : undefined;

        const profile = await getUserProfile(userId);

        // Update user store with fresh points data from profile
        if (profile) {
          const oldPoints = user.points || 0;
          const newPoints = profile.points || 0;

          updateUser({
            points: newPoints,
            badges: profile.badges || user.badges,
          });
        }

        // Reset local IndexedDB points since we just fetched fresh from API
        // This prevents double-counting if points were synced in background
        if (userId && !isNaN(userId)) {
          const { resetUserPoints } = await import("@/utils/gamificationIDB");
          await resetUserPoints(userId);
        }
      } catch (error) {}
    };

    fetchFreshPoints();
  }, [user?.id, user?.username, user?.apiKey]); // Re-run when user changes
  const handleNavClick = (route: string) => {
    // Close sidebar on mobile when navigating
    if (isMobile) {
      setOpenMobile(false);
    }
    router.push(route);
  };

  const handleStartTour = () => {
    // Close sidebar on mobile
    if (isMobile) {
      setOpenMobile(false);
    }

    // Navigate to home page first
    router.push("/course");

    // Start tour after a brief delay to ensure navigation completes
    setTimeout(() => {
      const tourSteps = getCompleteAppTour(router);
      startTour(tourSteps);
    }, 300);
  };

  const handleLogout = async () => {
    // Close sidebar on mobile when logging out
    if (isMobile) {
      setOpenMobile(false);
    }

    // Logout function now handles all cleanup (cache, IndexedDB, localStorage, etc.)
    await logout();

    router.push("/login");
  };

  const handleRefreshData = async () => {
    if (!user?.username || !user?.apiKey || isRefreshing) return;

    setIsRefreshing(true);
    try {
      // Clear course cache
      clearCache();

      // Fetch fresh user data from API
      const freshUserData = await fetchUserData(user.username, user.apiKey);

      // Update user store with fresh data
      updateUser({
        points: freshUserData.points,
        badges: freshUserData.badges,
        coursePoints: freshUserData.course_points,
        customFields: freshUserData.custom_fields,
        firstName: freshUserData.first_name,
        lastName: freshUserData.last_name,
      });

      // Refresh gamification points from IndexedDB
      if (user.id) {
        const userId =
          typeof user.id === "string" ? parseInt(user.id, 10) : user.id;
        if (!isNaN(userId)) {
          await getUserPoints(userId);
        }
      }
    } catch (error) {
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Sidebar collapsible="offcanvas">
      {/* Header with Logo and User Info */}
      <SidebarHeader className="border-b p-6">
        <div className="flex items-start justify-start gap-3 mb-6">
          <Image
            src="/logo/logo.svg"
            alt="Noora Academy Logo"
            width={248}
            height={32}
            className=" h-9 md:h-12 w-fit "
          />
        </div>

        {/* User Info Card */}
        <div
          className={`bg-secondary-300 relative overflow-hidden rounded-2xl p-4 ${isStaging && "pl-10"} flex items-center gap-4`}>
          {isStaging && (
            <div
              aria-hidden
              className="absolute top-4 -left-16 md:-left-16 transform -rotate-45 origin-center bg-pink-600 text-white text-xs font-semibold px-16 py-0.5 shadow-sm whitespace-nowrap">
              Staging
            </div>
          )}
          <div className="w-14 h-14 rounded-full bg-linear-to-br from-[#00D5BE] to-[#00B8DB]  flex items-center justify-center text-2xl">
            😊
          </div>
          <div className="flex-1">
            <p className=" text-black text-lg">{user?.firstName || "User"}</p>
            <p className="text-sm text-gray-600">
              {((userPoints || 0) + (user?.points || 0)).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Sync Status Indicator */}
        {pendingCount > 0 && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4 text-amber-600" />
            <span className="text-amber-700">
              {pendingCount} {pendingCount === 1 ? "change" : "changes"} pending
              sync
            </span>
          </div>
        )}
      </SidebarHeader>

      {/* Navigation Content */}
      <SidebarContent className="px-4 py-6">
        {navigationSections.map((section, sectionIndex) => {
          const hideOnMobile = sectionIndex === 0;

          return (
            <SidebarGroup
              key={sectionIndex}
              className={hideOnMobile ? "hidden md:block" : ""}>
              <SidebarGroupLabel className="text-xs font-bold text-gray-500 mb-3 px-3">
                {section.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => {
                    const isActive = pathname === item.route;
                    const Icon = item.icon;

                    return (
                      <SidebarMenuItem key={item.route}>
                        <SidebarMenuButton
                          id={item.id}
                          onClick={() => handleNavClick(item.route)}
                          className={`
                            w-full h-12 cursor-pointer px-4 rounded-xl flex items-center gap-3
                            transition-all duration-200
                            ${
                              isActive
                                ? "bg-primary-500 text-white hover:bg-primary-500 hover:text-white"
                                : " hover:bg-primary-500 hover:text-white"
                            }
                          `}>
                          <Icon className="w-5 h-5" />
                          <span className="">{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      {/* Footer with Logout */}
      <SidebarFooter className="border-t p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="w-full max-w-[200px] h-12 px-4 rounded-xl flex items-center gap-3 text-red-500 hover:bg-red-50 transition-all duration-200">
              <LogOut className="w-5 h-5" />
              <span className="text-base font-medium">{t("auth.logout")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
