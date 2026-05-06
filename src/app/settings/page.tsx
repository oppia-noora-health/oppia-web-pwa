"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import {
  Save,
  RefreshCw,
  ChevronRight,
  Languages,
  AlignLeft,
  Server,
  Sparkles,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { WhatsNewModal } from "@/components/WhatsNewModal";
import { useTranslation } from "@/hooks/useTranslation";
import { API_V2_URL } from "@/config/constants";
import {
  useLanguageStore,
  SUPPORTED_LANGUAGES,
  type LanguageCode,
} from "@/store/useLanguageStore";
import { useTour } from "@/hooks/useTour";
import { getSettingsTour } from "@/config/tourSteps";
import { useAuthStore } from "@/store/useStore";
import { useAccessLog } from "@/hooks/useAccessLog";
import {
  getSetting,
  setSetting,
  applyTextSizeToDocument,
  type TextSize,
} from "@/utils/settingsStorage";

// Supported API URLs
const SUPPORTED_API_URLS = [
  "https://academy-indonesia.noorahealth.org",
  "https://staging.academy.noorahealth.org",
] as const;

// Helper function to normalize URL for comparison (remove trailing slashes and protocol variations)
function normalizeUrl(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, "") // Remove trailing slashes
    .replace(/^https?:\/\//, "") // Remove protocol
    .toLowerCase();
}

// Validate if URL is one of the supported URLs
function isValidApiUrl(url: string): boolean {
  const normalized = normalizeUrl(url);
  return SUPPORTED_API_URLS.some(
    (supportedUrl) => normalizeUrl(supportedUrl) === normalized,
  );
}

function setApiEnvCookie(url: string): void {
  if (typeof document === "undefined") return;

  const normalized = normalizeUrl(url);
  const env = normalized.includes("staging.academy.noorahealth.org")
    ? "staging"
    : "production";

  document.cookie = `api_env=${env}; Path=/; SameSite=Lax`;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { logSettingsUpdate, logSettingsReset } = useAccessLog();
  const userId = user?.id?.toString();
  const { language, setLanguage, getCurrentLanguage } = useLanguageStore();
  const [apiUrl, setApiUrl] = useState("");
  const [previousApiUrl, setPreviousApiUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [invalidUrlWarning, setInvalidUrlWarning] = useState("");
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<"save" | "reset" | null>(
    null,
  );
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showContentLanguageModal, setShowContentLanguageModal] =
    useState(false);
  const [showTextSizeModal, setShowTextSizeModal] = useState(false);
  const [selectedTextSize, setSelectedTextSize] = useState<TextSize>("normal");
  const [contentLanguage, setContentLanguage] = useState<LanguageCode>("en");
  const [showPointsPopup, setShowPointsPopup] = useState(true);
  const [showWhatsNewModal, setShowWhatsNewModal] = useState(false);

  const defaultApiUrl = `${API_V2_URL}/`;

  // Tour setup - Settings page specific tour
  const { startTour, hasCompletedTour } = useTour("settings-page");

  useEffect(() => {
    // Load saved settings (user-scoped when logged in, guest otherwise)
    if (typeof window !== "undefined") {
      const savedUrl = getSetting("custom_api_url", userId) || defaultApiUrl;
      // Remove /api/v2/ suffix for display
      const displayUrl = savedUrl.replace(/\/api\/v2\/?$/, "");
      setApiUrl(displayUrl);
      setPreviousApiUrl(displayUrl);
      setApiEnvCookie(displayUrl);

      const savedTextSize =
        (getSetting("text_size", userId) as TextSize) || "normal";
      setSelectedTextSize(savedTextSize);

      const savedContentLanguage =
        (getSetting("content_language", userId) as LanguageCode) || "en";
      setContentLanguage(savedContentLanguage);

      const savedShowPointsPopup = getSetting("show_points_popup", userId);
      setShowPointsPopup(savedShowPointsPopup !== "false");

      // Apply saved text size on mount (also applied globally by ApplySavedSettings)
      applyTextSizeToDocument(savedTextSize);
    }
  }, [userId]);
  // Handler for points popup toggle
  const handleShowPointsPopupChange = (checked: boolean) => {
    setShowPointsPopup(checked);
    setSetting("show_points_popup", checked ? "true" : "false", userId);
  };

  // Auto-trigger tour for first-time visitors
  useEffect(() => {
    if (!hasCompletedTour()) {
      const timer = setTimeout(() => {
        const tourSteps = getSettingsTour();
        startTour(tourSteps);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedTour]);

  const performSave = async () => {
    setIsSaving(true);
    setSaveMessage("");
    setInvalidUrlWarning("");

    try {
      if (typeof window !== "undefined") {
        // Trim and normalize the URL for validation
        const trimmedUrl = apiUrl.trim();

        // Validate URL
        if (!isValidApiUrl(trimmedUrl)) {
          setInvalidUrlWarning("URL is not supported");
          setIsSaving(false);
          return;
        }

        // Normalize URLs for comparison (remove protocol and trailing slashes, lowercase)
        const normalizedCurrentUrl = normalizeUrl(trimmedUrl);
        const normalizedPreviousUrl = normalizeUrl(previousApiUrl);
        const apiUrlChanged = normalizedCurrentUrl !== normalizedPreviousUrl;

        // Ensure URL has protocol and trailing slash for storage
        let urlToSave = trimmedUrl.replace(/\/+$/, ""); // Remove trailing slashes
        // Add https:// if protocol is missing
        if (!urlToSave.match(/^https?:\/\//i)) {
          urlToSave = `https://${urlToSave}`;
        }
        // Add trailing slash and api/v2/ path
        const fullUrl = `${urlToSave}/api/v2/`;
        setApiEnvCookie(urlToSave);

        void logSettingsUpdate({
          pageName: "/settings",
          details: {
            setting: "custom_api_url",
            apiUrlChanged,
            requestedUrl: trimmedUrl,
          },
        });

        // Logout if API URL changed and user is logged in
        if (apiUrlChanged && user) {
          // Save API URL to both user and guest keys before logout
          setSetting("custom_api_url", fullUrl, userId);
          setSetting("custom_api_url", fullUrl, undefined);
          setPreviousApiUrl(urlToSave.replace(/\/+$/, ""));

          // Logout and redirect
          setIsSaving(false);
          await logout();
          // Use window.location for a hard redirect to ensure logout completes
          window.location.href = "/login";
          return;
        }

        // Save the URL if it didn't change (or user is not logged in)
        setSetting("custom_api_url", fullUrl, userId);
        setPreviousApiUrl(urlToSave.replace(/\/+$/, "")); // Store without trailing slash for display

        // Show success message only if API URL didn't change
        setSaveMessage(t("settings.saveSuccess"));
      }
    } catch (error) {
      setSaveMessage(t("settings.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    if (typeof window === "undefined") return;

    const trimmedUrl = apiUrl.trim();

    // Validate URL first
    if (!isValidApiUrl(trimmedUrl)) {
      setInvalidUrlWarning("URL is not supported");
      return;
    }

    // Check if URL will change
    const normalizedCurrentUrl = normalizeUrl(trimmedUrl);
    const normalizedPreviousUrl = normalizeUrl(previousApiUrl);
    const apiUrlChanged = normalizedCurrentUrl !== normalizedPreviousUrl;

    // Show confirmation dialog if URL will change and user is logged in
    if (apiUrlChanged && user) {
      setPendingAction("save");
      setShowLogoutDialog(true);
    } else {
      // No change or user not logged in, save directly
      performSave();
    }
  };

  const performReset = async () => {
    let resetUrl = defaultApiUrl.replace(/\/api\/v2\/?$/, "");
    // Ensure URL has protocol
    if (!resetUrl.match(/^https?:\/\//i)) {
      resetUrl = `https://${resetUrl}`;
    }
    // Remove trailing slashes for comparison
    const resetUrlClean = resetUrl.replace(/\/+$/, "");

    const normalizedResetUrl = normalizeUrl(resetUrlClean);
    const normalizedPreviousUrl = normalizeUrl(previousApiUrl);
    const apiUrlChanged = normalizedResetUrl !== normalizedPreviousUrl;

    setApiUrl(resetUrlClean);
    setPreviousApiUrl(resetUrlClean);
    setSaveMessage("");
    setInvalidUrlWarning("");

    void logSettingsReset({
      pageName: "/settings",
      details: {
        apiUrlChanged,
        resetUrl: resetUrlClean,
      },
    });

    // If URL changed and user is logged in, logout
    if (apiUrlChanged && user) {
      // Save reset URL to both user and guest keys before logout
      const fullUrl = `${resetUrlClean}/api/v2/`;
      setSetting("custom_api_url", fullUrl, userId);
      setSetting("custom_api_url", fullUrl, undefined);
      setApiEnvCookie(resetUrlClean);

      // Logout and redirect
      await logout();
      window.location.href = "/login";
    } else {
      // Save the reset URL
      const fullUrl = `${resetUrlClean}/api/v2/`;
      setSetting("custom_api_url", fullUrl, userId);
      setApiEnvCookie(resetUrlClean);
      setSaveMessage(t("settings.saveSuccess"));
    }
  };

  const handleReset = () => {
    const resetUrl = defaultApiUrl.replace(/\/api\/v2\/?$/, "");
    const normalizedResetUrl = normalizeUrl(resetUrl);
    const normalizedPreviousUrl = normalizeUrl(previousApiUrl);
    const apiUrlChanged = normalizedResetUrl !== normalizedPreviousUrl;

    // Show confirmation dialog if URL will change and user is logged in
    if (apiUrlChanged && user) {
      setPendingAction("reset");
      setShowLogoutDialog(true);
    } else {
      // No change or user not logged in, reset directly
      performReset();
    }
  };

  const handleConfirmLogout = async () => {
    setShowLogoutDialog(false);
    if (pendingAction === "save") {
      await performSave();
    } else if (pendingAction === "reset") {
      await performReset();
    }
    setPendingAction(null);
  };

  const handleTextSizeChange = (size: TextSize) => {
    setSelectedTextSize(size);
    setSetting("text_size", size, userId);
    applyTextSizeToDocument(size);
    setShowTextSizeModal(false);
  };

  const handleLanguageChange = (newLanguage: LanguageCode) => {
    setLanguage(newLanguage);
    setShowLanguageModal(false);
  };

  const handleContentLanguageChange = (newLanguage: LanguageCode) => {
    setContentLanguage(newLanguage);
    setSetting("content_language", newLanguage, userId);
    setShowContentLanguageModal(false);
  };

  const getContentLanguageName = () => {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === contentLanguage);
    return lang ? lang.nativeName : "English";
  };

  return (
    <div className="min-h-screen w-full bg-gray-50">
      {/* Header: normal back button used elsewhere in the app */}
      <header className="bg-white border-b px-4 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <BackButton
            onClick={() => (user ? router.back() : router.push("/login"))}
            label={user ? t("common.back") : "Back to Login"}
            iconSize="md"
          />
        </div>
      </header>
      {/* Content */}
      <div className="max-w-4xl mx-auto">
        {/* Display Section */}
        <div className="bg-white border-b">
          <div className="px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">
              {t("settings.display")}
            </h2>
          </div>

          {/* Activity Toast Toggle */}
          <div className="flex items-center gap-4 px-6 py-4 border-t">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Save className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-base text-gray-900">
                {t("settings.activityToastTitle")}
              </div>
              <div className="text-sm text-gray-500">
                {t("settings.activityToastDescription")}
              </div>
            </div>
            <Switch
              checked={showPointsPopup}
              onCheckedChange={handleShowPointsPopupChange}
            />
          </div>

          {/* Preferred Content Language - hidden
          <button
            onClick={() => setShowContentLanguageModal(true)}
            className="settings-language w-full flex items-center gap-4 px-6 py-4 border-t hover:bg-gray-50">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Languages className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-base text-gray-900">
                {t("settings.preferredContentLanguage")}
              </div>
              <div className="text-sm text-gray-500">
                {getContentLanguageName()}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
          */}

          {/* Interface Language */}
          <button
            onClick={() => setShowLanguageModal(true)}
            className="settings-language w-full flex items-center gap-4 px-6 py-4 border-t hover:bg-gray-50">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Languages className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-base text-gray-900">
                {t("settings.interfaceLanguage")}
              </div>
              <div className="text-sm text-gray-500">
                {getCurrentLanguage().nativeName}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>

          {/* Text Size */}
          <button
            onClick={() => setShowTextSizeModal(true)}
            className="settings-text-size w-full flex items-center gap-4 px-6 py-4 border-t hover:bg-gray-50">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <AlignLeft className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-base text-gray-900">
                {t("settings.textSize")}
              </div>
              <div className="text-sm text-gray-500 capitalize">
                {t(`settings.textSizes.${selectedTextSize}`)}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Server Section */}
        <div className="bg-white border-b mt-6">
          <div className="px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">
              {t("settings.server")}
            </h2>
          </div>

          {/* API Configuration */}
          <div className="settings-api px-6 py-4 border-t">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Server className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="text-base text-gray-900 font-medium">
                  {t("settings.serverUrl")}
                </div>
                <div className="text-sm text-gray-500">
                  {t("settings.configureServerUrl")}
                </div>
              </div>
            </div>

            <div className="space-y-4 ml-14">
              <div>
                <input
                  id="api-url"
                  type="url"
                  value={apiUrl}
                  onChange={(e) => {
                    setApiUrl(e.target.value);
                    // Clear warning when user starts typing
                    if (invalidUrlWarning) {
                      setInvalidUrlWarning("");
                    }
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    invalidUrlWarning
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300"
                  }`}
                  placeholder={API_V2_URL.replace(/\/api\/v2\/?$/, "")}
                />
                {invalidUrlWarning && (
                  <div className="mt-2 p-3 rounded-lg text-sm bg-yellow-50 text-yellow-800 border border-yellow-200">
                    {invalidUrlWarning}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !apiUrl}
                  className="flex items-center gap-2 ">
                  <Save className="w-4 h-4" />
                  {isSaving ? t("settings.saving") : t("common.save")}
                </Button>
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  {t("settings.resetToDefault")}
                </Button>
              </div>

              {saveMessage && (
                <div
                  className={`p-3 rounded-lg text-sm ${
                    saveMessage.startsWith("✓")
                      ? "bg-green-50 text-green-800"
                      : "bg-red-50 text-red-800"
                  }`}>
                  {saveMessage}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* App Version Section */}
        <div className="bg-white border-b mt-6">
          <div className="px-6 py-4 border-t">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-base text-gray-900 font-medium">
                  {t("settings.appVersion")}
                </div>
              </div>
              <div className="text-base text-gray-600 font-semibold">
                v1.0.0
              </div>
            </div>
          </div>

          {/* What's New Button */}
          {/* <button
            onClick={() => setShowWhatsNewModal(true)}
            className="w-full flex items-center gap-4 px-6 py-4 border-t hover:bg-gradient-to-r hover:from-primary-50 hover:to-secondary-50 transition-all duration-200 group">
            <div className="flex-1 text-left">
              <div className="text-base text-gray-900 font-medium">
                Know what changed in this version
              </div>
              <div className="text-sm text-gray-500">
                See the fixes included in v1.1.0
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors" />
          </button> */}
        </div>
      </div>
      {/* Language Modal */}
      {showLanguageModal && (
        <div
          className="fixed inset-0 backdrop-blur-sm bg-gray-900/20 flex items-center justify-center z-50 p-4"
          onClick={() => setShowLanguageModal(false)}>
          <div
            className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              {t("settings.languageModal.title")}
            </h3>

            <div className="space-y-1 mb-6">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg">
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      language === lang.code
                        ? "border-blue-600 bg-blue-600"
                        : "border-gray-400"
                    }`}>
                    {language === lang.code && (
                      <div className="w-3 h-3 bg-white rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-base text-gray-900 font-medium">
                      {lang.nativeName}
                    </div>
                    <div className="text-sm text-gray-500">{lang.name}</div>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowLanguageModal(false)}
              className="w-full text-right text-gray-600 font-medium">
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Text Size Modal */}
      {showTextSizeModal && (
        <div
          className="fixed inset-0 backdrop-blur-sm bg-gray-900/20 flex items-center justify-center z-50 p-4"
          onClick={() => setShowTextSizeModal(false)}>
          <div
            className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              {t("settings.textSize")}
            </h3>

            <div className="space-y-1 mb-6">
              {(
                [
                  "smallest",
                  "small",
                  "normal",
                  "large",
                  "largest",
                ] as TextSize[]
              ).map((size) => (
                <button
                  key={size}
                  onClick={() => handleTextSizeChange(size)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg">
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      selectedTextSize === size
                        ? "border-blue-600 bg-blue-600"
                        : "border-gray-400"
                    }`}>
                    {selectedTextSize === size && (
                      <div className="w-3 h-3 bg-white rounded-full"></div>
                    )}
                  </div>
                  <span className="text-base text-gray-900 capitalize">
                    {t(`settings.textSizes.${size}`)}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowTextSizeModal(false)}
              className="w-full text-right text-gray-600 font-medium">
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}
      {/* Logout Confirmation Dialog */}
      <ConfirmationDialog
        open={showLogoutDialog}
        onOpenChange={setShowLogoutDialog}
        title={t("settings.logoutDialogTitle")}
        description={t("settings.logoutDialogDescription")}
        confirmText={t("common.continue")}
        cancelText={t("common.cancel")}
        variant="warning"
        onConfirm={handleConfirmLogout}
      />

      {/* What's New Modal */}
      <WhatsNewModal
        isOpen={showWhatsNewModal}
        onClose={() => setShowWhatsNewModal(false)}
        version="1.1.0"
      />
    </div>
  );
}
