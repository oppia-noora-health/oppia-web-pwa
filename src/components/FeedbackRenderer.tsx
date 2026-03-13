"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Star } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/useTranslation";
import { useActivityCompletionStore } from "@/store/useStore";
import { useParams } from "next/navigation";
import { getLocalizedText } from "@/utils/localization";

interface FeedbackResponse {
  order: number;
  id: number;
  props: {
    id?: number;
    responsehtmlfile?: string;
  };
  title: { [key: string]: string };
  score: string;
}

interface FeedbackQuestion {
  order: number;
  id: number;
  question: {
    id: number;
    type: string;
    title: { [key: string]: string };
    props: {
      moodle_question_id?: string;
      maxscore: number;
      required?: boolean;
      label?: string;
      response_format?: string;
      input_box_size?: number;
    };
    responses: FeedbackResponse[];
  };
}

interface FeedbackData {
  id: number;
  title: { [key: string]: string };
  description: { [key: string]: string };
  props: {
    maxattempts: number;
    maxscore: number;
    digest: string;
  };
  questions: FeedbackQuestion[];
}

interface FeedbackRendererProps {
  feedbackData: FeedbackData;
  questionHtml: string;
  onComplete?: () => void;
  onFeedbackSubmit?: (feedbackData: any) => void;
}

export default function FeedbackRenderer({
  feedbackData,
  questionHtml,
  onComplete,
  onFeedbackSubmit,
}: FeedbackRendererProps) {
  const { t } = useTranslation();
  const { getCompletionData } = useActivityCompletionStore();
  const params = useParams();
  const courseId = params?.id as string;
  const [answers, setAnswers] = useState<Map<number, any>>(new Map());
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");

  const totalQuestions = feedbackData.questions?.length || 0;

  // Check if feedback was already submitted
  useEffect(() => {
    const digest = feedbackData.props?.digest;
    if (digest && courseId) {
      const completionMap = getCompletionData(courseId);
      const completed = completionMap?.get(digest) || false;
      setAlreadySubmitted(completed);
    }
  }, [feedbackData.props?.digest, courseId, getCompletionData]);

  // Support any language key (en, kn, etc.) and plain string for schema differences
  const getFirstLanguageValue = (
    obj: { [key: string]: string } | string | undefined,
  ): string => getLocalizedText(obj ?? null, "");

  // Extract feedback title
  const feedbackTitle =
    getFirstLanguageValue(feedbackData.title) || "Lesson Feedback";

  // Extract question text
  const extractQuestionText = (question: any): string => {
    const questionTitle = getFirstLanguageValue(question?.title);
    if (questionTitle) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(questionTitle, "text/html");
      return doc.body.textContent?.trim() || questionTitle;
    }
    return "";
  };

  // Extract answer text from HTML
  const extractAnswerText = (titleObj: { [key: string]: string }): string => {
    const htmlContent = getFirstLanguageValue(titleObj);
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");
    return doc.body.textContent?.trim() || "";
  };

  const handleAnswerChange = (questionIndex: number, answer: any) => {
    setValidationMessage("");
    setAnswers(new Map(answers.set(questionIndex, answer)));
  };

  const handleSubmit = () => {
    // Check if all non-essay questions have been answered
    const allAnswered = Array.from({ length: totalQuestions }).every(
      (_, index) => {
        const question = feedbackData.questions[index];
        const questionType = question.question?.type || "multichoice";

        // Essay questions are optional, others are required
        if (questionType === "essay") {
          return true;
        }

        return (
          answers.has(index) &&
          answers.get(index) !== null &&
          answers.get(index) !== ""
        );
      },
    );

    if (!allAnswered) {
      setValidationMessage(
        t("feedback.pleaseRateCourse") || "Please rate the course.",
      );
      return;
    }

    // Clear validation message on successful validation
    setValidationMessage("");

    // Collect all answers
    const feedbackAnswers: any = {};
    answers.forEach((answer, questionIndex) => {
      const question = feedbackData.questions[questionIndex];
      feedbackAnswers[question.question.id] = answer;
    });

    // Notify parent component
    if (onFeedbackSubmit) {
      onFeedbackSubmit({
        feedbackId: feedbackData.id,
        digest: feedbackData.props?.digest,
        answers: feedbackAnswers,
        totalQuestions,
      });
    }

    if (onComplete) {
      onComplete();
    }
  };

  // If feedback was already submitted, show message
  if (alreadySubmitted) {
    return (
      <div className="feedback-container  p-6 max-w-3xl mx-auto">
        <div className="text-center py-12">
          <div className="mb-6">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            {t("feedback.alreadySubmitted")}
          </h2>
          <p className="text-gray-600 mb-6">
            {t("feedback.alreadySubmittedMessage")}
          </p>
          {onComplete && (
            <Button
              onClick={onComplete}
              className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-3 rounded-full">
              {t("common.continue")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Render all questions in a single view
  return (
    <div className="feedback-container p-6 max-w-3xl mx-auto">
      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {feedbackTitle}
        </h2>
        <p className="text-gray-600">{t("feedback.description")}</p>
      </div>

      {/* All Questions */}
      <div className="space-y-8">
        {feedbackData.questions.map((questionItem, questionIndex) => {
          const question = questionItem.question;
          const questionText = extractQuestionText(question);
          const questionType = question?.type || "multichoice";
          const responses = question?.responses || [];
          const currentAnswer = answers.get(questionIndex);

          return (
            <div
              key={questionItem.id}
              className="bg-white rounded-lg border border-gray-200 p-6">
              {/* Question Title */}
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-800">
                  {questionText}
                  {questionType !== "essay" && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </h3>
              </div>

              {/* Question Response Area */}
              {questionType === "essay" ? (
                <Textarea
                  value={currentAnswer || ""}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    handleAnswerChange(questionIndex, e.target.value)
                  }
                  placeholder={t("feedback.typeYourFeedback")}
                  className="min-h-[120px] text-base p-4 w-full"
                  rows={question?.props.input_box_size || 6}
                />
              ) : (
                <div className="space-y-2">
                  {responses.map((response, responseIndex) => {
                    const isSelected = currentAnswer === responseIndex;
                    const answerText = extractAnswerText(response.title);

                    return (
                      <div
                        key={response.id}
                        onClick={() =>
                          handleAnswerChange(questionIndex, responseIndex)
                        }
                        className={`
                          cursor-pointer p-4 rounded-lg border-2 transition-all duration-200
                          ${
                            isSelected
                              ? "border-cyan-500 bg-cyan-50"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }
                        `}>
                        <p className="text-gray-800">{answerText}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Validation message when user tries to proceed without answering */}
      {validationMessage && (
        <p className="text-amber-600 text-sm font-medium mb-4 text-center mt-6">
          {validationMessage}
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-4 mt-8 pb-32">
        <Button
          onClick={handleSubmit}
          className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-2">
          {t("common.submit")}
        </Button>
      </div>
    </div>
  );
}
