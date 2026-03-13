"use client";

import { useEffect, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuthStore } from "@/store/useStore";
import { useTranslation } from "@/hooks/useTranslation";
import { getUserProfile } from "@/services/userDataService";
import { Loader2 } from "lucide-react";

interface ProfileData {
  username: string;
  name: string;
  first_name: string;
  last_name: string;
  country: string;
  language: string;
  state: string;
  district: string;
  facility: string;
  facility_type: string;
  designation: string;
  department: string;
  // Optional fields
  province?: string;
  regency_district?: string;
}

export default function ProfilePage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const userId =
          typeof user.id === "string" ? parseInt(user.id, 10) : user.id;
        const profile = await getUserProfile(userId);

        if (profile) {
          setProfileData({
            username: profile.username || user.username,
            name:
              profile.name ||
              `${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
            first_name: profile.first_name || "",
            last_name: profile.last_name || "",
            country: profile.country || "",
            language: profile.language || "",
            state: profile.state || "",
            district: profile.district || "",
            facility: profile.facility || "",
            facility_type: profile.facility_type || "",
            designation: profile.designation || "",
            department: profile.department || "",
            province: profile.province,
            regency_district: profile.regency_district,
          });
        }
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const ProfileField = ({
    label,
    value,
  }: {
    label: string;
    value?: string | null;
  }) => (
    <div className="flex flex-col gap-1 py-3 border-b border-gray-200 dark:border-gray-700">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-base text-gray-900 dark:text-gray-100">
        {value && value.length > 0 ? value : t("common.none")}
      </span>
    </div>
  );

  const profileFields = profileData
    ? [
        { label: t("profile.username"), value: profileData.username },
        { label: t("profile.name"), value: profileData.name },
        { label: t("profile.country"), value: profileData.country },
        { label: t("profile.language"), value: profileData.language },
        { label: t("profile.state"), value: profileData.state },
        { label: t("profile.district"), value: profileData.district },
        {
          label: t("profile.regencyDistrict"),
          value: profileData.regency_district,
        },
        { label: t("profile.province"), value: profileData.province },
        { label: t("profile.facilityName"), value: profileData.facility },
        { label: t("profile.facilityType"), value: profileData.facility_type },
        { label: t("profile.designation"), value: profileData.designation },
        { label: t("profile.department"), value: profileData.department },
      ]
    : [];

  if (!isMounted) {
    return null;
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div className="flex flex-col h-full">
        {/* Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 sm:px-6">
          <SidebarTrigger className="-ml-1 md:hidden" />
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {t("profile.title")}
            </h1>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-4 sm:p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : profileData ? (
              <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                  {profileFields.map((field, index) => (
                    <ProfileField
                      key={index}
                      label={field.label}
                      value={field.value}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  {t("profile.unableToLoad")}
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
