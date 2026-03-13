"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { useTranslation } from "@/hooks/useTranslation";
import { useGamification } from "@/hooks/useGamification";
import { useAuthStore } from "@/store/useStore";

interface NavItem {
  icon: string;
  activeIcon: string;
  label: string;
  route: string;
}

const getNavItems = (t: (key: string) => string): NavItem[] => [
  {
    icon: "/navbar/home.svg",
    activeIcon: "/navbar/hover/home.svg",
    label: t("navigation.home"),
    route: "/",
  },
  {
    icon: "/navbar/scoreboard.svg",
    activeIcon: "/navbar/hover/scoreboard.svg",
    label: t("navigation.scoreboard"),
    route: "/scoreboard",
  },
  {
    icon: "/navbar/points.svg",
    activeIcon: "/navbar/hover/points.svg",
    label: t("navigation.points"),
    route: "/points",
  },
];

export default function MobileNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { userPoints } = useGamification();

  const navItems = getNavItems(t);
  const { user } = useAuthStore();
  const handleNavClick = (route: string) => {
    router.push(route);
  };

  // Hide mobile navbar on course view page
  const isCourseViewPage =
    pathname.startsWith("/course/") && pathname.includes("/view");
  if (isCourseViewPage) {
    return null;
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-white/20 backdrop-blur-sm shadow-lg z-50">
      <div className="flex justify-around items-center h-14 px-3">
        {navItems.map((item) => {
          let isActive = false;

          if (item.route === "/") {
            // Home is active for "/" and "/course" but NOT "/course-management"
            isActive =
              pathname === "/" ||
              (pathname.startsWith("/course") &&
                !pathname.startsWith("/course-management"));
          } else if (item.route === "/course-management") {
            // Course management is active for "/course-management" and its sub-routes
            isActive = pathname.startsWith("/course-management");
          } else {
            // Other routes match exactly
            isActive = pathname === item.route;
          }

          return (
            <button
              key={item.route}
              onClick={() => handleNavClick(item.route)}
              className="flex w-fit flex-col items-center justify-center transition-colors relative">
              {/* Points Badge - Only show for Points page */}
              {item.route === "/points" &&
                (userPoints || 0) + (user?.points || 0) > 0 && (
                  <div className="absolute -top-3 -right-6 z-20 bg-[#F472B6] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded min-w-6 text-center">
                    {((userPoints || 0) + (user?.points || 0)).toLocaleString()}
                  </div>
                )}
              <div className="relative w-4 h-4 mb-0.5">
                <Image
                  src={isActive ? item.activeIcon : item.icon}
                  alt={item.label}
                  width={200}
                  height={20}
                  className="object-contain"
                />
              </div>
              <span
                className={`text-xs leading-tight ${
                  isActive ? "text-[#37B7E6] font-medium" : "text-gray-600"
                }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
