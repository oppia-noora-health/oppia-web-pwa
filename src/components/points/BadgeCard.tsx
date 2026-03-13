import Image from "next/image";

interface BadgeCardProps {
  name: string;
  imagePath: string;
  date: string;
  description: string;
  titleColor?: string;
}

export function BadgeCard({
  name,
  imagePath,
  date,
  description,
  titleColor = "text-gray-700",
}: BadgeCardProps) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm flex items-start gap-6">
      <div className="shrink-0">
        <Image
          src={imagePath}
          alt={name}
          width={80}
          height={80}
          className="object-contain"
        />
      </div>
      <div className="flex-1">
        <h3 className={`text-xl font-semibold ${titleColor} mb-2`}>{name}</h3>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <svg
            className="w-4 h-4"
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
          <span>{date}</span>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
