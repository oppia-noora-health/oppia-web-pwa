"use client";

import { Award } from "@/types/badges";
import Image from "next/image";
import { API_BASE_URL } from "@/config/constants";
import { useTranslation } from "@/hooks/useTranslation";

interface BadgesListProps {
  awards: Award[];
}

// Map badge ref to local image path
const getBadgeImagePath = (badgeRef: string): string => {
  const ref = badgeRef.toLowerCase();
  if (ref.includes("coursecompleted"))
    return "/points/badges/course-completed.svg";
  if (ref.includes("diamond")) return "/points/badges/daimond.svg";
  if (ref.includes("platinum")) return "/points/badges/platinum.svg";
  if (ref.includes("gold")) return "/points/badges/gold.svg";
  if (ref.includes("silver")) return "/points/badges/silver.svg";
  // Default to silver if no match
  return "/points/badges/silver.svg";
};

// Get badge heading color based on badge type
const getBadgeHeadingColor = (badgeRef: string): string => {
  const ref = badgeRef.toLowerCase();
  if (ref.includes("coursecompleted")) return "#267CB5";
  if (ref.includes("diamond")) return "#4A5568";
  if (ref.includes("platinum")) return "#71797E";
  if (ref.includes("gold")) return "#A65F00";
  if (ref.includes("silver")) return "#4A5568";
  // Default to silver color
  return "#4A5568";
};

export function BadgesList({ awards }: BadgesListProps) {
  const { t } = useTranslation();

  if (awards.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-8 shadow-sm text-center">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t("gamification.badgesSection.noBadgesTitle")}
          </h3>
          <p className="text-gray-600 text-sm">
            {t("gamification.badgesSection.noBadgesDescription")}
          </p>
          <div className="text-xs text-gray-500 mt-4">
            {t("gamification.badgesSection.newBadgesNotice")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl text-black mb-4">{t("gamification.badgesSection.earnedTitle")}</h2>
      <div className="text-xs text-gray-500 mb-2">
        {t("gamification.badgesSection.newBadgesNotice")}
      </div>
      {awards.map((award) => (
        <div
          key={award.id}
          className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <div className="flex items-start gap-4">
            {/* Badge Icon */}
            <div className="shrink-0">
              <Image
                src={getBadgeImagePath(award.badge.ref)}
                alt={award.badge.name}
                width={80}
                height={80}
                className="object-contain"
              />
            </div>

            {/* Badge Details */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-1">
                <h3
                  className="text-lg font-medium"
                  style={{ color: getBadgeHeadingColor(award.badge.ref) }}>
                  {award.badge.name}
                </h3>
                {award.certificate_pdf && (
                  <a
                    href={`${API_BASE_URL}${award.certificate_pdf}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="hidden md:inline-flex shrink-0 items-center gap-1 px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs font-medium hover:bg-cyan-700 transition-colors">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    {t("gamification.badgesSection.downloadCertificate")}
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2 text-gray-500 text-xs mb-2">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span>
                  {new Date(award.award_date).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "2-digit",
                  })}
                </span>
              </div>

              <p className="text-gray-600 text-sm leading-relaxed mb-3">
                {award.description}
              </p>

              {award.certificate_pdf && (
                <a
                  href={`${API_BASE_URL}${award.certificate_pdf}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex md:hidden items-center gap-1 px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs font-medium hover:bg-cyan-700 transition-colors">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  {t("gamification.badgesSection.downloadCertificate")}
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
