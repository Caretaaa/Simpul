import { ArrowDown, ArrowUp, ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import type { ExamResultRecord, ExamType } from "../types";

interface ExamResultProps {
  examType: ExamType;
  result: ExamResultRecord;
  pretestResult?: ExamResultRecord | null;
  courseId: string;
}

export function ExamResult({ examType, result, pretestResult, courseId }: ExamResultProps) {
  const difference = pretestResult ? result.score - pretestResult.score : null;
  return (
    <section className="mx-auto max-w-2xl text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-orange-100 text-orange-700">
        <CheckCircle2 size={32} aria-hidden />
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Ujian selesai</p>
      <h2 className="mt-2 font-display text-3xl font-bold">Bagus, kamu sudah menyelesaikannya.</h2>
      <p className="mt-2 text-stone-600">Hasil ini tersimpan di perangkat yang kamu gunakan.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {examType === "posttest" && (
          <ScoreCard label="Skor Pretest" score={pretestResult?.score ?? null} caption="Sebelum mempelajari materi" />
        )}
        <ScoreCard label={examType === "posttest" ? "Skor Posttest" : "Skor Pretest"} score={result.score} caption={`${result.correctCount} dari ${result.totalQuestions} jawaban benar`} />
      </div>
      {difference !== null && (
        <div className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${difference >= 0 ? "bg-green-50 text-green-800" : "bg-orange-50 text-orange-800"}`}>
          {difference >= 0 ? <ArrowUp size={16} aria-hidden /> : <ArrowDown size={16} aria-hidden />}
          {difference >= 0 ? "+" : ""}{difference} poin dari Pretest
        </div>
      )}

      {result.weakTopics.length > 0 ? (
        <div className="mt-7 rounded-2xl border border-stone-200 bg-white p-5 text-left">
          <h3 className="font-semibold">Materi yang perlu diulang</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {result.weakTopics.map((topic) => <li key={topic} className="rounded-full bg-stone-100 px-3 py-1.5 text-sm text-stone-700">{topic}</li>)}
          </ul>
        </div>
      ) : (
        <p className="mt-6 rounded-2xl bg-green-50 p-4 text-sm font-medium text-green-800">Semua jawaban benar. Pertahankan pemahamanmu!</p>
      )}

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        {result.weakTopics.length > 0 && (
          <Link to={`/student/courses/${courseId}?review=weak#materials`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 font-semibold text-white hover:bg-orange-600">
            <RotateCcw size={16} aria-hidden /> Ulangi Materi yang Lemah
          </Link>
        )}
        <Link to="/student/dashboard" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-5 font-semibold text-stone-800 hover:bg-stone-50">
          Kembali ke Dasbor <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </section>
  );
}

function ScoreCard({ label, score, caption }: { label: string; score: number | null; caption: string }) {
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5">
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className="mt-2 font-display text-5xl font-bold text-stone-900">{score === null ? "—" : score}<span className="text-2xl text-stone-400">{score === null ? "" : "/100"}</span></p>
      <p className="mt-2 text-sm text-stone-500">{score === null ? "Belum ada hasil pretest" : caption}</p>
    </article>
  );
}
