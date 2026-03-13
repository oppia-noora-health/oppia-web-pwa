// utils/constants.ts

export const COUNTRIES = [
  {
    name: "India",
    code: "IN",
    dialCode: "+91",
    languages: ["English"],
    phoneLength: 10,
  },
  {
    name: "Indonesia",
    code: "ID",
    dialCode: "+62",
    languages: ["English"],
    phoneLength: 10,
  },
  {
    name: "Bangladesh",
    code: "BD",
    dialCode: "+880",
    languages: ["English", "Bangla"],
    phoneLength: 10,
  },
  {
    name: "Nepal",
    code: "NP",
    dialCode: "+977",
    languages: ["English", "Nepali"],
    phoneLength: 10,
  },
] as const;

export const OTP_LENGTH = 6;
export const OTP_TIMER_SECONDS = 60;
export const PHONE_MIN_LENGTH = 10;

export type CountryCode = (typeof COUNTRIES)[number]["code"];
export type CountryName = (typeof COUNTRIES)[number]["name"];
