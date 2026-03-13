import { useTranslation } from "@/hooks/useTranslation";
import { Loading } from "@/components/Loading";

interface ActivityLog {
  date: string;
  time: string;
  activity: string;
  points: number;
}

interface RecentActivityListProps {
  activities: ActivityLog[];
  loading?: boolean;
}

export function RecentActivityList({
  activities,
  loading = false,
}: RecentActivityListProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col">
      <h3 className="text-lgi text-black mb-6">
        {t("pointsPage.recentActivity")}
      </h3>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loading />
        </div>
      ) : (
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {activities.length > 0 ? (
            activities.map((activity, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="text-xs flex gap-2  text-gray-500 min-w-20">
                  <div>{activity.date}</div>
                  <div>{activity.time}</div>
                </div>
                <div className="shrink-0 flex justify-center items-center">
                  <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center">
                    <span className="text-pink-600 ">+{activity.points}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900 leading-relaxed">
                    {activity.activity}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center py-10">
              <p className="text-gray-500 text-sm">
                {t("pointsPage.noRecentActivity")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
