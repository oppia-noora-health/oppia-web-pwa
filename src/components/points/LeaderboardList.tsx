import { useTranslation } from "@/hooks/useTranslation";

interface LeaderboardUser {
  rank: number;
  name: string;
  phone: string;
  points: number;
}

interface LeaderboardListProps {
  users: LeaderboardUser[];
  currentUserPhone?: string;
}

export function LeaderboardList({
  users,
  currentUserPhone,
}: LeaderboardListProps) {
  const { t } = useTranslation();

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return "bg-yellow-500";
    if (rank === 2) return "bg-gray-400";
    if (rank === 3) return "bg-orange-500";
    return "bg-none";
  };

  const getRankTextColor = (rank: number) => {
    if (rank <= 3) return "text-white";
    return "text-gray-600";
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="bg-pink-50 px-6 py-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {t("scoreboard.topLearners")}
        </h3>
      </div>

      <div className="p-6 space-y-3">
        {users.map((performer) => (
          <div
            key={performer.rank}
            className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
              currentUserPhone && performer.phone === currentUserPhone
                ? "bg-cyan-50"
                : ""
            }`}>
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${getRankBadgeColor(
                  performer.rank
                )}`}>
                <span
                  className={`text-lg font-semibold ${getRankTextColor(
                    performer.rank
                  )}`}>
                  {performer.rank}
                </span>
              </div>

              <div>
                <p className="text-base font-medium text-gray-900">
                  {performer.name}
                </p>
                <p className="text-xs text-gray-500">{performer.phone}</p>
              </div>
            </div>

            <div className="text-base font-semibold text-gray-900">
              {performer.points.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
