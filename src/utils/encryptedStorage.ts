// utils/encryptedStorage.ts

import type { StateStorage } from "zustand/middleware";
import CryptoJS from "crypto-js";

// Secret key for encryption - in production, use environment variable
const ENCRYPTION_KEY =
  process.env.NEXT_PUBLIC_ENCRYPTION_KEY || "noora-health-secret-key-2025";

/**
 * Custom storage adapter for Zustand that uses encrypted localStorage
 * This provides secure storage for auth state
 */
export const encryptedStorage: StateStorage = {
  getItem: (name: string) => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const encryptedData = localStorage.getItem(name);
      if (!encryptedData) {
        return null;
      }

      // Decrypt the data
      const decryptedBytes = CryptoJS.AES.decrypt(
        encryptedData,
        ENCRYPTION_KEY
      );
      const decryptedData = decryptedBytes.toString(CryptoJS.enc.Utf8);

      if (!decryptedData) {
        return null;
      }

      return decryptedData;
    } catch (error) {
      return null;
    }
  },

  setItem: (name: string, value: string) => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      // Encrypt the data
      const encryptedData = CryptoJS.AES.encrypt(
        value,
        ENCRYPTION_KEY
      ).toString();

      localStorage.setItem(name, encryptedData);
    } catch (error) {}
  },

  removeItem: (name: string) => {
    if (typeof window === "undefined") return;

    try {
      localStorage.removeItem(name);
    } catch (error) {}
  },
};
