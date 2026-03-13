// types/auth.ts

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

export interface LoginResponse {
  user: User;
  api_key: string;
  message: string;
}

export interface ChannelResponse {
  sms: boolean;
  whatsapp: boolean;
}

export interface ExternalProfileRequest {
  phone_number: string;
  country: string;
  language: string;
}

export interface SendOTPRequest {
  phone_number: string;
  channel: "sms" | "whatsapp";
}

export interface VerifyOTPRequest {
  phone_number: string;
  otp: string;
  country: string;
  language: string;
}
