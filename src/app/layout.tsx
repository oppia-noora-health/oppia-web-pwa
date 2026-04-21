import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import "driver.js/dist/driver.css";
import "@/styles/tour.css";
import { DebugTools } from "@/components/DebugTools";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { PWAStatus } from "@/components/PWAStatus";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { AuthProvider } from "@/components/AuthProvider";
import { AppLayout } from "@/components/AppLayout";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { ApplySavedSettings } from "@/components/ApplySavedSettings";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Noora Academy",
  description: "Healthcare Learning Platform",
  applicationName: "Noora Academy",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Noora Academy",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/logo/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/logo/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/logo/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    siteName: "Noora Academy",
    title: "Noora Academy - Healthcare Learning Platform",
    description: "Healthcare Learning Platform",
  },
  twitter: {
    card: "summary",
    title: "Noora Academy - Healthcare Learning Platform",
    description: "Healthcare Learning Platform",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="application-name" content="Noora Academy" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Noora Academy" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#667eea" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover"
        />
        <link rel="apple-touch-icon" href="/logo/icon-192x192.png" />
        <link
          rel="icon"
          type="image/png"
          sizes="192x192"
          href="/logo/icon-192x192.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="512x512"
          href="/logo/icon-512x512.png"
        />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${poppins.variable} max-w-screen  antialiased`}>
        <ApplySavedSettings />
        <ServiceWorkerRegistration />
        <AnalyticsProvider>
          <AuthProvider>
            <AppLayout>
              <OfflineBanner />
              {children}
            </AppLayout>
            <PWAStatus />
            <PWAInstallPrompt />
            <DebugTools />
          </AuthProvider>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
