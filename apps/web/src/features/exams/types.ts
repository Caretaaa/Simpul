export type ExamType = "pretest" | "posttest";

export interface ExamQuestion {
  id: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  topic: string;
}

export interface ExamDefinition {
  id: string;
  title: string;
  description: string;
  questions: ExamQuestion[];
  durationSeconds?: number;
}

export interface ExamResultRecord {
  examType: ExamType;
  score: number;
  correctCount: number;
  totalQuestions: number;
  weakTopics: string[];
  completedAt: string;
}

export interface ExamSessionRecord {
  answers: Record<string, number>;
  currentQuestionIndex: number;
  startedAt: number | null;
  result: ExamResultRecord | null;
}

export function examStorageKey(userId: string, courseId: string, examType: ExamType): string {
  return `simpul:exam:${userId}:${courseId}:${examType}`;
}

export function readExamRecord(userId: string, courseId: string, examType: ExamType): ExamSessionRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(examStorageKey(userId, courseId, examType));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as Partial<ExamSessionRecord>;
    if (typeof value.answers !== "object" || value.answers === null) return null;
    return {
      answers: value.answers as Record<string, number>,
      currentQuestionIndex: Number.isInteger(value.currentQuestionIndex) ? value.currentQuestionIndex! : 0,
      startedAt: typeof value.startedAt === "number" ? value.startedAt : null,
      result: value.result ?? null,
    };
  } catch {
    return null;
  }
}

export function hasCompletedPretest(userId: string, courseId: string): boolean {
  return readExamRecord(userId, courseId, "pretest")?.result !== null &&
    readExamRecord(userId, courseId, "pretest")?.result !== undefined;
}
