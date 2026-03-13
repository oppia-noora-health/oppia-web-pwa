"use client";

import React from "react";
import { BackButton } from "@/components/ui/back-button";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function ComingSoonPage() {
  const router = useRouter();

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/other/coming-soon.webp"
            alt="Coming Soon"
            width={180}
            height={50}
            className="h-auto w-[70vw] max-w-[180px] 2xl:max-w-[217px]"
          />
        </div>

        {/* Heading */}
        <h1 className=" text-4xl md:text-6xl font-bold text-foreground">
          COMING SOON
        </h1>

        {/* Description */}
        <p className="text-base text-muted-foreground">
          We're working hard to bring you something amazing. This feature will
          be available soon. Stay tuned!
        </p>

        {/* Back Button */}
        <div className="pt-6">
          <BackButton
            onClick={() => router.back()}
            label="Go to Back"
            className="w-full h-12 text-base font-normal"
          />
        </div>
      </div>
    </div>
  );
}
