import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  imageSrc: string;
  imageAlt: string;
  title: string;
  description: string | string[];
  actionLabel: string;
  onAction: () => void;
  imageWidth?: number;
  imageHeight?: number;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  imageSrc,
  imageAlt,
  title,
  description,
  actionLabel,
  onAction,
  imageWidth = 200,
  imageHeight = 200,
}) => {
  const descriptions = Array.isArray(description) ? description : [description];

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <div className="w-full max-w-md text-center">
        {/* Image */}
        <div className="flex justify-center mb-8">
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={imageWidth}
            height={imageHeight}
            className="w-48 h-48 md:w-64 md:h-64"
          />
        </div>

        {/* Message */}
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
          {title}
        </h2>
        {descriptions.map((desc, index) => (
          <p key={index} className="text-gray-600 mb-2">
            {desc}
          </p>
        ))}

        {/* Action Button */}
        <Button
          onClick={onAction}
          className="w-full max-w-xs h-12 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors mt-6">
          {actionLabel}
        </Button>
      </div>
    </div>
  );
};
