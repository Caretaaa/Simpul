import type { ReactNode } from "react";
import { ArrowLeft, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";

interface ExamLayoutProps {
  title: string;
  courseTitle: string;
  progress?: number;
  timeLabel?: string | null;
  children: ReactNode;
}

/** Layout mandiri: route ujian ditempatkan di luar AppShell agar sidebar tidak ikut ter-render. */
export function ExamLayout({ title, courseTitle, progress, timeLabel, children }: ExamLayoutProps) {
  return (
    <main className="min-h-screen bg-[#FDFBF7] text-stone-900">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-[#FDFBF7]/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4 sm:px-6">
          <Link to="/student/courses" className="rounded-xl p-2 text-stone-600 hover:bg-stone-100" aria-label="Kembali ke kursus">
            <ArrowLeft size={20} aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium uppercase tracking-[0.16em] text-stone-500">{courseTitle}</p>
            <h1 className="truncate font-semibold">{title}</h1>
          </div>
          {timeLabel && (
            <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-medium text-stone-700 ring-1 ring-stone-200" aria-live="polite">
              <Clock3 size={15} aria-hidden /> {timeLabel}
            </div>
          )}
        </div>
        {typeof progress === "number" && (
          <div className="h-1.5 w-full bg-stone-200" role="progressbar" aria-label="Progres ujian" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <div className="h-full bg-orange-500 transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
        )}
      </header>
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">{children}</div>
    </main>
  );
}
