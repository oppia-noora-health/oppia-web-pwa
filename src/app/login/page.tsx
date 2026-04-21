"use client";

import { useLogin, COUNTRIES } from "@/hooks/useLogin";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import ReactCountryFlag from "react-country-flag";
import Link from "next/link";
import { cn } from "@/lib/utils";
import Header from "@/components/authentication/Header";
import BottomMenu from "@/components/BottomMenu";
import Hero from "@/components/authentication/Hero";

export default function LoginWithOTP() {
  const {
    phoneNumber,
    selectedCountry,
    selectedLanguage,
    isLoading,

    error,
    showErrorDialog,
    isValidPhoneNumber,
    dataConsent,
    setDataConsent,
    handleCountryValueChange,
    handleLanguageValueChange,
    handlePhoneNumberChange,
    handleSendOTP,
    closeErrorDialog,
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
    <div className="  min-h-dvh flex flex-col lg:flex-row">
      {/* Left Side - Form */}
      <div className="flex-1 flex justify-center flex-col bg-background p-4 lg:p-12">
        <div className="w-full max-w-lg mx-auto flex flex-col ">
          {/* Header with logo and settings (3-dots) - mobile and desktop */}
          <div className="mb-8 lg:mb-12">
            <Header />
          </div>

          {/* Phone Number Input Screen */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (isValidPhoneNumber() && !isLoading) {
                handleSendOTP();
              }
            }}
            className="space-y-6 flex-1">
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
                  "flex items-center focus-within:border-2  border  shadow-2xs rounded-lg overflow-hidden transition-all",
                  phoneInputState === "error" &&
                    "border-destructive focus-within:border-destructive",
                  phoneInputState === "success" &&
                    "border-green-600 focus-within:border-green-600",
                  (phoneInputState === "default" ||
                    phoneInputState === "filled") &&
                    "border-black/10 focus-within:border-[#10769C]",
                )}>
                <legend
                  className={cn(
                    "ml-2 px-1 text-sm font-normal transition-colors",
                    phoneInputState === "error" && "text-destructive",
                    phoneInputState === "success" && "text-green-600",
                    (phoneInputState === "default" ||
                      phoneInputState === "filled") &&
                      "text-black",
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
                    }}
                    title={selectedCountry.code}
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
                  className="h-9 w-full appearance-none px-4 text-base outline-none bg-none"
                  placeholder="1234567890"
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
            {/* Data Collection Consent */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="dataConsent"
                  checked={dataConsent}
                  onChange={(e) => setDataConsent(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-gray-300 text-[#10769C] focus:ring-[#10769C] focus:ring-2 focus:ring-offset-0 cursor-pointer"
                  disabled={isLoading}
                />
                <label
                  htmlFor="dataConsent"
                  className="text-sm text-gray-700 cursor-pointer leading-relaxed">
                  I consent to the collection and use of my data in accordance
                  with the{" "}
                  <Link
                    href="/privacy-policy"
                    className="text-[#10769C] hover:text-[#0d5f7f] underline">
                    Privacy Policy
                  </Link>
                  .
                </label>
              </div>
            </div>
            {/* Send OTP Button */}
            <div className="pt-4">
              <Button
                type="submit"
                disabled={!isValidPhoneNumber() || !dataConsent || isLoading}
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

      {/* Error Alert Dialog */}
      <AlertDialog open={showErrorDialog} onOpenChange={closeErrorDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <AlertDialogTitle className="text-center text-xl">
              Account Not Found
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-base text-gray-600 pt-2">
              {error}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center mt-4">
            <AlertDialogAction
              onClick={closeErrorDialog}
              className="w-full sm:w-auto px-8 h-12 text-base">
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
