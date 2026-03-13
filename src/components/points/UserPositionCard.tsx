import Image from "next/image";
import { useTranslation } from "@/hooks/useTranslation";

interface UserPositionCardProps {
  position: number;
  points: number;
}

export function UserPositionCard({ position, points }: UserPositionCardProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-cyan-50 rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between">
        <div>
          {" "}
          <p className="text-xs text-black-dark uppercase mb-2">
            {t("scoreboard.myPosition").toUpperCase()}
          </p>
          <h2 className="text-5xl  text-gray-900 mb-2">{position}</h2>
          <p className="text-base text-[#10769C] font-medium">
            {points} {t("gamification.points").toLowerCase()}
          </p>
        </div>
        <div className="flex items-center">
          <Image
            src="/points/leaderboard/position.svg"
            alt="User Position"
            className="h-full w-full aspect-square min-h-40"
            width={64}
            height={64}
          />
        </div>
      </div>
    </div>
  );
}
