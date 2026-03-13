"use client";

import Image from "next/image";
import Link from "next/link";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

const Header = () => {
  return (
    <div className="flex w-full justify-between items-center mb-8 pt-4">
      <Image
        src="/logo/logo.svg"
        alt="Noora Academy Logo"
        width={180}
        height={50}
        className="h-12 w-auto"
      />
      <Button variant="ghost" size="icon" asChild className="text-gray-700">
        <Link href="/settings" aria-label="Settings">
          <MoreVertical className="size-6" />
        </Link>
      </Button>
    </div>
  );
};

export default Header;
