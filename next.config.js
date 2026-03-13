// next-pwa disabled - using custom service worker
/** @type {import('next').NextConfig} */

// API Configuration - centralized URL management
const API_BASE_URL = "https://staging.academy.noorahealth.org";
const API_HOSTNAME = "staging.academy.noorahealth.org"; // Extract hostname for Next.js image config
const API_V2_URL = `${API_BASE_URL}/api/v2`;
const MEDIA_URL = `${API_BASE_URL}/media`;

const nextConfig = {
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    reactCompiler: true,
  },
  compiler: {
    // Remove console.* in production (replaces babel-plugin-transform-remove-console)
    // TEMPORARILY DISABLED for pre-test logging testing
    // removeConsole: process.env.NODE_ENV === "production",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: API_HOSTNAME,
        port: "",
        pathname: "/media/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_V2_URL}/:path*`,
      },
      {
        source: "/media/:path*",
        destination: `${MEDIA_URL}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
