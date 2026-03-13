// utils/cookieStorage.ts

import type { StateStorage } from "zustand/middleware";

/**
 * Custom storage adapter for Zustand that uses cookies
 * This allows Next.js middleware/proxy to access auth state
 */
export const cookieStorage: StateStorage = {
  getItem: (name: string) => {
    if (typeof document === "undefined") return null;

    const cookies = document.cookie.split("; ");
    const cookie = cookies.find((c) => c.startsWith(`${name}=`));

    if (!cookie) return null;

    const value = cookie.split("=")[1];
    return value ? decodeURIComponent(value) : null;
  },

  setItem: (name: string, value: string) => {
    if (typeof document === "undefined") return;

    // Set cookie with 7 days expiration
    const maxAge = 60 * 60 * 24 * 7; // 7 days in seconds
    document.cookie = `${name}=${encodeURIComponent(
      value
    )}; path=/; max-age=${maxAge}; SameSite=Lax`;
  },

  removeItem: (name: string) => {
    if (typeof document === "undefined") return;

    // Remove cookie by setting max-age to 0
    document.cookie = `${name}=; path=/; max-age=0`;
  },
};
