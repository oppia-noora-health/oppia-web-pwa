"use client";

import { ArrowLeft } from "lucide-react";

interface QuizProgressViewProps {
  courseTitle: string;
  activitiesCompleted: number;
  totalActivities: number;
  quizzes: {
    preTest: number;
    passed: number;
    attempted: number;
  };
  lessons: {
    title: string;
    subtitle: string;
    progress: number;
  }[];
  onBack?: () => void;
}

export function QuizProgressView({
  courseTitle,
  activitiesCompleted,
  totalActivities,
  quizzes,
  lessons,
  onBack,
}: QuizProgressViewProps) {
  const percentageComplete = Math.round(
    (activitiesCompleted / totalActivities) * 100
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-linear-to-r from-cyan-500 to-cyan-600 px-6 py-4">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="text-white hover:bg-white/10 rounded-full p-2 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-white text-lg font-medium">{courseTitle}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-8 max-w-2xl mx-auto">
        {/* Circular Progress */}
        <div className="flex justify-center mb-12">
          <div className="relative w-64 h-64">
            <svg className="w-full h-full transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="128"
                cy="128"
                r="112"
                stroke="#E5E7EB"
                strokeWidth="16"
                fill="none"
              />
              {/* Progress circle */}
              <circle
                cx="128"
                cy="128"
                r="112"
                stroke="#37B7E6"
                strokeWidth="16"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 112}`}
                strokeDashoffset={`${
                  2 * Math.PI * 112 * (1 - percentageComplete / 100)
                }`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-5xl font-bold text-gray-900">
                {activitiesCompleted}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                activities completed
              </div>
              <div className="text-5xl font-bold text-gray-900 mt-2">
                {totalActivities}
              </div>
              <div className="text-sm text-gray-400 mt-1">total</div>
            </div>
          </div>
        </div>

        {/* Quizzes Section */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 mb-6">
          <h2 className="text-center text-gray-600 text-sm font-medium uppercase tracking-wide mb-8">
            QUIZZES
          </h2>
          <div className="grid grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 mb-2">
                {quizzes.preTest}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                PRE-TEST
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 mb-2">
                {quizzes.passed}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                PASSED
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 mb-2">
                {quizzes.attempted}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                ATTEMPTED
              </div>
            </div>
          </div>
        </div>

        {/* Lessons Section */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-center text-gray-600 text-sm font-medium uppercase tracking-wide mb-6">
            LESSONS
          </h2>
          <div className="space-y-4">
            {lessons.map((lesson, index) => (
              <div
                key={index}
                className="flex items-center gap-4 bg-gray-50 rounded-2xl p-4">
                {/* Progress Badge */}
                <div
                  className={`shrink-0 w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-lg ${
                    lesson.progress > 0 ? "bg-cyan-400" : "bg-gray-300"
                  }`}>
                  {lesson.progress}%
                </div>

                {/* Lesson Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 mb-1">
                    {lesson.title}
                  </h3>
                  <p className="text-xs text-gray-500 truncate">
                    {lesson.subtitle}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
