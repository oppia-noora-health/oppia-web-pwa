"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Welcome() {
  return (
    <div className="min-h-dvh w-full flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-card rounded-2xl p-4 shadow-lg space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <Image
            src="/logo/logo.svg"
            alt="Noora Academy Logo"
            width={280}
            height={80}
            className="h-16 w-auto"
          />
        </div>

        {/* Welcome Title */}
        <h1 className="text-2xl font-semibold text-center text-foreground">
          Welcome to Learning Academy
        </h1>

        {/* Description Paragraph 1 */}
        <p className="text-center text-muted-foreground text-base leading-relaxed">
          Learning Academy is a mobile learning platform for delivering learning
          content, video and quizzes.
        </p>

        {/* Description Paragraph 2 */}
        <p className="text-center text-muted-foreground text-base leading-relaxed">
          To begin using Learning Academy, please sign in with your Care
          Companion App or Catal SKS login details. If you don&apos;t have these
          credentials, reach out to the team member at your health facility for
          support.
        </p>

        {/* Privacy Policy Text */}
        <p className="text-center text-muted-foreground text-sm italic">
          By logging in, you agree to our{" "}
          <Link
            href="/privacy-policy"
            className="text-primary hover:text-primary/80 underline underline-offset-2">
            Privacy Policy and Terms of Service
          </Link>
        </p>

        {/* Log in Button */}
        <Button
          asChild
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-base font-medium h-14 rounded-xl transition-colors">
          <Link href="/login">Log in</Link>
        </Button>

        {/* Powered by */}
        <p className="text-center text-muted-foreground text-sm">
          Powered by{" "}
          <span className="text-primary font-medium">OppiaMobile</span>
        </p>
      </div>
    </div>
  );
}
