import { CheckCircle2, ClipboardCheck, LockKeyhole } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuth } from "../auth/AuthContext";
import { getDemoExam } from "./data/demoExams";
import { ExamLayout } from "./components/ExamLayout";
import { ExamResult } from "./components/ExamResult";
import { ExamSession } from "./components/ExamSession";
import { useExamSession } from "./hooks/useExamSession";
import { hasCompletedPretest, readExamRecord, type ExamType } from "./types";

interface CourseWire {
  course: { id: string; title: string };
  modules: Array<{ lessons: Array<{ id: string }> }>;
  progress?: { completed: string[] };
}

export default function StudentExamPage() {
  const { courseId = "", examType: rawType = "" } = useParams();
  const { user } = useAuth();
  const examType: ExamType | null = rawType === "pretest" || rawType === "posttest" ? rawType : null;
  const courseQ = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => api.get<CourseWire>(`/courses/${courseId}`),
    enabled: Boolean(courseId && examType),
  });
  const pretestDone = user && courseId ? hasCompletedPretest(user.id, courseId) : false;
  const lessons = courseQ.data?.modules.flatMap((module) => module.lessons) ?? [];
  const completed = new Set(courseQ.data?.progress?.completed ?? []);
  const courseComplete = lessons.length > 0 && lessons.every((lesson) => completed.has(lesson.id));

  if (!examType) return <Navigate to="/student/courses" replace />;
  if (courseQ.isLoading) {
    return <ExamLayout title="Memuat ujian" courseTitle="SIMPUL"><div className="rounded-2xl bg-white p-6 text-stone-600">Menyiapkan halaman ujian…</div></ExamLayout>;
  }
  if (courseQ.isError || !courseQ.data) {
    return <ExamLayout title="Ujian tidak tersedia" courseTitle="SIMPUL"><div className="rounded-2xl border border-stone-200 bg-white p-6"><p role="alert">Kursus belum bisa dimuat. Periksa koneksi lalu coba lagi.</p><Link className="mt-4 inline-block font-semibold text-orange-700" to="/student/courses">Kembali ke kursus</Link></div></ExamLayout>;
  }

  if (examType === "posttest" && !courseComplete) {
    return (
      <ExamLayout title="Posttest terkunci" courseTitle={courseQ.data.course.title}>
        <GateNotice icon="lock" title="Selesaikan semua materi terlebih dahulu" body={`Progres materi saat ini ${completed.size} dari ${lessons.length}. Posttest terbuka setelah progres mencapai 100%.`} courseId={courseId} />
      </ExamLayout>
    );
  }
  if (examType === "posttest" && !pretestDone) {
    return (
      <ExamLayout title="Posttest terkunci" courseTitle={courseQ.data.course.title}>
        <GateNotice icon="check" title="Selesaikan Pretest terlebih dahulu" body="Pretest diperlukan untuk membandingkan pemahaman awal dan hasil belajarmu." courseId={courseId} />
      </ExamLayout>
    );
  }

  return (
    <ExamRunner
      courseId={courseId}
      courseTitle={courseQ.data.course.title}
      examType={examType}
      userId={user?.id ?? "anonymous"}
    />
  );
}

function GateNotice({ icon, title, body, courseId }: { icon: "lock" | "check"; title: string; body: string; courseId: string }) {
  const Icon = icon === "lock" ? LockKeyhole : CheckCircle2;
  return (
    <section className="mx-auto max-w-xl rounded-3xl border border-stone-200 bg-white p-7 text-center shadow-sm">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-orange-100 text-orange-700"><Icon aria-hidden /></div>
      <h2 className="mt-4 font-display text-2xl font-bold">{title}</h2>
      <p className="mt-2 text-stone-600">{body}</p>
      <Link to={`/student/courses/${courseId}`} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-orange-500 px-5 font-semibold text-white hover:bg-orange-600">Kembali ke materi</Link>
    </section>
  );
}

function ExamRunner({ courseId, courseTitle, examType, userId }: { courseId: string; courseTitle: string; examType: ExamType; userId: string }) {
  const exam = getDemoExam(courseId, examType);
  const session = useExamSession({ exam, courseId, examType, userId });
  const pretestResult = readExamRecord(userId, courseId, "pretest")?.result ?? null;
  const progress = Math.round((session.answeredCount / exam.questions.length) * 100);
  const timeLabel = session.remainingSeconds === null
    ? null
    : `${String(Math.floor(session.remainingSeconds / 60)).padStart(2, "0")}:${String(session.remainingSeconds % 60).padStart(2, "0")}`;

  if (session.isComplete && session.result) {
    return (
      <ExamLayout title={exam.title} courseTitle={courseTitle}>
        <ExamResult examType={examType} result={session.result} pretestResult={pretestResult} courseId={courseId} />
      </ExamLayout>
    );
  }

  if (!session.isStarted) {
    return (
      <ExamLayout title={exam.title} courseTitle={courseTitle}>
        <section className="mx-auto max-w-xl rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-orange-700"><ClipboardCheck aria-hidden /></div>
          <h2 className="mt-5 font-display text-2xl font-bold">Siap mulai?</h2>
          <p className="mt-2 leading-relaxed text-stone-600">{exam.description}</p>
          <ul className="mt-5 space-y-2 text-sm text-stone-600">
            <li>• {exam.questions.length} soal pilihan ganda</li>
            {exam.durationSeconds && <li>• Waktu {Math.ceil(exam.durationSeconds / 60)} menit</li>}
            <li>• Jawaban disimpan otomatis di perangkat ini</li>
          </ul>
          <button type="button" onClick={session.start} className="mt-7 min-h-12 w-full rounded-xl bg-orange-500 px-5 font-semibold text-white hover:bg-orange-600">Mulai ujian</button>
        </section>
      </ExamLayout>
    );
  }

  return (
    <ExamLayout title={exam.title} courseTitle={courseTitle} progress={progress} timeLabel={timeLabel}>
      <ExamSession
        exam={exam}
        currentQuestionIndex={session.currentQuestionIndex}
        answers={session.answers}
        answeredCount={session.answeredCount}
        isLoading={session.isLoading}
        error={session.error}
        onChoose={session.chooseAnswer}
        onNavigate={session.goToQuestion}
        onSubmit={() => { void session.submit().catch(() => undefined); }}
      />
    </ExamLayout>
  );
}

export function StudentExamPageFallback() {
  return <div className="min-h-screen bg-[#FDFBF7] p-8 text-stone-600" role="status">Memuat modul ujian…</div>;
}
