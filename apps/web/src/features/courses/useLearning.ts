import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

export interface CourseSummary {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  isEnrolled?: boolean;
  subjectName: string | null;
  className: string | null;
  teacherName: string | null;
}

interface CourseDetailWire {
  course: { id: string; title: string };
  modules: Array<{
    id: string; title: string; position: number;
    lessons: Array<{ id: string; title: string; contentType: string; position: number; isPublished: boolean }>;
  }>;
}

export interface EnrichedCourse extends CourseSummary {
  totalLessons: number;
  completedLessons: number;
  nextLessonId: string | null;
  nextLessonTitle: string | null;
  nextModuleTitle: string | null;
}

export interface ResumeTarget {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  done: number;
  total: number;
}

/**
 * Gambaran belajar siswa dari data nyata: daftar kursus + detail modul/materi
 * + progres penyelesaian. Dipakai dasbor "lanjutkan belajar".
 */
export function useLearningOverview() {
  const coursesQ = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get<{ courses: CourseSummary[] }>("/courses"),
  });
  const enrolled = (coursesQ.data?.courses ?? []).filter((c) => c.isEnrolled);
  const enrolledKey = enrolled.map((c) => c.id).join(",");

  const detailQ = useQuery({
    queryKey: ["learning-overview", enrolledKey],
    enabled: enrolled.length > 0,
    queryFn: async (): Promise<{ enriched: EnrichedCourse[]; resume: ResumeTarget | null; done: number; total: number }> => {
      const [details, progress] = await Promise.all([
        Promise.all(enrolled.map((c) => api.get<CourseDetailWire>(`/courses/${c.id}`))),
        api.get<{ progress: Array<{ lessonId: string; status: string }> }>("/me/progress"),
      ]);
      const completed = new Set(
        progress.progress.filter((p) => p.status === "completed").map((p) => p.lessonId),
      );
      const enriched: EnrichedCourse[] = enrolled.map((c, i) => {
        const detail = details[i]!;
        const ordered = detail.modules
          .slice()
          .sort((a, b) => a.position - b.position)
          .flatMap((m) =>
            m.lessons
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((l) => ({ lesson: l, moduleTitle: m.title })),
          );
        const doneCount = ordered.filter(({ lesson }) => completed.has(lesson.id)).length;
        const next = ordered.find(({ lesson }) => !completed.has(lesson.id)) ?? null;
        return {
          ...c,
          totalLessons: ordered.length,
          completedLessons: doneCount,
          nextLessonId: next?.lesson.id ?? null,
          nextLessonTitle: next?.lesson.title ?? null,
          nextModuleTitle: next?.moduleTitle ?? null,
        };
      });
      let resume: ResumeTarget | null = null;
      for (const e of enriched) {
        if (e.nextLessonId && e.nextLessonTitle && e.nextModuleTitle) {
          resume = {
            courseId: e.id,
            courseTitle: e.title,
            lessonId: e.nextLessonId,
            lessonTitle: e.nextLessonTitle,
            moduleTitle: e.nextModuleTitle,
            done: e.completedLessons,
            total: e.totalLessons,
          };
          break;
        }
      }
      return {
        enriched,
        resume,
        done: enriched.reduce((n, e) => n + e.completedLessons, 0),
        total: enriched.reduce((n, e) => n + e.totalLessons, 0),
      };
    },
  });

  return { coursesQ, detailQ };
}
