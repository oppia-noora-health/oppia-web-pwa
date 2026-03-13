import { QuizAttempt } from "@/types/activityTracking";

interface QuizAttemptCardProps {
  quizAttempt: QuizAttempt;
  courseTitle: string;
  activityTitle?: string;
}

export function QuizAttemptCard({
  quizAttempt,
  courseTitle,
  activityTitle,
}: QuizAttemptCardProps) {
  // Calculate percentage
  const score = parseFloat(quizAttempt.score);
  const maxScore = parseFloat(quizAttempt.maxscore);
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  // Format date and time
  const formatDateTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${year}/${month}/${day} ${hours}:${minutes}`;
    } catch (error) {
      return dateString;
    }
  };

  // Get background color based on percentage
  const getBackgroundColor = (pct: number): string => {
    if (pct >= 80) return "bg-cyan-500";
    if (pct >= 50) return "bg-cyan-400";
    return "bg-gray-300";
  };

  return (
    <div className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors duration-200">
      <div className="flex items-center gap-3">
        {/* Percentage Box */}
        <div
          className={`${getBackgroundColor(
            percentage
          )} rounded-md w-12 h-12 flex items-center justify-center shrink-0`}>
          <span className="text-white text-sm ">{percentage}%</span>
        </div>

        {/* Quiz Details */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 text-sm truncate">
            {courseTitle}
          </h3>
          {activityTitle && (
            <p className="text-xs text-gray-600 truncate mt-0.5">
              {activityTitle}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {formatDateTime(quizAttempt.submitteddate)}
          </p>
        </div>
      </div>
    </div>
  );
}
