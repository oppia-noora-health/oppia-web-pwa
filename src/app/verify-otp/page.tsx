"use client";

import React, { useEffect, useState } from "react";
import { useLogin } from "@/hooks/useLogin";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/authentication/Header";
import BottomMenu from "@/components/BottomMenu";
import Hero from "@/components/authentication/Hero";

export default function VerifyOTPPage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState<string>("");

  const {
    // State
    otp,
    timer,
    isLoading,
    error,
    otpSentMessage,
    availableChannels,
    otpRefs,
    hasStartedTimer,

    // Validation helpers
    isOTPComplete,

    // Handlers
    handleOTPChange,
    handleOTPKeyDown,
    handleOTPPaste,
    handleVerifyOTP,
    handleResendOTP,
    startInitialTimer,
  } = useLogin();

  // Get phone number from session storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedPhone = sessionStorage.getItem("otp_phone_number");
      if (storedPhone) {
        setPhoneNumber(storedPhone);
        // Start timer on first load
        startInitialTimer();
      } else {
        router.push("/login");
      }
    }
  }, [router, startInitialTimer]);

  if (!phoneNumber) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row overflow-x-hidden">
      {/* Left Side - OTP Form */}
      <div className="flex-1 flex flex-col justify-center pt-6 pb-6 pl-6 pr-[max(1.5rem,env(safe-area-inset-right))] lg:p-12 min-w-0">
        <div className="w-full mb-6 max-w-lg mx-auto flex flex-col min-w-0">
          {/* Back Button */}
          <div className="mb-4">
            <BackButton
              onClick={() => router.push("/login")}
              label="Back to Login"
              variant="ghost"
              size="sm"
            />
          </div>

          {/* Header - Only show on mobile */}
          <div className="mb-8 lg:hidden">
            <Header />
          </div>

          {/* Logo - Only show on desktop */}
          <div className="hidden lg:block mb-12">
            <Image
              src="/logo/logo.svg"
              alt="Noora Academy Logo"
              width={180}
              height={50}
              className="h-12 w-auto"
            />
          </div>

          {/* OTP Content */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (isOTPComplete() && !isLoading) {
                handleVerifyOTP();
              }
            }}
            className="space-y-8 flex-1">
            {/* OTP Message */}
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">
                Enter verification code
              </h1>
              <p className="text-base text-muted-foreground whitespace-pre-line">
                {otpSentMessage ||
                  `We have sent a one-time password (OTP) to\n${phoneNumber} for verification`}
              </p>
            </div>
            {/* OTP Input Fields */}
            <div className="flex gap-3 justify-center">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={otpRefs[index]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOTPChange(index, e.target.value)}
                  onKeyDown={(e) => handleOTPKeyDown(index, e)}
                  onPaste={handleOTPPaste}
                  className={`w-12 h-14 text-center text-xl border-2 rounded-lg focus:outline-none transition-colors ${
                    error
                      ? "border-red-500 bg-red-50 text-red-900 focus:border-red-600"
                      : "border-border focus:border-primary"
                  }`}
                  disabled={isLoading}
                />
              ))}
            </div>
            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                <Icon icon="mdi:alert-circle" className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}
            {/* Timer and Resend Options */}
            <div className="space-y-4">
              {timer > 0 ? (
                <p className="text-center text-sm text-[#4A5565]  ">
                  Resend code in{" "}
                  <span className=" text-black ">
                    {Math.floor(timer / 60)}:
                    {(timer % 60).toString().padStart(2, "0")}
                  </span>
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-center text-sm text-muted-foreground">
                    Didn't receive the code?
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => handleResendOTP("sms")}
                      disabled={isLoading}
                      className="w-full text-center text-sm text-primary hover:underline disabled:opacity-50">
                      Resend via SMS
                    </button>
                    {availableChannels.whatsapp && (
                      <button
                        type="button"
                        onClick={() => handleResendOTP("whatsapp")}
                        disabled={isLoading}
                        className="w-full text-center text-sm text-[#25D366] hover:underline disabled:opacity-50 flex items-center justify-center gap-1">
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                        </svg>
                        Send OTP via WhatsApp
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* Verify Button */}
            <Button
              type="submit"
              disabled={!isOTPComplete() || isLoading}
              className="w-full h-14 text-base font-normal disabled:bg-secondary disabled:text-muted-foreground">
              {isLoading ? "Verifying..." : "Verify"}
            </Button>

            <div className="text-center pt-8">
              <p className="text-sm text-muted-foreground">
                By registering or logging in, you agree to our{" "}
                <Link
                  href="/privacy-policy"
                  className="text-primary hover:underline italic underline">
                  Privacy Policy and Terms of Service
                </Link>
              </p>
            </div>

            {/* Powered by */}
            <div className="text-center pt-2">
              <p className="text-sm text-muted-foreground">
                Powered by <span className="italic ">OppiaMobile</span>
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* Right Side - Illustration (Desktop only) */}
      <Hero />

      {/* Bottom Menu */}
      <BottomMenu />
    </div>
  );
}
