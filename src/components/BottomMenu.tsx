"use client";

import React from "react";
import { useMenuStore } from "@/store/useMenuStore";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";

interface MenuItem {
  icon: string;
  label: string;
  route: string;
}

const menuItems: MenuItem[] = [
  {
    icon: "mdi:cog-outline",
    label: "Settings",
    route: "/coming-soon",
  },
  {
    icon: "mdi:bell-outline",
    label: "Privacy and your data",
    route: "/coming-soon",
  },
  {
    icon: "mdi:account-group-outline",
    label: "About and help",
    route: "/coming-soon",
  },
  {
    icon: "mdi:translate",
    label: "App Language",
    route: "/coming-soon",
  },
];

export default function BottomMenu() {
  const { isMenuOpen, closeMenu } = useMenuStore();
  const router = useRouter();

  const handleMenuItemClick = (route: string) => {
    closeMenu();
    router.push(route);
  };

  return (
    <Sheet open={isMenuOpen} onOpenChange={closeMenu}>
      <SheetContent side="bottom" className="h-auto rounded-t-3xl">
        <SheetHeader className="relative pb-6">
          <button
            onClick={closeMenu}
            className="absolute right-0 top-0 p-2 rounded-full hover:bg-secondary transition-colors">
            <Icon icon="mdi:close" className="w-6 h-6 text-foreground" />
          </button>
          <SheetTitle className="text-left text-xl font-semibold text-foreground">
            Other options
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-2 pb-6">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={() => handleMenuItemClick(item.route)}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors text-left group">
              <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center shrink-0">
                <Icon icon={item.icon} className="w-6 h-6 text-foreground" />
              </div>
              <span className="flex-1 text-base font-medium text-foreground">
                {item.label}
              </span>
              <Icon
                icon="mdi:chevron-right"
                className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors"
              />
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
