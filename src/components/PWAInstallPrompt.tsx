"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Share, Plus, MoreVertical } from "lucide-react";
import Image from "next/image";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Detect platform
function getPlatformInfo() {
  if (typeof window === "undefined") {
    return { isIOS: false, isMacOS: false, isAndroid: false, isSafari: false };
  }

  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isMacOS = /macintosh|mac os x/.test(ua) && !("ontouchend" in document);
  const isAndroid = /android/.test(ua);
  const isSafari = /safari/.test(ua) && !/chrome|chromium|crios/.test(ua);

  return { isIOS, isMacOS, isAndroid, isSafari };
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<ReturnType<typeof getPlatformInfo>>({
    isIOS: false,
    isMacOS: false,
    isAndroid: false,
    isSafari: false,
  });
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Detect platform on mount
    setPlatform(getPlatformInfo());

    // Check if app is already installed
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const { isIOS, isMacOS, isSafari } = getPlatformInfo();

    // For iOS/macOS Safari, show manual install instructions
    if ((isIOS || (isMacOS && isSafari)) && !isStandalone) {
      setTimeout(() => {
        const dismissed = localStorage.getItem("pwa-install-dismissed");
        if (!dismissed) {
          setShowInstallPrompt(true);
        }
      }, 3000);
      return;
    }

    // Listen for the beforeinstallprompt event (Chrome, Edge, etc.)
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Save the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show the install prompt after a delay
      setTimeout(() => {
        const dismissed = localStorage.getItem("pwa-install-dismissed");
        if (!dismissed) {
          setShowInstallPrompt(true);
        }
      }, 3000); // Show after 3 seconds
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    // For iOS/macOS Safari, show instructions
    if (platform.isIOS || (platform.isMacOS && platform.isSafari)) {
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) return;

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
    } else {
    }

    // Clear the deferredPrompt
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    setShowIOSInstructions(false);
    localStorage.setItem("pwa-install-dismissed", "true");
  };

  const handleDismissTemporary = () => {
    setShowInstallPrompt(false);
    setShowIOSInstructions(false);
    // Don't set localStorage - will show again next session
  };

  // Check if we should show anything
  const isAppleDevice =
    platform.isIOS || (platform.isMacOS && platform.isSafari);
  const canShowPrompt = isAppleDevice || deferredPrompt;

  // Don't show if already installed or no prompt available
  if (isInstalled || !showInstallPrompt || !canShowPrompt) {
    return null;
  }

  // iOS/macOS Safari Instructions Modal
  if (showIOSInstructions) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
              Install Noora Academy
            </h3>
            <button
              onClick={handleDismissTemporary}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Close">
              <X size={24} />
            </button>
          </div>

          {platform.isIOS ? (
            // iOS Instructions
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Install this app on your iPhone for quick access and offline
                use:
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                    <Share size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      Step 1
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Tap the <strong>Share</strong> button in the browser
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                    <Plus size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      Step 2
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Scroll down and tap{" "}
                      <strong>&quot;Add to Home Screen&quot;</strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // macOS Safari Instructions
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Install this app on your Mac for quick access:
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                    <Share size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      Step 1
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Click <strong>File</strong> in the menu bar
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                    <Plus size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      Step 2
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Select <strong>&quot;Add to Dock&quot;</strong>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">✓</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      Step 3
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Click <strong>&quot;Add&quot;</strong> to confirm
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-2">
            <Button
              onClick={handleDismiss}
              variant="outline"
              className="flex-1">
              Don&apos;t show again
            </Button>
            <Button onClick={handleDismissTemporary} className="flex-1">
              Got it
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-4 border border-gray-200 dark:border-gray-700 z-50 animate-slide-up">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12  rounded-lg flex items-center justify-center overflow-hidden">
            <Image
              src="/logo/logo-icon.svg"
              alt="Noora Academy"
              width={65}
              height={62}
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Install Noora Academy
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Install our app for a better experience
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="Dismiss">
          <X size={20} />
        </button>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleInstallClick} className="flex-1">
          {isAppleDevice ? "How to Install" : "Install App"}
        </Button>
        <Button
          onClick={handleDismissTemporary}
          variant="outline"
          className="flex-1">
          Not Now
        </Button>
      </div>
    </div>
  );
}
