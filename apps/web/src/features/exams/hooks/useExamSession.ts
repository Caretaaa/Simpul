import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { examStorageKey, readExamRecord, type ExamDefinition, type ExamResultRecord, type ExamSessionRecord, type ExamType } from "../types";

interface UseExamSessionOptions {
  exam: ExamDefinition;
  userId: string;
  courseId: string;
  examType: ExamType;
}

const emptySession: ExamSessionRecord = {
  answers: {},
  currentQuestionIndex: 0,
  startedAt: null,
  result: null,
};

/** Mock submit API. Ganti isi fungsi ini dengan api.post saat endpoint asesmen tersedia. */
async function submitExamMock(result: ExamResultRecord): Promise<ExamResultRecord> {
  await new Promise((resolve) => window.setTimeout(resolve, 450));
  return result;
}

function scoreExam(exam: ExamDefinition, answers: Record<string, number>, examType: ExamType): ExamResultRecord {
  const wrong = exam.questions.filter((question) => answers[question.id] !== question.answerIndex);
  const correctCount = exam.questions.length - wrong.length;
  return {
    examType,
    score: exam.questions.length === 0 ? 0 : Math.round((correctCount / exam.questions.length) * 100),
    correctCount,
    totalQuestions: exam.questions.length,
    weakTopics: [...new Set(wrong.map((question) => question.topic))],
    completedAt: new Date().toISOString(),
  };
}

export function useExamSession({ exam, userId, courseId, examType }: UseExamSessionOptions) {
  const storageKey = useMemo(() => examStorageKey(userId, courseId, examType), [userId, courseId, examType]);
  const [session, setSession] = useState<ExamSessionRecord>(() => readExamRecord(userId, courseId, examType) ?? emptySession);
  const [now, setNow] = useState(Date.now());
  const timeExpired = useRef(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
    } catch {
      // Storage penuh/terblokir tidak boleh menghentikan siswa mengerjakan ujian.
    }
  }, [session, storageKey]);

  const submitMutation = useMutation({ mutationFn: submitExamMock });
  const { mutateAsync, isPending, error, reset } = submitMutation;
  const result = session.result;
  const isComplete = Boolean(result);
  const isStarted = session.startedAt !== null;
  const currentQuestionIndex = Math.min(session.currentQuestionIndex, Math.max(exam.questions.length - 1, 0));
  const currentQuestion = exam.questions[currentQuestionIndex] ?? null;
  const answeredCount = Object.keys(session.answers).length;
  const remainingSeconds = exam.durationSeconds && session.startedAt !== null
    ? Math.max(0, exam.durationSeconds - Math.floor((now - session.startedAt) / 1000))
    : null;

  const start = useCallback(() => {
    timeExpired.current = false;
    setSession((current) => current.result ? current : {
      ...current,
      startedAt: current.startedAt ?? Date.now(),
    });
  }, []);

  const chooseAnswer = useCallback((questionId: string, optionIndex: number) => {
    if (isComplete || isPending) return;
    setSession((current) => ({
      ...current,
      startedAt: current.startedAt ?? Date.now(),
      answers: { ...current.answers, [questionId]: optionIndex },
    }));
  }, [isComplete, isPending]);

  const goToQuestion = useCallback((index: number) => {
    setSession((current) => ({
      ...current,
      currentQuestionIndex: Math.max(0, Math.min(index, exam.questions.length - 1)),
    }));
  }, [exam.questions.length]);

  const submit = useCallback(async () => {
    if (result || exam.questions.length === 0) return result;
    const finalResult = await mutateAsync(scoreExam(exam, session.answers, examType));
    setSession((current) => ({ ...current, result: finalResult }));
    return finalResult;
  }, [exam, examType, result, session.answers, mutateAsync]);

  useEffect(() => {
    if (!isStarted || isComplete || remainingSeconds === null) return;
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [isStarted, isComplete, remainingSeconds === null]);

  useEffect(() => {
    if (remainingSeconds === 0 && !timeExpired.current && !isComplete && !isPending) {
      timeExpired.current = true;
      void submit().catch(() => { timeExpired.current = false; });
    }
  }, [remainingSeconds, isComplete, isPending, submit]);

  const clearSession = useCallback(() => {
    try { window.localStorage.removeItem(storageKey); } catch { /* best effort */ }
    setSession(emptySession);
    reset();
    timeExpired.current = false;
  }, [storageKey, reset]);

  return {
    answers: session.answers,
    currentQuestion,
    currentQuestionIndex,
    answeredCount,
    isStarted,
    isComplete,
    result,
    remainingSeconds,
    error,
    isLoading: isPending,
    start,
    chooseAnswer,
    goToQuestion,
    submit,
    clearSession,
  };
}
