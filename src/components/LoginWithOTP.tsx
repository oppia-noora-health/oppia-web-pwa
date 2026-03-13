"use client";

import React from "react";
import { useLogin, COUNTRIES } from "@/hooks/useLogin";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";
import ReactCountryFlag from "react-country-flag";
import Link from "next/link";
import { cn } from "@/lib/utils";
import Header from "./authentication/Header";

export default function LoginWithOTP() {
  const {
    // State
    showOTPInput,
    phoneNumber,
    otp,
    selectedCountry,
    selectedLanguage,
    timer,
    isLoading,
    error,
    otpSentMessage,
    availableChannels,
    otpRefs,

    // Validation helpers
    isValidPhoneNumber,
    isOTPComplete,

    // Handlers
    handleCountryChange,
    handleCountryValueChange,
    handleLanguageChange,
    handleLanguageValueChange,
    handlePhoneNumberChange,
    handleOTPChange,
    handleOTPKeyDown,
    handleOTPPaste,
    handleSendOTP,
    handleVerifyOTP,
    handleResendOTP,
  } = useLogin();

  // Determine phone input state
  const getPhoneInputState = () => {
    if (error && phoneNumber.length > 0) return "error";
    if (isValidPhoneNumber()) return "success";
    if (phoneNumber.length > 0) return "filled";
    return "default";
  };

  const phoneInputState = getPhoneInputState();

  return (
    <div className=" bg-red-300 flex flex-col lg:flex-row">
      {/* Left Side - Form */}
      <div className="flex-1 flex flex-col bg-background p-6 lg:p-12">
        <div className="w-full max-w-md mx-auto flex flex-col flex-1">
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

          {/* Phone Number Input Screen */}
          <div className="space-y-6 flex-1">
            {/* Country Selector */}
            <div className="space-y-2">
              <label
                htmlFor="country"
                className="block text-base font-normal text-foreground">
                Country
              </label>
              <Select
                value={selectedCountry.name}
                onValueChange={handleCountryValueChange}>
                <SelectTrigger id="country" className="h-14 text-base">
                  <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country.code} value={country.name}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Language Selector */}
            <div className="space-y-2">
              <label
                htmlFor="language"
                className="block text-base font-normal text-gray-700">
                Language
              </label>
              <Select
                value={selectedLanguage}
                onValueChange={handleLanguageValueChange}>
                <SelectTrigger id="language" className="h-14 text-base">
                  <SelectValue placeholder="Select a language" />
                </SelectTrigger>
                <SelectContent>
                  {selectedCountry.languages.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Phone Number Input */}
            <div className="">
              <fieldset
                className={cn(
                  "flex items-center border-2  rounded-lg overflow-hidden transition-all",
                  phoneInputState === "error" &&
                    "border-destructive focus-within:border-destructive",
                  phoneInputState === "success" &&
                    "border-green-600 focus-within:border-green-600",
                  (phoneInputState === "default" ||
                    phoneInputState === "filled") &&
                    "border-primary focus-within:border-primary",
                )}>
                <legend
                  className={cn(
                    "ml-2 px-1 text-sm font-normal transition-colors",
                    phoneInputState === "error" && "text-destructive",
                    phoneInputState === "success" && "text-green-600",
                    (phoneInputState === "default" ||
                      phoneInputState === "filled") &&
                      "text-primary",
                  )}>
                  Phone number
                </legend>
                {/* Flag and Dial Code */}
                <div className="flex items-center  gap-2 px-3  border-r-0">
                  <ReactCountryFlag
                    countryCode={selectedCountry.code}
                    svg
                    style={{
                      width: "1.5em",
                      height: "1.5em",
                      borderRadius: "50%",
                    }}
                    title={selectedCountry.code}
                  />
                  <Icon
                    icon="mdi:chevron-down"
                    className="w-5 h-5 text-gray-600"
                  />
                  <span className="text-gray-700 text-base font-normal">
                    {selectedCountry.dialCode}
                  </span>
                </div>

                {/* Phone Input */}
                <input
                  type="tel"
                  id="phone"
                  value={phoneNumber}
                  onChange={handlePhoneNumberChange}
                  className="h-9   px-4 text-base outline-none bg-white"
                  placeholder="305 1234 5678"
                  maxLength={13}
                  disabled={isLoading}
                />
              </fieldset>

              {/* Helper Text */}
              {phoneInputState === "success" && !error && (
                <p className="text-sm text-gray-600 mt-2">Looking good!</p>
              )}
              {phoneInputState === "error" && error && (
                <p className="text-sm text-red-600 mt-2">{error}</p>
              )}
              {phoneInputState === "default" && (
                <p className="text-sm text-gray-600 mt-2">
                  We will use this number to validate your account.
                </p>
              )}
            </div>

            {/* Send OTP Button */}
            <div className="pt-4">
              <Button
                onClick={handleSendOTP}
                disabled={!isValidPhoneNumber() || isLoading}
                className="w-full h-14 text-base font-normal  disabled:bg-gray-200 disabled:text-gray-400">
                {isLoading ? "Sending..." : "Send OTP"}
              </Button>
            </div>

            {/* Privacy Policy */}
            <div className="text-center pt-8">
              <p className="text-sm text-muted-foreground">
                By registering or logging in, you agree to our{" "}
                <Link
                  href="/privacy-policy"
                  className="hover:text-primary italic underline">
                  Privacy Policy and Terms of Service
                </Link>
              </p>
            </div>

            {/* Powered by */}
            <div className="text-center pt-2">
              <p className="text-sm text-muted-foreground">
                Powered by <span className="italic underline">OppiaMobile</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Illustration (Desktop only) */}
      <div className="hidden lg:flex lg:flex-1 bg-[url('/login/bg.png')] bg-top-right bg-cover bg-no-repeat items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <Image
            src="/login/login-illustration.png"
            alt="Welcome to Noora Academy"
            width={600}
            height={600}
            className="object-contain"
            priority
          />
        </div>
        <div className="relative z-10 text-center text-white max-w-lg mt-auto">
          <h1 className="text-4xl font-bold mb-4">Welcome to Noora Academy</h1>
          <p className="text-lg">
            Noora Academy is a mobile learning platform for delivering learning
            content, video and quizzes
          </p>
        </div>
      </div>
    </div>
  );
}
