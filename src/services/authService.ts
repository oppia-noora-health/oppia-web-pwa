// services/authService.ts

import axios from "axios";
import { API_PATHS } from "../utils/apiPaths";

export interface CoursePoint {
  course__shortname: string;
  total_points: number;
}

export interface CustomFields {
  Country: string;
  Department?: string;
  Designation?: string;
  District?: string;
  "Facility Type"?: string;
  Language: string;
  Name?: string;
  "Name of Facility"?: string;
  Province?: string | null;
  "Regency/District"?: string | null;
  State?: string;
}

export interface Metadata {
  BATTERY_LEVEL: boolean;
  DEVICE_ID: boolean;
  NETWORK: boolean;
  NETWORK_CONNECTED: boolean;
  SIM_SERIAL: boolean;
  WIFI_ON: boolean;
}

export interface LoginResponse {
  api_key: string;
  badges: number;
  badging: boolean;
  cohorts: number[];
  course_points: CoursePoint[];
  custom_fields: CustomFields;
  email: string;
  external_api_response: {
    status: string;
  };
  first_name: string;
  job_title: string | null;
  last_login: string;
  last_name: string;
  metadata: Metadata;
  organisation: string | null;
  phone_number: string;
  points: number;
  resource_uri: string;
  scoring: boolean;
  username: string;
}

/**
 * Fetch user data using username and API key
 */
export const fetchUserData = async (
  username: string,
  apiKey: string,
): Promise<LoginResponse> => {
  try {
    const response = await axios.post(API_PATHS.LOGIN(), {
      username,
      api_key: apiKey,
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Legacy User interface for backward compatibility
export interface User {
  id: string;
  phoneNo: string;
  username: string;
  firstName: string;
  lastName: string;
  country: string;
  language: string;
  apiKey?: string;
}

export interface ChannelResponse {
  sms: boolean;
  whatsapp: boolean;
}

export interface ExternalProfileResponse {
  exists: boolean;
  account?: any; // Add proper type based on API response
}

/**
 * Check if external profile exists
 */
export const checkExternalProfile = async (
  phoneNumber: string,
  country: string,
  language: string,
): Promise<ExternalProfileResponse> => {
  try {
    const response = await axios.post(API_PATHS.EXTERNALPROFILE(), {
      phone_number: phoneNumber,
      country,
      language,
    });
    return {
      exists: true,
      account: response.data,
    };
  } catch (error: any) {
    if (error.response?.status === 404) {
      return { exists: false };
    }
    throw new Error(error.response?.data?.error || "Failed to check profile");
  }
};

/**
 * Send OTP to phone number
 */
export const sendOTP = async (
  phoneNumber: string,
  channel: "sms" | "whatsapp" = "sms",
  country?: string,
  language?: string,
): Promise<void> => {
  try {
    const response = await axios.post(API_PATHS.SEND_OTP(), {
      phone_number: phoneNumber,
      channel,
      country,
      language,
    });

    if (response.status !== 200 && response.status !== 201) {
      throw new Error("Failed to send OTP");
    }
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error("Phone number not found");
    }
    throw new Error(error.response?.data?.message || "Failed to send OTP");
  }
};

/**
 * Fetch available channels for resending OTP
 */
export const fetchChannels = async (
  phoneNumber: string,
): Promise<ChannelResponse> => {
  try {
    const response = await axios.post<ChannelResponse>(API_PATHS.CHANNEL(), {
      phone_number: phoneNumber,
    });

    return response.data;
  } catch (error: any) {
    throw new Error(
      error.response?.data?.message || "Failed to fetch channels",
    );
  }
};

/**
 * Verify OTP and login
 */
export const verifyOTP = async (
  phoneNumber: string,
  otpCode: string,
): Promise<LoginResponse> => {
  try {
    const response = await axios.post<LoginResponse>(API_PATHS.LOGIN(), {
      phone_number: phoneNumber,
      code: otpCode,
    });

    // Store the API key for future requests
    if (response.data.api_key) {
      localStorage.setItem("apiKey", response.data.api_key);
      // Set default authorization header for future requests
      axios.defaults.headers.common["Authorization"] =
        `ApiKey ${response.data.username}:${response.data.api_key}`;
    }

    return response.data;
  } catch (error: any) {
    if (error.response?.status === 400) {
      throw new Error("Invalid OTP");
    }
    throw new Error(error.response?.data?.message || "Login failed");
  }
};

/**
 * Logout user
 */
export const logout = (): void => {
  localStorage.removeItem("apiKey");
  delete axios.defaults.headers.common["Authorization"];
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  const apiKey = localStorage.getItem("apiKey");
  return !!apiKey;
};

/**
 * Get stored API key
 */
export const getApiKey = (): string | null => {
  return localStorage.getItem("apiKey");
};
