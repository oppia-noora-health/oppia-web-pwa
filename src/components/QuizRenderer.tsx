"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { XCircle, ChevronRight, PlayCircle, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/useTranslation";
import QuizResultsScreen from "@/components/QuizResultsScreen";
import { analytics } from "@/lib/analytics";
import { useAuthStore } from "@/store/useStore";
import { activityTrackingService } from "@/services/activityTrackingService";
import { getQuizAttemptsByDigest } from "@/utils/gamificationIDB";
import { fetchHtmlContent } from "@/services/courseStreamingService";
import { getLocalizedText } from "@/utils/localization";
import { loadFileFromCourse } from "@/utils/courseLoaderIDB";
import { processHtmlForOfflineMedia } from "@/utils/htmlProcessor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import FeedbackIframe from "@/components/FeedbackIframe";

/** Wrap an HTML fragment in a minimal document so it can be rendered in an iframe. */
function wrapAsHtmlDocument(fragment: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,-apple-system,sans-serif;padding:16px;margin:0;color:#222;}h1{margin-top:0;}</style></head><body>${fragment}</body></html>`;
}

type FeedbackType = "correct" | "incorrect" | "partial" | "essay";

/** Title to show for feedback type: same HTML for all, only this title changes. Essay = no right/wrong. */
function getFeedbackTitle(type: FeedbackType): string {
  if (type === "correct") return "Success";
  if (type === "partial") return "Partially correct";
  if (type === "essay") return "Submitted";
  return "Oh no!";
}

/** Inline style for feedback title: Success=green, Oh no!=red, Partially correct=orange, Essay=gray; all center-aligned. */
function getFeedbackTitleStyle(type: FeedbackType): string {
  const color =
    type === "correct"
      ? "#16a34a"
      : type === "partial"
        ? "#ea580c"
        : type === "essay"
          ? "#6b7280"
          : "#dc2626";
  return `color:${color};text-align:center;`;
}

/** Style the first h1 in the HTML: center-aligned, green if correct, red if incorrect, yellow/orange if partial.
 *  Preserves the original h1 text content (e.g. Kannada titles from Moodle). */
function replaceFeedbackTitle(html: string, type: FeedbackType): string {
  if (!html || typeof html !== "string") return html;
  const color =
    type === "correct"
      ? "#16a34a"
      : type === "partial"
        ? "#eab308"
        : type === "essay"
          ? "#6b7280"
          : "#dc2626";
  return html.replace(
    /<h1(\s[^>]*)?>(\s*[\s\S]*?)<\/h1>/i,
    (_match, _attrs, content) =>
      `<h1 style="color:${color};text-align:center;">${content}</h1>`,
  );
}

/** Check if feedback HTML body text is just a trivial default message (e.g. "Your answer is correct.").
 *  When showfeedback=1, these trivial messages don't warrant a popup. */
function isTrivialFeedbackHtml(html: string): boolean {
  if (!html || typeof html !== "string") return true;

  const root =
    typeof document !== "undefined" ? document.createElement("div") : null;
  if (!root) return false;
  root.innerHTML = html;

  // Remove non-user-facing content first
  root.querySelectorAll("style,script,noscript,template").forEach((el) => {
    el.remove();
  });

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/\u00a0/g, " ")
      .replace(/\u200b/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const trivialMessages = new Set([
    "your answer is correct.",
    "your answer is incorrect.",
    "your answer is partially correct.",
  ]);

  // Prefer explicit feedback node if present
  const feedbackNode = root.querySelector(".quiz-feedback-inline");
  const feedbackText = normalize(feedbackNode?.textContent || "");
  if (feedbackText && trivialMessages.has(feedbackText)) {
    return true;
  }

  // Otherwise inspect only short visible leaf text nodes (ignore long CSS/JS-like blobs)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const candidates: string[] = [];
  let n: Node | null = walker.nextNode();
  while (n) {
    const text = normalize(n.textContent || "");
    // Keep only short, meaningful lines likely to be feedback text
    if (text && text.length <= 120) {
      candidates.push(text);
    }
    n = walker.nextNode();
  }

  const matched = candidates.some((c) => trivialMessages.has(c));

  return matched;
}
/** Styled h1 for inline feedback fallback (green/red/orange/gray, center-aligned). */
function getFeedbackTitleH1(type: FeedbackType): string {
  const title = getFeedbackTitle(type);
  const style = getFeedbackTitleStyle(type);
  return `<h1 style="${style}">${""}</h1>`;
}

interface QuizResponse {
  order: number;
  id: number;
  props: {
    id?: number;
    responsehtmlfile?: string;
    feedback?: { [key: string]: string };
    feedbackhtmlfile?: string;
    tolerance?: string;
  };
  title: { [key: string]: string };
  score: string;
}

interface QuizQuestion {
  order: number;
  id: number;
  question: {
    id: number;
    type: string;
    title: { [key: string]: string };
    props: {
      moodle_question_id?: string;
      moodle_question_latest_version_id?: string;
      maxscore: number;
      shuffleanswers?: string;
      show_standard_instructions?: string;
      htmlfile?: string;
      response_format?: string;
      response_required?: number;
      input_box_size?: number;
      min_word_limit?: number;
      max_word_limit?: number;
      correctfeedback?: { [key: string]: string };
      correctfeedbackhtmlfile?: string;
      partiallycorrectfeedback?: { [key: string]: string };
      partiallycorrectfeedbackhtmlfile?: string;
      incorrectfeedback?: { [key: string]: string };
      incorrectfeedbackhtmlfile?: string;
      required?: boolean;
      label?: string;
    };
    responses: QuizResponse[];
  };
}

interface QuizData {
  id: number;
  title: { [key: string]: string };
  description: { [key: string]: string };
  props: any;
  questions: QuizQuestion[];
  digest: string; // Quiz digest for fetching attempt history
  courseShortname?: string; // Course shortname for API calls
}

interface QuizRendererProps {
  quizData: QuizData;
  questionHtml: string;
  onComplete?: () => void;
  onQuizSubmit?: (score: number, timeTaken: number, quizData: any) => void;
  isPreTest?: boolean; // Flag to indicate if this is a pre-test
  onPreTestComplete?: () => void; // Callback when pre-test is completed
  /** Server URL for fetching feedback HTML when showfeedback is 1 (e.g. https://staging.academy.noorahealth.org/) */
  serverUrl?: string;
  /** Course ID for offline feedback HTML/assets when using downloaded courses */
  courseId?: string;
}

export default function QuizRenderer({
  quizData,
  onComplete,
  onQuizSubmit,
  isPreTest = false,
  onPreTestComplete,
  serverUrl,
  courseId,
}: QuizRendererProps) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);

  // LocalStorage key for persisting pre-test completion/results visibility
  const preTestResultsKey =
    isPreTest && typeof window !== "undefined"
      ? `pretest_results_shown_${quizData.id}`
      : null;

  // Check localStorage synchronously during initial render to prevent flash of "Take Quiz" screen
  // This function runs only once when the component mounts
  const getInitialPreTestState = () => {
    if (!isPreTest || typeof window === "undefined") {
      return { showResults: false, quizStarted: false };
    }

    try {
      const key = `pretest_results_shown_${quizData.id}`;
      const alreadyCompleted = window.localStorage.getItem(key) === "true";

      if (alreadyCompleted) {
        return { showResults: true, quizStarted: true };
      }
    } catch (error) {}

    return { showResults: false, quizStarted: false };
  };

  const initialPreTestState = getInitialPreTestState();

  const [quizStarted, setQuizStarted] = useState(
    initialPreTestState.quizStarted,
  );
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // Ref to track current question index for auto-advance after submit
  const currentQuestionIndexRef = useRef(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Set<number>>(
    new Set(),
  );
  const [textAnswer, setTextAnswer] = useState("");
  const [matchingAnswers, setMatchingAnswers] = useState<Map<number, string>>(
    new Map(),
  );
  const [submitted, setSubmitted] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [answers, setAnswers] = useState<Map<number, any>>(new Map());
  // Ref to track answers for use in callbacks (avoids stale closure issues)
  const answersRef = useRef<Map<number, any>>(new Map());
  const [quizStartTime, setQuizStartTime] = useState<number>(Date.now());
  const [showResults, setShowResults] = useState(
    initialPreTestState.showResults,
  );
  const [quizScore, setQuizScore] = useState(0);
  const [quizMaxScore, setQuizMaxScore] = useState(0);
  const [quizPassed, setQuizPassed] = useState(false);
  // Max attempts: null = not checked, true = exhausted (cannot take quiz), false = can take
  const [attemptsExhausted, setAttemptsExhausted] = useState<boolean | null>(
    null,
  );
  const [checkingAttempts, setCheckingAttempts] = useState(false);
  // At-end feedback popup (all questions' HTML): not used for showfeedback=1 (per-question popups only); kept for potential future use
  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);
  const [feedbackPopupHtml, setFeedbackPopupHtml] = useState<
    {
      questionIndex: number;
      type: "correct" | "incorrect" | "partial" | "essay";
      html: string;
    }[]
  >([]);
  const [feedbackPopupLoading, setFeedbackPopupLoading] = useState(false);
  // showfeedback === 1: show per-question feedback popup when Submit is clicked (Next in popup goes to next question)
  const [showQuestionFeedbackPopup, setShowQuestionFeedbackPopup] =
    useState(false);
  const [questionFeedbackPopupIndex, setQuestionFeedbackPopupIndex] = useState<
    number | null
  >(null);
  const [questionFeedbackHtml, setQuestionFeedbackHtml] = useState("");
  const [questionFeedbackLoading, setQuestionFeedbackLoading] = useState(false);
  // Prepared questions for results: includes feedbackHtml when showfeedback=1
  const [resultsQuestions, setResultsQuestions] = useState<
    | {
        questionNumber: number;
        questionText: string;
        isCorrect: boolean;
        userAnswer: string;
        feedbackType?: "correct" | "incorrect" | "partial" | "essay";
        feedbackHtml?: string;
      }[]
    | null
  >(null);

  // Ref to track if results have been shown (prevents reset on re-render)
  const resultsShownRef = useRef(initialPreTestState.showResults);
  // Ref to track if user is retaking (prevents localStorage check from overriding)
  const isRetakingRef = useRef(false);
  // Ref to track quiz completion (prevents auto-restart when at-end feedback popup is shown)
  const quizCompletedRef = useRef(false);
  const [validationMessage, setValidationMessage] = useState("");

  // Helper: fetch total quiz attempts (API then IndexedDB fallback)
  const getTotalAttemptsForQuiz = useCallback(async (): Promise<number> => {
    let total = 0;
    if (quizData.courseShortname) {
      try {
        const apiAttempts =
          await activityTrackingService.getQuizAttemptsByDigest(
            quizData.courseShortname,
            quizData.digest,
          );
        total = apiAttempts.length;
      } catch {
        // Fall through to IndexedDB
      }
    }
    if (total === 0 && user?.id) {
      try {
        const localAttempts = await getQuizAttemptsByDigest(
          Number(user.id),
          quizData.digest,
        );
        total = localAttempts.length;
      } catch {
        // Keep total 0
      }
    }
    return total;
  }, [quizData.courseShortname, quizData.digest, user?.id]);

  // On mount: check if max attempts already exhausted (show blocked screen instead of Take Quiz)
  useEffect(() => {
    const maxAttempts = quizData.props?.maxattempts ?? "unlimited";
    const maxAttemptsNum =
      maxAttempts === "unlimited" || maxAttempts === 0
        ? null
        : typeof maxAttempts === "string"
          ? parseInt(maxAttempts, 10)
          : Number(maxAttempts);

    if (maxAttemptsNum == null || Number.isNaN(maxAttemptsNum)) {
      setAttemptsExhausted(false);
      return;
    }

    let cancelled = false;
    setCheckingAttempts(true);
    getTotalAttemptsForQuiz()
      .then((total) => {
        if (!cancelled) {
          setAttemptsExhausted(total >= maxAttemptsNum);
        }
      })
      .catch(() => {
        if (!cancelled) setAttemptsExhausted(false);
      })
      .finally(() => {
        if (!cancelled) setCheckingAttempts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [quizData.digest, quizData.props?.maxattempts, getTotalAttemptsForQuiz]);

  // CRITICAL: Keep state in sync with localStorage and ref to prevent reset on re-render
  // This ensures that if the component re-renders for any reason, we maintain the results screen
  // Sync refs with state whenever they change
  useEffect(() => {
    currentQuestionIndexRef.current = currentQuestionIndex;
  }, [currentQuestionIndex]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (!isPreTest || typeof window === "undefined") return;

    try {
      const key = `pretest_results_shown_${quizData.id}`;
      const alreadyCompleted = window.localStorage.getItem(key) === "true";

      // If localStorage says it's completed but state doesn't match, sync them
      if (alreadyCompleted) {
        if (!showResults || !resultsShownRef.current) {
          resultsShownRef.current = true;
          setShowResults(true);
          setQuizStarted(true);
        }
      }
    } catch (error) {}
  }, [isPreTest, quizData.id, showResults]); // Re-check whenever showResults changes

  // When showfeedback=1 "at end" popup opens, fetch feedback HTML for each question
  useEffect(() => {
    if (!showFeedbackPopup || !quizData.questions?.length) return;

    const shortname = quizData.courseShortname;
    const server = serverUrl?.replace(/\/+$/, "") ?? "";

    setFeedbackPopupLoading(true);
    setFeedbackPopupHtml([]);

    const loadFeedback = async () => {
      const items: {
        questionIndex: number;
        type: "correct" | "incorrect" | "partial" | "essay";
        html: string;
      }[] = [];
      const latestAnswers = answersRef.current;

      for (let i = 0; i < quizData.questions.length; i++) {
        const q = quizData.questions[i];
        const answer = latestAnswers.get(i);
        const type = getFeedbackType(q, answer);
        // Prefer response-level feedback file; otherwise pick question-level file only if it matches the feedback type.
        const respFile = getResponseFeedbackHtmlFileName(q, answer);
        const typeSpecificFile = getFeedbackHtmlFileName(q, type);
        const anyFile = getFeedbackHtmlFileNameAny(q);
        const fileName: string | null =
          respFile ?? typeSpecificFile ?? anyFile ?? null;

        let html = "";
        // Essay: no points or right/wrong, use neutral inline feedback only
        if (type === "essay") {
          const inline = getInlineFeedbackText(q, type);
          html = wrapAsHtmlDocument(
            `${getFeedbackTitleH1(
              type,
            )}<div class="quiz-feedback-inline">${inline}</div>`,
          );
        } else if (server && shortname && fileName) {
          try {
            html = await fetchHtmlContent(server, shortname, fileName);
            html = replaceFeedbackTitle(html, type);
          } catch (err) {
            const inline = getInlineFeedbackText(q, type);
            html = wrapAsHtmlDocument(
              `${getFeedbackTitleH1(
                type,
              )}<div class="quiz-feedback-inline">${inline}</div>`,
            );
          }
        } else if (!server && courseId && fileName) {
          try {
            const offlineHtml = await loadFileFromCourse(courseId, fileName);
            if (offlineHtml) {
              const processed = await processHtmlForOfflineMedia(
                offlineHtml,
                courseId,
              );
              html = replaceFeedbackTitle(processed, type);
            } else {
              const inline = getInlineFeedbackText(q, type);
              html = wrapAsHtmlDocument(
                `${getFeedbackTitleH1(
                  type,
                )}<div class="quiz-feedback-inline">${inline.replace(
                  /@@PLUGINFILE@@\/?/g,
                  "",
                )}</div>`,
              );
            }
          } catch (err) {
            const inline = getInlineFeedbackText(q, type);
            html = wrapAsHtmlDocument(
              `${getFeedbackTitleH1(
                type,
              )}<div class="quiz-feedback-inline">${inline.replace(
                /@@PLUGINFILE@@\/?/g,
                "",
              )}</div>`,
            );
          }
        } else {
          const inline = getInlineFeedbackText(q, type);
          html = wrapAsHtmlDocument(
            `${getFeedbackTitleH1(type)}<div class="quiz-feedback-inline">${
              courseId ? inline.replace(/@@PLUGINFILE@@\/?/g, "") : inline
            }</div>`,
          );
        }
        items.push({ questionIndex: i + 1, type, html });
      }

      setFeedbackPopupHtml(items);
      setFeedbackPopupLoading(false);
    };

    loadFeedback();
  }, [
    showFeedbackPopup,
    quizData.questions?.length,
    quizData.courseShortname,
    serverUrl,
    courseId,
  ]);

  /** Load feedback HTML for a single question (used by per-question popup and pre-load check). */
  const loadSingleQuestionFeedbackHtml = useCallback(
    async (idx: number): Promise<string> => {
      const q = quizData.questions[idx];
      const answer = answersRef.current.get(idx);
      const type = getFeedbackType(q, answer);
      const respFile = getResponseFeedbackHtmlFileName(q, answer);
      const typeSpecificFile = getFeedbackHtmlFileName(q, type);
      const anyFile = getFeedbackHtmlFileNameAny(q);
      const fileName: string | null =
        respFile ?? typeSpecificFile ?? anyFile ?? null;
      const shortname = quizData.courseShortname;
      const server = serverUrl?.replace(/\/+$/, "") ?? "";

      const baseUrl =
        server && shortname
          ? `${server.replace(/\/$/, "")}/media/courses/${shortname}/`
          : "";

      let html = "";
      if (type === "essay") {
        const inline = getInlineFeedbackText(q, type);
        html = wrapAsHtmlDocument(
          `${getFeedbackTitleH1(type)}<div class="quiz-feedback-inline">${
            baseUrl
              ? inline.replace(/@@PLUGINFILE@@/g, baseUrl)
              : courseId
                ? inline.replace(/@@PLUGINFILE@@\/?/g, "")
                : inline
          }</div>`,
        );
      } else if (server && shortname && fileName) {
        try {
          html = await fetchHtmlContent(server, shortname, fileName);

          html = replaceFeedbackTitle(html, type);
        } catch (err) {
          const inline = getInlineFeedbackText(q, type);

          html = wrapAsHtmlDocument(
            `${getFeedbackTitleH1(type)}<div class="quiz-feedback-inline">${
              baseUrl
                ? inline.replace(/@@PLUGINFILE@@/g, baseUrl)
                : courseId
                  ? inline.replace(/@@PLUGINFILE@@\/?/g, "")
                  : inline
            }</div>`,
          );
        }
      } else if (!server && courseId && fileName) {
        try {
          const offlineHtml = await loadFileFromCourse(courseId, fileName);

          if (offlineHtml) {
            const processed = await processHtmlForOfflineMedia(
              offlineHtml,
              courseId,
            );
            html = replaceFeedbackTitle(processed, type);
          } else {
            const inline = getInlineFeedbackText(q, type);

            html = wrapAsHtmlDocument(
              `${getFeedbackTitleH1(type)}<div class="quiz-feedback-inline">${inline.replace(
                /@@PLUGINFILE@@\/?/g,
                "",
              )}</div>`,
            );
          }
        } catch (err) {
          const inline = getInlineFeedbackText(q, type);
          html = wrapAsHtmlDocument(
            `${getFeedbackTitleH1(type)}<div class="quiz-feedback-inline">${inline.replace(
              /@@PLUGINFILE@@\/?/g,
              "",
            )}</div>`,
          );
        }
      } else {
        const inline = getInlineFeedbackText(q, type);

        html = wrapAsHtmlDocument(
          `${getFeedbackTitleH1(type)}<div class="quiz-feedback-inline">${
            baseUrl
              ? inline.replace(/@@PLUGINFILE@@/g, baseUrl)
              : courseId
                ? inline.replace(/@@PLUGINFILE@@\/?/g, "")
                : inline
          }</div>`,
        );
      }

      return html;
    },
    [quizData.questions, quizData.courseShortname, serverUrl, courseId],
  );

  // When showfeedback=1 per-question popup opens, fetch feedback HTML for that question only
  useEffect(() => {
    if (
      !showQuestionFeedbackPopup ||
      questionFeedbackPopupIndex == null ||
      !quizData.questions?.length
    )
      return;

    loadSingleQuestionFeedbackHtml(questionFeedbackPopupIndex).then((html) => {
      setQuestionFeedbackHtml(html);
      setQuestionFeedbackLoading(false);
    });
  }, [
    showQuestionFeedbackPopup,
    questionFeedbackPopupIndex,
    quizData.questions?.length,
    loadSingleQuestionFeedbackHtml,
  ]);

  const totalQuestions = quizData.questions?.length || 0;
  const currentQuestion = quizData.questions?.[currentQuestionIndex];
  const question = currentQuestion?.question;
  const responses = question?.responses || [];
  const questionType = question?.type || "multichoice";

  // Helper: support any language key (en, kn, etc.) and plain string for schema differences
  const getFirstLanguageValue = (
    obj: { [key: string]: string } | string | undefined,
  ): string => getLocalizedText(obj ?? null, "");

  // Extract quiz title
  const quizTitle = getFirstLanguageValue(quizData.title) || "Activity Time";

  // Extract question text (supports HTML with <p> tags or plain text / other HTML)
  const extractQuestionText = (): string => {
    const questionTitle = getFirstLanguageValue(question?.title);
    if (questionTitle) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(questionTitle, "text/html");
      const paragraphs = doc.querySelectorAll("p");
      let text = "";
      paragraphs.forEach((p) => {
        const pText = p.textContent?.trim();
        if (pText) text += pText + " ";
      });
      text = text.trim();
      // Plain text or HTML without <p> ends up in body; use it when no paragraphs found
      if (!text && doc.body?.textContent) {
        text = doc.body.textContent.trim();
      }
      return text || "Question not available";
    }
    return "Question not available";
  };

  const questionText = extractQuestionText();

  const handleStartQuiz = async () => {
    const maxAttempts = quizData.props?.maxattempts ?? "unlimited";
    const maxAttemptsNum =
      maxAttempts === "unlimited" || maxAttempts === 0
        ? null
        : typeof maxAttempts === "string"
          ? parseInt(maxAttempts, 10)
          : Number(maxAttempts);

    if (maxAttemptsNum != null && !Number.isNaN(maxAttemptsNum)) {
      if (attemptsExhausted === true) {
        return; // Already know attempts exhausted
      }
      const total = await getTotalAttemptsForQuiz();
      if (total >= maxAttemptsNum) {
        setAttemptsExhausted(true);
        alert(
          `You have reached the maximum number of attempts (${maxAttemptsNum}) for this quiz.`,
        );
        return;
      }
    }

    setQuizStarted(true);
    setQuizStartTime(Date.now()); // Start timer
  };

  // Don't auto-clear retaking flag - let it persist until quiz is actually submitted
  // This prevents results from showing again when quizStarted becomes true

  const handleOptionSelect = (index: number) => {
    setValidationMessage("");
    if (questionType === "multiselect") {
      const newSelected = new Set(selectedOptions);
      if (newSelected.has(index)) {
        newSelected.delete(index);
      } else {
        newSelected.add(index);
      }
      setSelectedOptions(newSelected);
    } else {
      setSelectedOption(index);
    }
  };

  const handleMatchingChange = (stemIndex: number, choice: string) => {
    setValidationMessage("");
    const newMatching = new Map(matchingAnswers);
    newMatching.set(stemIndex, choice);
    setMatchingAnswers(newMatching);
  };

  /** Save current question's answer from local state into answers map (used when navigating so user can go back and edit). */
  const saveCurrentAnswerToMap = () => {
    let answerToStore: any = null;
    switch (questionType) {
      case "multichoice":
        answerToStore = selectedOption;
        break;
      case "multiselect":
        answerToStore =
          selectedOptions.size > 0 ? Array.from(selectedOptions) : null;
        break;
      case "numerical":
      case "shortanswer":
        answerToStore = textAnswer.trim() ? textAnswer : null;
        break;
      case "essay":
        answerToStore = textAnswer;
        break;
      case "matching":
        answerToStore =
          matchingAnswers.size > 0 ? Object.fromEntries(matchingAnswers) : null;
        break;
      default:
        answerToStore = selectedOption;
    }
    const currentIdx = currentQuestionIndexRef.current;
    const updatedAnswers = new Map(answers);
    updatedAnswers.set(currentIdx, answerToStore);
    setAnswers(updatedAnswers);
    answersRef.current = updatedAnswers;
  };

  /** Whether the current question has an answer (selection or input). Essay requires at least some text. */
  const hasCurrentAnswer = (): boolean => {
    switch (questionType) {
      case "multichoice":
        return selectedOption !== null;
      case "multiselect":
        return selectedOptions.size > 0;
      case "numerical":
      case "shortanswer":
      case "essay":
        return textAnswer.trim().length > 0;
      case "matching":
        return matchingAnswers.size > 0;
      default:
        return selectedOption !== null;
    }
  };

  /** Next or Get Results: validate, save current answer, then show feedback popup (showfeedback=1) or go to next. */
  const handleNextOrShowFeedback = () => {
    setValidationMessage("");

    // Essay-specific validation: min_word_limit and max_word_limit handling
    if (questionType === "essay") {
      const min = Number(question?.props?.min_word_limit ?? 0);
      const max = Number(question?.props?.max_word_limit ?? 0);
      const text = textAnswer || "";
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;

      if (min > 0 && words < min) {
        const template = t("quiz.validation.minWords");
        setValidationMessage(template.replace("{min}", String(min)));
        return;
      }

      if (max > 0 && words > max) {
        const template = t("quiz.validation.maxWords");
        setValidationMessage(template.replace("{max}", String(max)));
        return;
      }

      if (max === 0 && text.length > 20000) {
        const template = t("quiz.validation.maxChars");
        setValidationMessage(template.replace("{max}", "100000"));
        return;
      }
    }

    if (!hasCurrentAnswer()) {
      const msg = t("quiz.selectOrEnterAnswer");
      setValidationMessage(
        msg && msg !== "quiz.selectOrEnterAnswer"
          ? msg
          : "Please select an option or enter your answer before continuing.",
      );
      return;
    }
    saveCurrentAnswerToMap();
    const currentIdx = currentQuestionIndexRef.current;
    const showFeedbackVal = quizData.props?.showfeedback;
    const isShowFeedbackPerQuestion =
      showFeedbackVal === 1 || showFeedbackVal === "1";
    if (isShowFeedbackPerQuestion) {
      // Pre-load feedback HTML before deciding whether to show popup
      setQuestionFeedbackLoading(true);

      loadSingleQuestionFeedbackHtml(currentIdx).then((html) => {
        const trivial = isTrivialFeedbackHtml(html);

        // If the content is just a trivial default message, skip the popup entirely
        if (trivial) {
          setQuestionFeedbackLoading(false);
          handleNextQuestion();
        } else {
          // Real feedback content — show the popup with pre-loaded HTML
          setQuestionFeedbackHtml(html);
          setQuestionFeedbackLoading(false);
          setQuestionFeedbackPopupIndex(currentIdx);
          setShowQuestionFeedbackPopup(true);
        }
      });
    } else {
      handleNextQuestion();
    }
  };

  /** Previous: save current answer, then go to previous question. */
  const handlePreviousWithSave = () => {
    setValidationMessage("");
    saveCurrentAnswerToMap();
    handlePreviousQuestion();
  };

  const handleNextQuestion = async () => {
    // Ensure current question's answer is saved before proceeding.
    // This guards against race conditions where the user's last selection
    // wasn't persisted to the answers map before scoring/navigation.
    try {
      saveCurrentAnswerToMap();
    } catch (err) {}

    // Use ref to get current index (avoids stale closure issues)
    const currentIdx = currentQuestionIndexRef.current;
    // Use ref to get latest answers (avoids stale closure issues)
    const latestAnswers = answersRef.current;

    if (currentIdx < totalQuestions - 1) {
      const nextIdx = currentIdx + 1;
      currentQuestionIndexRef.current = nextIdx;
      setCurrentQuestionIndex(nextIdx);
      const nextAnswer = latestAnswers.get(nextIdx);
      restoreAnswer(nextAnswer);
      setSubmitted(nextAnswer !== undefined);
      setShowFeedback(nextAnswer !== undefined);
    } else {
      // Quiz is complete - calculate score and show results
      const timeTaken = Math.floor((Date.now() - quizStartTime) / 1000); // in seconds

      // OppiaMobile-style scoring: sum of per-question userscores, capped by quiz maxscore
      // Iterate over all questions so unanswered ones contribute 0 (doc: sum of question userscores)
      let sumQuestionScores = 0;
      for (let i = 0; i < quizData.questions.length; i++) {
        const question = quizData.questions[i];
        const answer = latestAnswers.get(i);
        const questionScore = getQuestionUserscore(question, answer);
        sumQuestionScores += questionScore;
      }

      // Get maxScore from quizData.props.maxscore (from module.xml)
      // Explicit 0 is valid; only use totalQuestions when maxscore is missing
      const rawMax = quizData.props?.maxscore;
      const maxScore =
        rawMax !== undefined && rawMax !== null
          ? Number(rawMax)
          : totalQuestions;

      // Quiz-level cap: userscore = min(sum of question scores, quiz maxscore)
      const quizUserscore = Math.min(sumQuestionScores, maxScore);

      const passThreshold = parseInt(quizData.props?.passthreshold || "80");
      const scorePercentage =
        maxScore > 0 ? Math.round((quizUserscore / maxScore) * 100) : 0;
      const passed = scorePercentage >= passThreshold;

      // Store quiz results (raw score = quiz userscore for display/API)
      setQuizScore(quizUserscore);
      setQuizMaxScore(maxScore);
      setQuizPassed(passed);

      // Track quiz submission to analytics
      analytics.trackEvent("quiz_submitted", {
        quiz_id: quizData.id,
        quiz_title: getFirstLanguageValue(quizData.title),
        score: scorePercentage,
        passed: passed,
        time_taken: timeTaken,
        total_questions: totalQuestions,
        raw_score: quizUserscore,
        max_score: maxScore,
      });

      // Build responses array for API submission: per-question userscore (not 1/0)
      const responses = quizData.questions.map(
        (question: QuizQuestion, index: number) => {
          const answer = latestAnswers.get(index);
          const questionScore = getQuestionUserscore(question, answer);

          // Extract answer text based on question type
          let answerText = "";
          if (
            question.question.type === "multichoice" &&
            typeof answer === "number"
          ) {
            answerText = extractAnswerText(
              question.question.responses[answer]?.title || {},
            );
          } else if (
            question.question.type === "multiselect" &&
            Array.isArray(answer)
          ) {
            answerText = answer
              .map((idx) =>
                extractAnswerText(
                  question.question.responses[idx]?.title || {},
                ),
              )
              .join("|"); // Use pipe separator for multi-select
          } else if (
            question.question.type === "matching" &&
            typeof answer === "object" &&
            answer !== null
          ) {
            // Matching questions: format as "Stem1|Choice1|Stem2|Choice2|..."
            // The answer is stored as an object with stem indices as keys and choices as values
            const answerMap =
              answer instanceof Map ? answer : new Map(Object.entries(answer));

            // Get all responses for this matching question
            const matchingResponses = question.question.responses || [];

            // Build pipe-separated string: "Stem1|Choice1|Stem2|Choice2|..."
            const pairs: string[] = [];
            matchingResponses.forEach((resp) => {
              const stemText = getFirstLanguageValue(resp.title);
              if (stemText) {
                const parts = stemText.split("|");
                if (parts.length >= 2) {
                  const stem = parts[0].trim();
                  const userChoice =
                    answerMap.get(String(resp.order - 1)) || "";
                  pairs.push(`${stem}|${userChoice}`);
                }
              }
            });

            answerText = pairs.join("|");
          } else if (typeof answer === "string") {
            answerText = answer; // Numerical, short answer, essay, etc.
          }

          return {
            question_id: question.id,
            score: questionScore, // Per-question userscore (OppiaMobile-style)
            text: answerText || "",
          };
        },
      );

      // Notify parent component: rawScore = quiz userscore (sum capped by quiz maxscore)
      if (onQuizSubmit) {
        onQuizSubmit(scorePercentage, timeTaken, {
          quizId: quizData.id,
          instanceId: quizData.id,
          rawScore: quizUserscore, // Quiz userscore (sum of question scores, capped)
          totalQuestions,
          maxScore: maxScore,
          responses: responses,
        });
      }

      // CRITICAL: Persist pre-test completion IMMEDIATELY and SYNCHRONOUSLY
      // This must happen BEFORE setShowResults to prevent any race conditions

      if (isPreTest && preTestResultsKey) {
        try {
          // Update ref FIRST (synchronous, no delay)
          resultsShownRef.current = true;

          // Update localStorage IMMEDIATELY (synchronous) - marks results as shown
          window.localStorage.setItem(preTestResultsKey, "true");

          // CRITICAL: Mark pre-test as attempted ONLY when results are shown
          // This ensures user can't bypass by submitting and going back
          if (onPreTestComplete) {
            onPreTestComplete();
          } else {
          }
        } catch (error) {
          console.error(
            `[QuizRenderer] ❌ Error in pre-test completion:`,
            error,
          );
        }
      }

      // Clear retaking flag when quiz is actually submitted and results are shown
      // This allows normal results display and prevents auto-restart
      isRetakingRef.current = false;

      // Build results questions (basic)
      const basicQuestions = prepareQuizResults();

      const showFeedbackVal = quizData.props?.showfeedback;
      const isShowFeedbackPerQuestion =
        showFeedbackVal === 1 || showFeedbackVal === "1";

      // Async fetch feedback HTML for each question when showfeedback=1
      if (isShowFeedbackPerQuestion) {
        const shortname = quizData.courseShortname;
        const server = serverUrl?.replace(/\/+$/, "") ?? "";
        const latestAnswers = answersRef.current;
        const feedbackHtmls: string[] = [];

        for (let i = 0; i < quizData.questions.length; i++) {
          const q = quizData.questions[i];
          const answer = latestAnswers.get(i);
          const type = getFeedbackType(q, answer);
          const fileName =
            getResponseFeedbackHtmlFileName(q, answer) ??
            getFeedbackHtmlFileName(q, type) ??
            getFeedbackHtmlFileNameAny(q);

          let html = "";
          // Essay: use inline neutral text only
          if (type === "essay") {
            const inline = getInlineFeedbackText(q, type);
            html = wrapAsHtmlDocument(
              `${getFeedbackTitleH1(type)}<div class="quiz-feedback-inline">${inline}</div>`,
            );
          } else if (server && shortname && fileName) {
            try {
              html = await fetchHtmlContent(server, shortname, fileName);
              html = replaceFeedbackTitle(html, type);
            } catch (err) {
              const inline = getInlineFeedbackText(q, type);
              html = wrapAsHtmlDocument(
                `${getFeedbackTitleH1(type)}<div class="quiz-feedback-inline">${inline}</div>`,
              );
            }
          } else if (!server && courseId && fileName) {
            try {
              const offlineHtml = await loadFileFromCourse(courseId, fileName);
              if (offlineHtml) {
                const processed = await processHtmlForOfflineMedia(
                  offlineHtml,
                  courseId,
                );
                html = replaceFeedbackTitle(processed, type);
              } else {
                const inline = getInlineFeedbackText(q, type);
                html = wrapAsHtmlDocument(
                  `${getFeedbackTitleH1(type)}<div class="quiz-feedback-inline">${inline.replace(
                    /@@PLUGINFILE@@\/?/g,
                    "",
                  )}</div>`,
                );
              }
            } catch (err) {
              const inline = getInlineFeedbackText(q, type);
              html = wrapAsHtmlDocument(
                `${getFeedbackTitleH1(type)}<div class="quiz-feedback-inline">${inline.replace(
                  /@@PLUGINFILE@@\/?/g,
                  "",
                )}</div>`,
              );
            }
          } else {
            const inline = getInlineFeedbackText(q, type);
            html = wrapAsHtmlDocument(
              `${getFeedbackTitleH1(type)}<div class="quiz-feedback-inline">${
                courseId ? inline.replace(/@@PLUGINFILE@@\/?/g, "") : inline
              }</div>`,
            );
          }
          // Skip trivial default messages (e.g. "Your answer is correct.") from results
          feedbackHtmls.push(isTrivialFeedbackHtml(html) ? "" : html);
        }

        // Attach feedbackHtml to basicQuestions
        const mapped = basicQuestions.map((q, idx) => ({
          ...q,
          feedbackHtml: feedbackHtmls[idx] || undefined,
        }));
        setResultsQuestions(mapped);
      } else {
        setResultsQuestions(basicQuestions);
      }

      quizCompletedRef.current = true; // Prevent auto-restart
      if (!resultsShownRef.current) {
        resultsShownRef.current = true;
      }
      setShowResults(true);
    }
  };

  const getQuestionUserscore = (
    question: QuizQuestion,
    answer: any,
  ): number => {
    const questionType = question?.question?.type;
    const questionMaxscore = Number(question?.question?.props?.maxscore ?? 0);
    const cap = (total: number) =>
      questionMaxscore > 0 ? Math.min(total, questionMaxscore) : total;

    // Essay: by default full score (1 or question maxscore) when user has answered
    if (questionType === "essay") {
      if (
        answer != null &&
        typeof answer === "string" &&
        answer.trim() !== ""
      ) {
        return cap(questionMaxscore > 0 ? questionMaxscore : 1);
      }
      return 0;
    }

    if (
      !question?.question?.responses ||
      answer === null ||
      answer === undefined
    ) {
      return 0;
    }
    const responses = question.question.responses;

    switch (questionType) {
      case "multichoice": {
        const idx =
          typeof answer === "number" ? answer : parseInt(String(answer), 10);
        if (Number.isNaN(idx) || idx < 0 || idx >= responses.length) {
          return 0;
        }
        const score = parseFloat(responses[idx]?.score || "0");

        return cap(score);
      }
      case "multiselect": {
        if (!Array.isArray(answer)) return 0;
        let total = 0;
        for (const idx of answer) {
          const s = parseFloat(responses[idx]?.score || "0");
          if (s === 0) return 0; // If any selected has score 0, question score = 0
          total += s;
        }
        return cap(total);
      }
      case "shortanswer": {
        if (!answer || typeof answer !== "string" || !answer.trim()) return 0;
        const userAnswer = answer.toLowerCase().trim();
        for (const resp of responses) {
          const title = getFirstLanguageValue(resp.title).toLowerCase().trim();
          if (title === "*") continue; // Wildcard is fallback, check others first
          if (userAnswer === title) return cap(parseFloat(resp.score || "0"));
        }
        // Wildcard fallback
        const wildcard = responses.find(
          (r) => getFirstLanguageValue(r.title).trim() === "*",
        );
        return wildcard ? cap(parseFloat(wildcard.score || "0")) : 0;
      }
      case "numerical": {
        if (!answer) return 0;
        const numAnswer = parseFloat(answer);
        if (isNaN(numAnswer)) return 0;
        let best = 0;
        for (const response of responses) {
          const correctValue = parseFloat(
            getFirstLanguageValue(response.title),
          );
          if (isNaN(correctValue)) continue;
          const tolerance = response.props?.tolerance
            ? parseFloat(response.props.tolerance)
            : 0;
          if (Math.abs(numAnswer - correctValue) <= tolerance) {
            const s = parseFloat(response.score || "0");
            if (s > best) best = s;
          }
        }
        return cap(best);
      }
      case "matching": {
        if (typeof answer !== "object" || answer === null) return 0;
        const answerMap =
          answer instanceof Map ? answer : new Map(Object.entries(answer));
        if (answerMap.size === 0) return 0;
        let total = 0;
        // For each stem, find the response that matches (stem, userChoice); if its score is 0, question = 0
        const stemIndices = new Set(responses.map((r) => r.order - 1));
        for (const stemIdx of stemIndices) {
          const userChoice = answerMap.get(String(stemIdx));
          const userChoiceStr = String(userChoice ?? "");
          const selectedResp = responses.find((r) => {
            const parts = getFirstLanguageValue(r.title).split("|");
            return (
              parts.length === 2 &&
              r.order - 1 === stemIdx &&
              parts[1].trim() === userChoiceStr
            );
          });
          if (!selectedResp) continue;
          const s = parseFloat(selectedResp.score || "0");
          if (s === 0) return 0; // If any selected pair has score 0, question score = 0
          total += s;
        }
        return cap(total);
      }
      case "description":
        return 0;
      default:
        return 0;
    }
  };

  // Helper function to check if answer is correct
  const isAnswerCorrect = (question: QuizQuestion, answer: any): boolean => {
    if (
      !question?.question?.responses ||
      answer === null ||
      answer === undefined
    )
      return false;

    const responses = question.question.responses;
    const questionType = question.question.type;

    switch (questionType) {
      case "multichoice":
        // Answer is stored as index (0, 1, 2, etc.), not response ID
        if (
          typeof answer !== "number" ||
          answer < 0 ||
          answer >= responses.length
        )
          return false;
        const selectedResponse = responses[answer];
        return selectedResponse
          ? parseFloat(selectedResponse.score) > 0
          : false;

      case "multiselect":
        // Answer is stored as array of indices, not response IDs
        if (!Array.isArray(answer)) return false;
        // Find indices of correct responses (responses with score > 0)
        const correctIndices = new Set<number>();
        responses.forEach((r, idx) => {
          if (parseFloat(r.score) > 0) {
            correctIndices.add(idx);
          }
        });
        const selectedIndices = new Set(answer);

        // Check if sets are equal
        if (correctIndices.size !== selectedIndices.size) return false;
        for (const idx of correctIndices) {
          if (!selectedIndices.has(idx)) return false;
        }
        return true;

      case "essay":
        // Essay questions require manual grading, so we give partial credit if answered
        return answer && typeof answer === "string" && answer.trim().length > 0;

      case "shortanswer":
        // Short answer: compare case-insensitively against correct responses
        if (!answer || typeof answer !== "string" || !answer.trim())
          return false;
        const userAnswer = answer.toLowerCase().trim();
        return responses.some((resp) => {
          const correctAnswer = getFirstLanguageValue(resp.title)
            .toLowerCase()
            .trim();
          return userAnswer === correctAnswer;
        });

      case "numerical":
        if (!answer) return false;
        const numAnswer = parseFloat(answer);
        if (isNaN(numAnswer)) return false;

        // Check against correct responses with tolerance
        for (const response of responses) {
          if (parseFloat(response.score) > 0) {
            const correctValue = parseFloat(
              getFirstLanguageValue(response.title),
            );
            const tolerance = response.props?.tolerance
              ? parseFloat(response.props.tolerance)
              : 0;

            if (Math.abs(numAnswer - correctValue) <= tolerance) {
              return true;
            }
          }
        }
        return false;

      case "matching":
        // For matching questions, check if all stems are matched correctly
        if (typeof answer !== "object" || answer === null) return false;
        const answerMap =
          answer instanceof Map ? answer : new Map(Object.entries(answer));

        if (answerMap.size === 0) return false;

        // Parse matching pairs and check if all selected matches are correct
        let correctMatches = 0;
        let totalStems = 0;

        responses.forEach((resp) => {
          const pairText = getFirstLanguageValue(resp.title);
          const parts = pairText.split("|");
          if (parts.length === 2 && parts[0].trim()) {
            totalStems++;
            // Get user's choice for this stem (stem index is resp.order - 1)
            const userChoice = answerMap.get(String(resp.order - 1));
            const correctChoice = parts[1].trim();
            if (userChoice === correctChoice) {
              correctMatches++;
            }
          }
        });

        // All stems must be matched correctly
        return correctMatches === totalStems && totalStems > 0;

      default:
        return false;
    }
  };

  /** For showfeedback === 1: get feedback type per question (correct / incorrect / partial / essay). Essay has no points or right/wrong. */
  const getFeedbackType = (
    question: QuizQuestion,
    answer: any,
  ): "correct" | "incorrect" | "partial" | "essay" => {
    if (question?.question?.type === "essay") return "essay";
    const maxScore = Number(question?.question?.props?.maxscore ?? 1);
    const userScore = getQuestionUserscore(question, answer);
    let type: "correct" | "incorrect" | "partial" = "incorrect";
    if (userScore <= 0) {
      type = "incorrect";
    } else if (maxScore <= 0) {
      // No valid max score (e.g. AP course with maxscore 0): don't show "correct" for all
      type = "partial";
    } else if (
      userScore >= maxScore ||
      (maxScore > 0 && userScore >= maxScore * 0.9)
    ) {
      type = "correct";
    } else {
      type = "partial";
    }
    return type;
  };

  /** Parse *feedbackhtmlfile JSON (e.g. {"en":"02_558_question_correctfeedback_en.html"}) and return filename. Essay has no file, use inline. */
  const getFeedbackHtmlFileName = (
    question: QuizQuestion,
    type: "correct" | "incorrect" | "partial" | "essay",
  ): string | null => {
    if (type === "essay") return null;
    // For multiselect, Android uses binary classification (correct/incorrect only, no partial).
    // Match that behavior: treat partial as incorrect for file resolution.
    const effectiveType =
      type === "partial" && question?.question?.type === "multiselect"
        ? "incorrect"
        : type;
    const key =
      effectiveType === "correct"
        ? "correctfeedbackhtmlfile"
        : effectiveType === "partial"
          ? "partiallycorrectfeedbackhtmlfile"
          : "incorrectfeedbackhtmlfile";
    const raw = question?.question?.props?.[key];
    if (!raw || typeof raw !== "string") {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      const fileName = getLocalizedText(parsed, "") || null;
      return fileName;
    } catch (e) {
      return null;
    }
  };

  /** First available feedback HTML file so we show the same HTML for all outcomes and only change the title (Success / Partially correct / Oh no!). */
  const getFeedbackHtmlFileNameAny = (
    question: QuizQuestion,
  ): string | null => {
    const keys = [
      "correctfeedbackhtmlfile",
      "incorrectfeedbackhtmlfile",
      "partiallycorrectfeedbackhtmlfile",
    ] as const;
    for (const key of keys) {
      const raw = question?.question?.props?.[key];
      if (!raw || typeof raw !== "string") continue;
      try {
        const parsed = JSON.parse(raw) as Record<string, string>;
        const fileName = getLocalizedText(parsed, "") || null;
        if (fileName) return fileName;
      } catch {
        continue;
      }
    }
    return null;
  };

  /** For multichoice/multiselect: get the selected response's feedbackhtmlfile so Q2/Q3 etc. show per-option HTML (module.xml has feedbackhtmlfile on each response). */
  const getResponseFeedbackHtmlFileName = (
    question: QuizQuestion,
    answer: any,
  ): string | null => {
    const responses = question?.question?.responses;
    if (!responses?.length || answer === null || answer === undefined)
      return null;
    let response: QuizResponse | undefined;
    if (
      question.question.type === "multichoice" &&
      typeof answer === "number"
    ) {
      response = responses[answer];
    } else if (
      question.question.type === "multiselect" &&
      Array.isArray(answer) &&
      answer.length > 0
    ) {
      response = responses[answer[0]];
    } else {
      return null;
    }
    const raw = response?.props?.feedbackhtmlfile;
    if (!raw || typeof raw !== "string") return null;
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      return getLocalizedText(parsed, "") || null;
    } catch {
      return null;
    }
  };

  /** Fallback when HTML file is missing: use inline feedback text from question props. Essay has no right/wrong. */
  const getInlineFeedbackText = (
    question: QuizQuestion,
    type: "correct" | "incorrect" | "partial" | "essay",
  ): string => {
    if (type === "essay") return "Your response has been recorded.";
    // For multiselect, match Android's binary classification: partial → incorrect
    const effectiveType =
      type === "partial" && question?.question?.type === "multiselect"
        ? "incorrect"
        : type;
    const key =
      effectiveType === "correct"
        ? "correctfeedback"
        : effectiveType === "partial"
          ? "partiallycorrectfeedback"
          : "incorrectfeedback";
    const raw = question?.question?.props?.[key];
    let result: string;
    if (typeof raw === "string") result = raw;
    else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      result = getLocalizedText(raw as Record<string, string>, "");
    } else {
      result =
        type === "correct"
          ? "Your answer is correct."
          : type === "partial"
            ? "Your answer is partially correct."
            : "Your answer is incorrect.";
    }

    return result;
  };

  const handlePreviousQuestion = () => {
    const currentIdx = currentQuestionIndexRef.current;
    if (currentIdx > 0) {
      const prevIdx = currentIdx - 1;
      currentQuestionIndexRef.current = prevIdx;
      setCurrentQuestionIndex(prevIdx);
      const previousAnswer = answers.get(prevIdx);
      restoreAnswer(previousAnswer);
      setSubmitted(previousAnswer !== undefined);
      setShowFeedback(previousAnswer !== undefined);
    }
  };

  const restoreAnswer = (answer: any) => {
    const nextQuestionType =
      quizData.questions[currentQuestionIndex + 1]?.question?.type ||
      quizData.questions[currentQuestionIndex - 1]?.question?.type;

    setSelectedOption(null);
    setSelectedOptions(new Set());
    setTextAnswer("");
    setMatchingAnswers(new Map());

    if (answer !== undefined && answer !== null) {
      if (Array.isArray(answer)) {
        setSelectedOptions(new Set(answer));
      } else if (typeof answer === "object") {
        setMatchingAnswers(
          new Map(
            Object.entries(answer).map(([k, v]) => [parseInt(k), v as string]),
          ),
        );
      } else if (typeof answer === "string") {
        setTextAnswer(answer);
      } else if (typeof answer === "number") {
        setSelectedOption(answer);
      }
    }
  };

  // Calculate if answer is correct
  const calculateCorrectness = () => {
    switch (questionType) {
      case "multichoice":
        return (
          selectedOption !== null &&
          parseFloat(responses[selectedOption]?.score) > 0
        );

      case "multiselect":
        const selectedScore = Array.from(selectedOptions).reduce((sum, idx) => {
          return sum + parseFloat(responses[idx]?.score || "0");
        }, 0);
        return selectedScore >= 0.99;

      case "numerical":
        if (!textAnswer.trim()) return false;
        const numAnswer = parseFloat(textAnswer);
        return responses.some((resp) => {
          const correctValue = parseFloat(getFirstLanguageValue(resp.title));
          const tolerance = parseFloat(resp.props.tolerance || "0");
          return Math.abs(numAnswer - correctValue) <= tolerance;
        });

      case "shortanswer":
        if (!textAnswer.trim()) return false;
        return responses.some((resp) => {
          const correctAnswer = getFirstLanguageValue(resp.title)
            .toLowerCase()
            .trim();
          return textAnswer.toLowerCase().trim() === correctAnswer;
        });

      case "matching":
        // Parse matching pairs and check if all selected matches are correct
        let correctMatches = 0;
        let totalStems = 0;

        responses.forEach((resp) => {
          const pairText = getFirstLanguageValue(resp.title);
          const parts = pairText.split("|");
          if (parts.length === 2 && parts[0].trim()) {
            totalStems++;
            const userChoice = matchingAnswers.get(resp.order - 1);
            if (userChoice === parts[1].trim()) {
              correctMatches++;
            }
          }
        });

        return correctMatches === totalStems && totalStems > 0;

      case "essay":
        return true; // Essay questions are always marked as correct

      default:
        return (
          selectedOption !== null &&
          parseFloat(responses[selectedOption]?.score) > 0
        );
    }
  };

  const isCorrect = calculateCorrectness();

  // Extract answer text (title can be lang-keyed object or plain string depending on schema)
  const extractAnswerText = (
    title: { [key: string]: string } | string | undefined,
  ): string => {
    if (title === undefined || title === null) return "";

    const titleText = getFirstLanguageValue(title);
    if (!titleText) return "";

    // Trim the text first
    const trimmedText = titleText.trim();
    if (!trimmedText) return "";

    // Check if it's plain text (no HTML tags) - like "True" or "False"
    // Plain text won't contain < or > characters (unless it's actual HTML)
    const hasHtmlTags = /<[^>]+>/.test(trimmedText);

    if (!hasHtmlTags) {
      // Plain text - return as is (already trimmed)
      return trimmedText;
    }

    // It's HTML - parse and extract text (supports <p> or plain-in-body / other HTML)
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmedText, "text/html");
      const paragraphs = doc.querySelectorAll("p");

      if (paragraphs.length > 0) {
        let text = "";
        paragraphs.forEach((p) => {
          const pText = p.textContent?.trim();
          if (pText) text += pText + " ";
        });
        const result = text.trim();
        if (result) return result;
      }

      // No <p> or empty <p>: use body so options work for plain text or other HTML
      const bodyText = doc.body?.textContent?.trim();
      if (bodyText) return bodyText;
    } catch (error) {}

    // Fallback: return the original text trimmed
    return trimmedText;
  };

  // Parse matching question pairs
  const parseMatchingPairs = () => {
    const stems: Array<{ order: number; text: string }> = [];
    const choices: Set<string> = new Set();

    responses.forEach((resp) => {
      const pairText = getFirstLanguageValue(resp.title);
      const parts = pairText.split("|");

      if (parts.length === 2) {
        const stemPart = parts[0].trim();
        const choicePart = parts[1].trim();

        if (stemPart) {
          // Extract text from HTML
          const parser = new DOMParser();
          const doc = parser.parseFromString(stemPart, "text/html");
          const stemText = doc.body.textContent?.trim() || stemPart;
          stems.push({ order: resp.order, text: stemText });
        }

        if (choicePart) {
          choices.add(choicePart);
        }
      } else if (parts.length === 1 && parts[0].trim()) {
        // This is just a choice without a stem
        choices.add(parts[0].trim());
      }
    });

    return { stems, choices: Array.from(choices) };
  };

  // Handle retake quiz
  const handleRetakeQuiz = async () => {
    // Check if quiz allows retaking (maxAttempts should not be 1)
    const maxAttempts = quizData.props?.maxattempts || "unlimited";
    if (maxAttempts === 1 || maxAttempts === "1") {
      return; // Prevent retaking for one-time-only quizzes
    }

    // Check if attempts limit has been reached (defense-in-depth)
    const maxAttemptsNum =
      maxAttempts === "unlimited" || maxAttempts === 0
        ? null
        : typeof maxAttempts === "string"
          ? parseInt(maxAttempts, 10)
          : maxAttempts;

    if (maxAttemptsNum !== null && !isNaN(maxAttemptsNum)) {
      try {
        let totalAttempts = 0;

        // Try API first
        if (quizData.courseShortname) {
          try {
            const apiAttempts =
              await activityTrackingService.getQuizAttemptsByDigest(
                quizData.courseShortname,
                quizData.digest,
              );
            totalAttempts = apiAttempts.length;
          } catch (error) {}
        }

        // Fallback to IndexedDB if API failed or no courseShortname
        if (totalAttempts === 0 && user?.id) {
          try {
            const localAttempts = await getQuizAttemptsByDigest(
              Number(user.id),
              quizData.digest,
            );
            totalAttempts = localAttempts.length;
          } catch (error) {}
        }

        // Block retake if attempts exhausted
        if (totalAttempts >= maxAttemptsNum) {
          // Show alert to user
          alert(
            `You have reached the maximum number of attempts (${maxAttemptsNum}) for this quiz.`,
          );
          return;
        }
      } catch (error) {}
    }

    // Mark that we're retaking (prevents localStorage check from showing results)
    isRetakingRef.current = true;

    // Clear pre-test completion from localStorage if it's a pre-test
    if (isPreTest && preTestResultsKey && typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(preTestResultsKey);
      } catch (error) {}
    }

    // Reset all quiz state
    quizCompletedRef.current = false; // Allow start screen on next take
    setShowResults(false);
    resultsShownRef.current = false; // Clear the ref that tracks results shown

    // Reset quiz score state
    setQuizScore(0);
    setQuizMaxScore(0);
    setQuizPassed(false);

    // Reset question index first
    currentQuestionIndexRef.current = 0;
    setCurrentQuestionIndex(0);

    // Clear all answers and form state
    setSelectedOption(null);
    setSelectedOptions(new Set());
    setTextAnswer("");
    setMatchingAnswers(new Map());
    setSubmitted(false);
    setShowFeedback(false);
    const emptyAnswers = new Map();
    setAnswers(emptyAnswers);
    answersRef.current = emptyAnswers;

    // Reset quiz start time
    setQuizStartTime(Date.now());

    // IMPORTANT: Start the quiz immediately (don't show "Take Quiz" screen)
    // This allows user to retake directly from question 1
    setQuizStarted(true);
  };

  // Handle continue from results
  const handleContinueFromResults = () => {
    // If this is a pre-test, notify parent to mark as attempted
    // This should already be done on submit, but call it again as backup
    if (isPreTest && onPreTestComplete) {
      onPreTestComplete();
    }

    // Always call onComplete to navigate to next page
    // Pre-test completion doesn't block navigation - user can always continue
    if (onComplete) {
      onComplete();
    } else {
    }
  };

  // Prepare quiz results data
  const prepareQuizResults = () => {
    // Use answersRef.current to ensure we read the latest persisted answers (avoids React state staleness)
    const latestAnswersForResults = answersRef.current;
    const questions = quizData.questions.map((q, index) => {
      const answer = latestAnswersForResults.get(index);
      const isCorrect = isAnswerCorrect(q, answer);

      // Extract question text (supports <p> or plain text / other HTML)
      const questionTitle = getFirstLanguageValue(q.question.title);
      let questionText = "Question not available";
      if (questionTitle) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(questionTitle, "text/html");
        const paragraphs = doc.querySelectorAll("p");
        let text = "";
        paragraphs.forEach((p) => {
          const pText = p.textContent?.trim();
          if (pText) text += pText + " ";
        });
        text = text.trim();
        if (!text && doc.body?.textContent) {
          text = doc.body.textContent.trim();
        }
        questionText = text || "Question not available";
      }

      let userAnswer = "";
      if (q.question.type === "multichoice" && typeof answer === "number") {
        userAnswer = extractAnswerText(q.question.responses[answer]?.title);
      } else if (q.question.type === "multiselect" && Array.isArray(answer)) {
        userAnswer = answer
          .map((idx) => extractAnswerText(q.question.responses[idx]?.title))
          .join(", ");
      } else if (typeof answer === "string") {
        userAnswer = answer;
      }

      const feedbackType = getFeedbackType(q, answer);

      return {
        questionNumber: index + 1,
        questionText,
        isCorrect,
        userAnswer,
        feedbackType,
      };
    });

    return questions;
  };

  // CRITICAL: Check localStorage FIRST for pre-tests before any rendering
  // This prevents the "Take Quiz" screen from flashing even for a millisecond
  const checkPreTestCompleted = (): boolean => {
    // Don't check localStorage if user is retaking
    if (isRetakingRef.current) return false;
    if (!isPreTest || typeof window === "undefined") return false;
    try {
      const key = `pretest_results_shown_${quizData.id}`;
      return window.localStorage.getItem(key) === "true";
    } catch {
      return false;
    }
  };

  const preTestCompleted = checkPreTestCompleted();

  // Show quiz results screen
  // Use ref check as fallback to prevent reset on re-render
  // CRITICAL: For pre-tests, check localStorage FIRST to prevent any flash
  // But don't show results if user is retaking
  const shouldShowResults =
    !isRetakingRef.current &&
    (showResults || resultsShownRef.current || preTestCompleted);

  // CRITICAL: If pre-test is completed, immediately sync state BEFORE rendering
  // This prevents any flash of "Take Quiz" screen
  // But don't sync if user is retaking (they want to start fresh)
  if (
    preTestCompleted &&
    !isRetakingRef.current &&
    (!showResults || !resultsShownRef.current)
  ) {
    // Update ref immediately (synchronous)
    if (!resultsShownRef.current) {
      resultsShownRef.current = true;
    }
    // Update state (will trigger re-render, but we'll show results screen immediately)
    if (!showResults) {
      setShowResults(true);
      setQuizStarted(true);
    }
  }

  if (shouldShowResults) {
    // Ensure state is synced with ref and localStorage
    // But don't sync if user is retaking (they want to start fresh)
    if (
      !isRetakingRef.current &&
      (resultsShownRef.current || preTestCompleted) &&
      !showResults
    ) {
      setShowResults(true);
      setQuizStarted(true);
    }

    const passThreshold = parseInt(quizData.props?.passthreshold || "80");
    const maxAttempts = quizData.props?.maxattempts || "unlimited";
    const showFeedback = quizData.props?.showfeedback;
    const questions = resultsQuestions ?? prepareQuizResults();

    // Use QuizResultsScreen for both regular quizzes and pre-tests
    // Pre-tests will hide attempts section via isPreTest prop
    return (
      <QuizResultsScreen
        score={quizScore}
        maxScore={quizMaxScore}
        passed={quizPassed}
        passThreshold={passThreshold}
        maxAttempts={maxAttempts}
        showFeedback={showFeedback}
        currentAttempt={{
          score: quizScore,
          maxScore: quizMaxScore,
          passed: quizPassed,
          submittedDate: new Date().toISOString(),
          timeTaken: Math.floor((Date.now() - quizStartTime) / 1000),
        }}
        quizDigest={quizData.digest}
        courseShortname={quizData.courseShortname}
        questions={questions}
        onRetake={handleRetakeQuiz}
        onContinue={handleContinueFromResults}
        isPreTest={isPreTest}
      />
    );
  }

  // Quiz Start Screen
  // CRITICAL: Don't show start screen if quiz is already completed (e.g. at-end feedback popup); prevents auto-restart
  // For pre-tests, check localStorage FIRST - if completed, don't show "Take Quiz" screen
  if (!quizStarted && !quizCompletedRef.current) {
    // If this is a pre-test and it's already completed (and not retaking), show results instead
    if (isPreTest && preTestCompleted && !isRetakingRef.current) {
      // State sync should have happened above, but if not, trigger it now
      if (!showResults) {
        resultsShownRef.current = true;
        setShowResults(true);
        setQuizStarted(true);
      }
      // Return results screen immediately (using QuizResultsScreen with isPreTest=true)
      const passThreshold = parseInt(quizData.props?.passthreshold || "80");
      const maxAttempts = quizData.props?.maxattempts || "unlimited";
      const showFeedback = quizData.props?.showfeedback;
      const questions = resultsQuestions ?? prepareQuizResults();
      return (
        <QuizResultsScreen
          score={quizScore}
          maxScore={quizMaxScore}
          passed={quizPassed}
          passThreshold={passThreshold}
          maxAttempts={maxAttempts}
          showFeedback={showFeedback}
          currentAttempt={{
            score: quizScore,
            maxScore: quizMaxScore,
            passed: quizPassed,
            submittedDate: new Date().toISOString(),
            timeTaken: Math.floor((Date.now() - quizStartTime) / 1000),
          }}
          quizDigest={quizData.digest}
          courseShortname={quizData.courseShortname}
          questions={questions}
          onRetake={handleRetakeQuiz}
          onContinue={handleContinueFromResults}
          isPreTest={true}
        />
      );
    }

    // Max attempts exhausted: show blocked screen (no Take Quiz), only Continue
    if (!isPreTest && attemptsExhausted === true) {
      const maxAttempts = quizData.props?.maxattempts || "unlimited";
      return (
        <div className="quiz-start-screen flex items-center justify-center min-h-[60vh] p-6">
          <div className="text-center max-w-md">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 mb-4">
                <XCircle className="w-10 h-10 text-amber-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Maximum attempts reached
              </h2>
              <p className="text-gray-600 mb-6">
                You have reached the maximum number of attempts (
                {maxAttempts === "unlimited" || maxAttempts === 0
                  ? "—"
                  : maxAttempts}
                ) for this quiz. You cannot take this quiz again.
              </p>
            </div>
            <Button
              onClick={() => onComplete?.()}
              className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-3 rounded-xl font-medium">
              Continue
            </Button>
          </div>
        </div>
      );
    }

    // Loading attempts check (finite max attempts, still checking)
    if (!isPreTest && checkingAttempts && attemptsExhausted === null) {
      return (
        <div className="quiz-start-screen flex items-center justify-center min-h-[60vh] p-6">
          <div className="text-center max-w-md">
            <p className="text-gray-600">{t("quiz.loading")}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="quiz-start-screen flex items-center justify-center min-h-[60vh] p-6">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-100 mb-4">
              <PlayCircle className="w-10 h-10 text-primary-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {quizTitle}
            </h2>
            <p className="text-gray-600">
              {totalQuestions}{" "}
              {totalQuestions === 1 ? t("quiz.question") : t("quiz.questions")}
            </p>
          </div>

          <Button
            variant="secondary"
            onClick={handleStartQuiz}
            className=" w-full sm:w-auto">
            {t("quiz.takeQuiz")}
          </Button>
        </div>
      </div>
    );
  }

  // Render question based on type
  const renderQuestion = () => {
    switch (questionType) {
      case "numerical":
      case "shortanswer":
        return (
          <div className="mb-6">
            <Input
              type={questionType === "numerical" ? "number" : "text"}
              value={textAnswer}
              onChange={(e) => {
                setValidationMessage("");
                setTextAnswer(e.target.value);
              }}
              placeholder={
                questionType === "numerical"
                  ? "Enter a number"
                  : "Enter your answer"
              }
              className="text-lg p-4"
            />
          </div>
        );

      case "essay":
        return (
          <div className="mb-6">
            <Textarea
              value={textAnswer}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                setValidationMessage("");
                setTextAnswer(e.target.value);
              }}
              placeholder="Type your answer here..."
              className="min-h-[150px] text-base p-4"
              rows={question?.props.input_box_size || 10}
            />
          </div>
        );

      case "matching":
        const { stems, choices } = parseMatchingPairs();
        return (
          <div className="mb-6 space-y-4">
            {stems.map((stem) => (
              <div key={stem.order} className="border rounded-lg p-4">
                <p className="font-medium mb-3">{stem.text}</p>
                <select
                  value={matchingAnswers.get(stem.order - 1) || ""}
                  onChange={(e) =>
                    handleMatchingChange(stem.order - 1, e.target.value)
                  }
                  className="w-full p-2 border rounded-md">
                  <option value="">Select a match...</option>
                  {choices.map((choice, idx) => (
                    <option key={idx} value={choice}>
                      {choice}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        );

      case "multiselect":
        return (
          <div className="options space-y-3 mb-6">
            {responses.map((response, index) => {
              const isSelected = selectedOptions.has(index);
              const answerText = extractAnswerText(response.title);
              const optionKey = `q${
                currentQuestion?.id ?? currentQuestionIndex
              }-opt-${index}`;

              return (
                <div
                  key={optionKey}
                  onClick={() => handleOptionSelect(index)}
                  className="option cursor-pointer transition-all duration-200 hover:shadow-md">
                  <div
                    className={`
                      flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer
                      ${
                        isSelected
                          ? "border-cyan-500 bg-cyan-50"
                          : "border-gray-200 bg-white"
                      }
                    `}>
                    {/* Checkbox */}
                    <div
                      className={`
                        shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center
                        ${
                          isSelected
                            ? "bg-cyan-500 border-cyan-500"
                            : "bg-white border-gray-300"
                        }
                      `}>
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </div>

                    {/* Option Text */}
                    <div className="flex-1">
                      <p className="text-gray-800">{answerText}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );

      case "multichoice":
      default:
        // Check if this is a True/False question
        const isTrueFalseQuestion =
          responses.length === 2 &&
          responses.some(
            (r) =>
              extractAnswerText(r.title).toLowerCase().trim() === "true" ||
              extractAnswerText(r.title).toLowerCase().trim() === "false",
          );

        return (
          <div className="options space-y-3 mb-6">
            {responses.map((response, index) => {
              const isSelected = selectedOption === index;
              const answerText = extractAnswerText(response.title);
              const optionKey = `q${
                currentQuestion?.id ?? currentQuestionIndex
              }-opt-${index}`;

              return (
                <div
                  key={optionKey}
                  onClick={() => handleOptionSelect(index)}
                  className="option cursor-pointer transition-all duration-200 hover:shadow-md">
                  <div
                    className={`
                      flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer
                      ${
                        isSelected
                          ? "border-cyan-500 bg-cyan-50"
                          : "border-gray-200 bg-white"
                      }
                    `}>
                    {/* Option Label (A, B, C, D) or True/False text */}
                    <div
                      className={`
                        shrink-0 ${
                          isTrueFalseQuestion ? "px-3" : "w-8"
                        } h-8 rounded-full flex items-center justify-center font-semibold text-sm
                        ${
                          isSelected
                            ? "bg-cyan-500 text-white"
                            : "bg-gray-100 text-gray-600"
                        }
                      `}>
                      {isTrueFalseQuestion
                        ? answerText
                        : String.fromCharCode(65 + index)}
                    </div>

                    {/* Option Text (only show if not True/False) */}
                    {!isTrueFalseQuestion && (
                      <div className="flex-1">
                        <p className="text-gray-800">{answerText}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
    }
  };

  // Check if submit should be enabled
  const canSubmit = () => {
    switch (questionType) {
      case "multichoice":
        return selectedOption !== null;
      case "multiselect":
        return selectedOptions.size > 0;
      case "numerical":
      case "shortanswer":
        return textAnswer.trim().length > 0;
      case "essay":
        return true; // Essay can be submitted even if empty
      case "matching":
        return matchingAnswers.size > 0;
      default:
        return selectedOption !== null;
    }
  };

  // Quiz Question Screen (with optional showfeedback=1 feedback popup on top)
  return (
    <>
      <AlertDialog
        open={showFeedbackPopup}
        onOpenChange={(open) => {
          if (!open) {
            setShowFeedbackPopup(false);
            if (!resultsShownRef.current) resultsShownRef.current = true;
            setShowResults(true);
          }
        }}>
        <AlertDialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <AlertDialogTitle className="sr-only">Quiz feedback</AlertDialogTitle>
          <div className="flex-1 overflow-y-auto min-h-0 space-y-6 pr-2">
            {feedbackPopupLoading ? (
              <p className="text-muted-foreground py-4">Loading feedback...</p>
            ) : (
              feedbackPopupHtml.map((item) => (
                <div
                  key={item.questionIndex}
                  className="border rounded-lg p-4 bg-muted/30">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Question {item.questionIndex}
                  </p>
                  <FeedbackIframe srcDoc={item.html} />
                </div>
              ))
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setShowFeedbackPopup(false);
                if (!resultsShownRef.current) resultsShownRef.current = true;
                setShowResults(true);
              }}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* showfeedback=1: per-question feedback popup when Submit clicked; Next goes to next question */}
      <AlertDialog
        open={showQuestionFeedbackPopup}
        onOpenChange={(open) => {
          if (!open) {
            setShowQuestionFeedbackPopup(false);
            setQuestionFeedbackPopupIndex(null);
          }
        }}>
        <AlertDialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <AlertDialogTitle className="sr-only">
            Question feedback
          </AlertDialogTitle>
          <div className="flex-1 overflow-y-auto min-h-0 pr-2">
            {questionFeedbackLoading ? (
              <p className="text-muted-foreground py-4">Loading feedback...</p>
            ) : (
              <FeedbackIframe srcDoc={questionFeedbackHtml} />
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setShowQuestionFeedbackPopup(false);
                setQuestionFeedbackPopupIndex(null);
                handleNextQuestion();
              }}>
              {questionFeedbackPopupIndex !== null &&
              questionFeedbackPopupIndex >=
                (quizData.questions?.length ?? 1) - 1
                ? "Get Results"
                : "Next"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="quiz-container max-h-[85vh] pb-32 overflow-y-auto p-6 max-w-3xl mx-auto">
        {/* Question Counter */}
        <div className="mb-4 text-center">
          <p className="text-sm text-gray-500">
            Question {currentQuestionIndex + 1} of {totalQuestions}
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-primary-500 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${
                  ((currentQuestionIndex + 1) / totalQuestions) * 100
                }%`,
              }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="question mb-6">
          <div className="bg-cyan-50 rounded-lg p-4 mb-4">
            <p className="text-lg font-medium text-gray-800">{questionText}</p>
          </div>
        </div>

        {/* Render question based on type */}
        {renderQuestion()}

        {/* Validation message when user tries to proceed without answering */}
        {validationMessage && (
          <p className="text-amber-600 text-sm font-medium mb-2 text-center">
            {validationMessage}
          </p>
        )}
        {/* Previous and Next: user can navigate and come back to edit answers */}
        <div
          className={`flex flex-col sm:flex-row items-stretch sm:items-center ${
            currentQuestionIndex === 0 && totalQuestions === 1
              ? "justify-center"
              : "justify-between"
          } gap-3 mt-6 pb-20 md:pb-8`}>
          {currentQuestionIndex > 0 ? (
            <BackButton
              onClick={handlePreviousWithSave}
              variant="outline"
              label={t("quiz.previous")}
              iconSize="sm"
              className="border-gray-300 disabled:opacity-50 w-full sm:w-auto order-2 sm:order-1"
            />
          ) : totalQuestions > 1 ? (
            <div className="w-full sm:w-auto order-2 sm:order-1" />
          ) : null}
          <Button
            onClick={handleNextOrShowFeedback}
            variant="default"
            className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3  font-medium w-full sm:w-auto order-1 sm:order-2">
            {currentQuestionIndex < totalQuestions - 1 ? (
              <>
                {t("quiz.next")}
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            ) : (
              <>
                Get Results
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
