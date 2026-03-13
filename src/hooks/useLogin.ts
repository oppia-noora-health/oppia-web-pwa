import { useState, useEffect, useRef, useCallback } from "react";
import {
  sendOTP,
  verifyOTP,
  checkExternalProfile,
  fetchChannels,
} from "@/services/authService";
import { useAuthStore } from "@/store/useStore";
import { useRouter } from "next/navigation";

// Country configurations
export const COUNTRIES = [
  { name: "India", code: "IN", dialCode: "+91", languages: ["English"] },
  { name: "Indonesia", code: "ID", dialCode: "+62", languages: ["English"] },
  {
    name: "Bangladesh",
    code: "BD",
    dialCode: "+880",
    languages: ["English", "Bangla"],
  },
  {
    name: "Nepal",
    code: "NP",
    dialCode: "+977",
    languages: ["English", "Nepali"],
  },
];

export type OTPChannel = "sms" | "whatsapp";

export const useLogin = () => {
  const router = useRouter();
  const { login } = useAuthStore();

  // State management
  const [showOTPInput, setShowOTPInput] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [selectedLanguage, setSelectedLanguage] = useState(
    COUNTRIES[0].languages[0],
  );
  const [timer, setTimer] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [otpSentMessage, setOtpSentMessage] = useState("");
  const [availableChannels, setAvailableChannels] = useState({
    sms: false,
    whatsapp: false,
  });
  const [dataConsent, setDataConsent] = useState(false);
  const [hasStartedTimer, setHasStartedTimer] = useState(false);

  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Format full phone number
  const getFullPhoneNumber = useCallback(() => {
    // Remove any non-numeric characters from the phone number
    const cleanPhoneNumber = phoneNumber.replace(/\D/g, "");

    // Format phone number by adding a space after the first 5 digits and then after the next 5 digits
    const formattedPhoneNumber = `${
      selectedCountry.dialCode
    } ${cleanPhoneNumber.slice(0, 5)} ${cleanPhoneNumber.slice(5, 10)}`;

    return formattedPhoneNumber;
  }, [phoneNumber, selectedCountry.dialCode]);

  // Fetch available channels for resend
  const fetchAvailableChannels = useCallback(async () => {
    try {
      const fullNumber = getFullPhoneNumber();
      const channels = await fetchChannels(fullNumber);
      setAvailableChannels(channels);
    } catch (err) {}
  }, [getFullPhoneNumber]);

  // Timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0 && hasStartedTimer) {
      // Timer finished, fetch available channels
      fetchAvailableChannels();
    }
    return () => clearInterval(interval);
  }, [timer, hasStartedTimer, fetchAvailableChannels]);

  // Validate phone number
  const isValidPhoneNumber = useCallback(() => {
    // Basic validation - adjust based on country-specific rules
    return phoneNumber.length >= 10;
  }, [phoneNumber]);

  // Check if all OTP fields are filled
  const isOTPComplete = useCallback(() => {
    return otp.every((digit) => digit.length === 1);
  }, [otp]);

  // Handle country selection
  const handleCountryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const country = COUNTRIES.find((c) => c.name === e.target.value);
      if (country) {
        setSelectedCountry(country);
        setSelectedLanguage(country.languages[0]);
      }
    },
    [],
  );

  // Handle country selection for shadcn Select
  const handleCountryValueChange = useCallback((value: string) => {
    const country = COUNTRIES.find((c) => c.name === value);
    if (country) {
      setSelectedCountry(country);
      setSelectedLanguage(country.languages[0]);
    }
  }, []);

  // Handle language selection
  const handleLanguageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedLanguage(e.target.value);
    },
    [],
  );

  // Handle language selection for shadcn Select
  const handleLanguageValueChange = useCallback((value: string) => {
    setSelectedLanguage(value);
  }, []);

  // Handle phone number input
  const handlePhoneNumberChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/\D/g, ""); // Only digits
      setPhoneNumber(value);
      setError("");
    },
    [],
  );

  // Handle OTP input
  const handleOTPChange = useCallback((index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    setOtp((prevOtp) => {
      const newOtp = [...prevOtp];
      newOtp[index] = value.slice(-1); // Take only the last digit
      return newOtp;
    });

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs[index + 1].current?.focus();
    }

    setError("");
  }, []);

  // Handle OTP backspace
  const handleOTPKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !otp[index] && index > 0) {
        otpRefs[index - 1].current?.focus();
      }
    },
    [otp],
  );

  // Handle OTP paste
  const handleOTPPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pastedData = e.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, 6);

      setOtp((prevOtp) => {
        const newOtp = [...prevOtp];
        for (let i = 0; i < pastedData.length && i < 6; i++) {
          newOtp[i] = pastedData[i];
        }
        return newOtp;
      });

      // Focus on the next empty field or the last field
      setTimeout(() => {
        const nextEmptyIndex = pastedData.length < 6 ? pastedData.length : 5;
        otpRefs[nextEmptyIndex].current?.focus();
      }, 0);
    },
    [],
  );

  // Send OTP with specific channel
  const sendOTPWithChannel = useCallback(
    async (channel: OTPChannel) => {
      setIsLoading(true);
      setError("");

      try {
        const fullNumber = getFullPhoneNumber();
        await sendOTP(
          fullNumber,
          channel,
          selectedCountry.name,
          selectedLanguage,
        );

        setOtpSentMessage(
          `We have sent a one-time password (OTP) to\n${fullNumber} for verification`,
        );
        setIsLoading(false);

        // Store phone number and context in session storage for OTP page
        if (typeof window !== "undefined") {
          sessionStorage.setItem("otp_phone_number", fullNumber);
          sessionStorage.setItem("otp_country", selectedCountry.name);
          sessionStorage.setItem("otp_language", selectedLanguage);
        }

        // Navigate to verify-otp page
        router.push("/verify-otp");
      } catch (err: any) {
        if (err.message.includes("not found")) {
          setError(
            "Phone number not found. Please contact your nearest Noora Academy team member for assistance.",
          );
        } else {
          setError(err.message || "Failed to send OTP");
        }
        setIsLoading(false);
      }
    },
    [getFullPhoneNumber, selectedCountry.name, selectedLanguage, router],
  );

  // Check external profile and send OTP
  const handleSendOTP = useCallback(async () => {
    if (!isValidPhoneNumber()) {
      setError("Please enter a valid phone number");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const fullNumber = getFullPhoneNumber();

      // Step 1: Check if external profile exists
      const profileResponse = await checkExternalProfile(
        fullNumber,
        selectedCountry.name,
        selectedLanguage,
      );
      if (!profileResponse.exists) {
        setError(
          "Phone number not found. Please contact your nearest Noora Academy team member for assistance.",
        );
        setShowErrorDialog(true);
        setIsLoading(false);
        return;
      }

      // Step 2: Send OTP with country and language
      await sendOTPWithChannel("sms");
    } catch (err: any) {
      const errorMessage = err.message || "Failed to send OTP";
      setError(errorMessage);
      // Show dialog for profile not found errors
      if (
        errorMessage.includes("not found") ||
        errorMessage.includes("contact")
      ) {
        setShowErrorDialog(true);
      }
      setIsLoading(false);
    }
  }, [
    isValidPhoneNumber,
    getFullPhoneNumber,
    selectedCountry.name,
    selectedLanguage,
    sendOTPWithChannel,
  ]);

  // Handle OTP verification and login
  const handleVerifyOTP = useCallback(async () => {
    if (!isOTPComplete()) {
      setError("Please enter the complete OTP");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Get phone number from session storage
      const fullNumber =
        typeof window !== "undefined"
          ? sessionStorage.getItem("otp_phone_number") || ""
          : "";

      if (!fullNumber) {
        setError("Session expired. Please login again.");
        setIsLoading(false);
        router.push("/login");
        return;
      }

      const otpCode = otp.join("");

      // Call LOGIN API with phone_number and code
      const loginResponse = await verifyOTP(fullNumber, otpCode);

      // Store the login response in the auth store
      await login(loginResponse);

      // Clear session storage
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("otp_phone_number");
        sessionStorage.removeItem("otp_country");
        sessionStorage.removeItem("otp_language");
      }

      // Navigate to /course page
      router.push("/course");
    } catch (err: any) {
      setError(err.message || "Invalid OTP. Please try again.");
      setIsLoading(false);
    }
  }, [isOTPComplete, otp, login, router]);

  // Resend OTP
  const handleResendOTP = useCallback(
    async (channel: OTPChannel) => {
      setIsLoading(true);
      setError("");
      setOtp(["", "", "", "", "", ""]);
      setAvailableChannels({ sms: false, whatsapp: false });

      try {
        // Try to get data from sessionStorage first (for verify-otp page)
        let fullNumber = "";
        let country = selectedCountry.name;
        let language = selectedLanguage;

        if (typeof window !== "undefined") {
          const storedPhone = sessionStorage.getItem("otp_phone_number");
          const storedCountry = sessionStorage.getItem("otp_country");
          const storedLanguage = sessionStorage.getItem("otp_language");

          if (storedPhone && storedCountry && storedLanguage) {
            fullNumber = storedPhone;
            country = storedCountry;
            language = storedLanguage;
          } else {
            fullNumber = getFullPhoneNumber();
          }
        } else {
          fullNumber = getFullPhoneNumber();
        }

        await sendOTP(fullNumber, channel, country, language);

        setOtpSentMessage(
          channel === "whatsapp"
            ? `We have sent a one-time password (OTP) via WhatsApp to\n${fullNumber} for verification`
            : `We have sent a one-time password (OTP) to\n${fullNumber} for verification`,
        );

        // Restart the timer to 60 seconds when resending OTP
        setTimer(60);
        setHasStartedTimer(true);

        setIsLoading(false);
      } catch (err: any) {
        if (err.message.includes("not found")) {
          setError(
            "Phone number not found. Please contact your nearest Noora Academy team member for assistance.",
          );
        } else {
          setError(err.message || "Failed to resend OTP");
        }
        setIsLoading(false);
      }
    },
    [sendOTP, selectedCountry.name, selectedLanguage, getFullPhoneNumber],
  );

  // Close error dialog
  const closeErrorDialog = useCallback(() => {
    setShowErrorDialog(false);
  }, []);

  // Start initial timer when OTP screen loads
  const startInitialTimer = useCallback(() => {
    if (!hasStartedTimer) {
      setTimer(60);
      setHasStartedTimer(true);
    }
  }, [hasStartedTimer]);

  return {
    // State
    showOTPInput,
    phoneNumber,
    otp,
    selectedCountry,
    selectedLanguage,
    timer,
    isLoading,
    error,
    showErrorDialog,
    otpSentMessage,
    availableChannels,
    otpRefs,
    dataConsent,
    setDataConsent,
    hasStartedTimer,

    // Validation helpers
    isValidPhoneNumber,
    isOTPComplete,
    getFullPhoneNumber,

    // Handlers
    handleCountryChange,
    handleCountryValueChange,
    handleLanguageChange,
    handleLanguageValueChange,
    startInitialTimer,
    handlePhoneNumberChange,
    handleOTPChange,
    handleOTPKeyDown,
    handleOTPPaste,
    handleSendOTP,
    handleVerifyOTP,
    handleResendOTP,
    closeErrorDialog,
  };
};
