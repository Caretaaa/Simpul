import { ArrowLeft, ArrowRight, Check, CircleHelp, Send } from "lucide-react";
import type { ExamDefinition } from "../types";

interface ExamSessionProps {
  exam: ExamDefinition;
  currentQuestionIndex: number;
  answers: Record<string, number>;
  answeredCount: number;
  isLoading: boolean;
  error: Error | null;
  onChoose: (questionId: string, optionIndex: number) => void;
  onNavigate: (index: number) => void;
  onSubmit: () => void;
}

export function ExamSession({
  exam,
  currentQuestionIndex,
  answers,
  answeredCount,
  isLoading,
  error,
  onChoose,
  onNavigate,
  onSubmit,
}: ExamSessionProps) {
  const question = exam.questions[currentQuestionIndex];
  if (!question) return null;
  const isLast = currentQuestionIndex === exam.questions.length - 1;

  return (
    <section className="mx-auto max-w-2xl" aria-label="Pengerjaan ujian">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-orange-700">Soal {currentQuestionIndex + 1} dari {exam.questions.length}</p>
          <p className="mt-1 text-xs text-stone-500">Jawaban tersimpan otomatis di perangkat ini</p>
        </div>
        <div className="flex gap-1.5" aria-label="Navigasi soal">
          {exam.questions.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(index)}
              className={`grid h-9 w-9 place-items-center rounded-lg text-xs font-semibold transition ${
                index === currentQuestionIndex ? "bg-orange-500 text-white" : answers[item.id] !== undefined ? "bg-orange-100 text-orange-800" : "bg-white text-stone-500 ring-1 ring-stone-200"
              }`}
              aria-label={`Buka soal ${index + 1}${answers[item.id] !== undefined ? ", sudah dijawab" : ", belum dijawab"}`}
              aria-current={index === currentQuestionIndex ? "step" : undefined}
            >
              {answers[item.id] !== undefined ? <Check size={15} aria-hidden /> : index + 1}
            </button>
          ))}
        </div>
      </div>

      <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-5 flex items-center gap-2 text-sm text-stone-500">
          <CircleHelp size={17} aria-hidden /> {question.topic}
        </div>
        <h2 className="font-display text-xl font-bold leading-snug sm:text-2xl">{question.prompt}</h2>
        <fieldset className="mt-7 space-y-3">
          <legend className="sr-only">Pilih satu jawaban</legend>
          {question.options.map((option, index) => {
            const selected = answers[question.id] === index;
            return (
              <label
                key={option}
                className={`flex min-h-16 cursor-pointer items-center gap-4 rounded-2xl border p-4 transition focus-within:ring-2 focus-within:ring-orange-500 ${
                  selected ? "border-orange-500 bg-orange-50 ring-2 ring-orange-500" : "border-stone-200 bg-white hover:border-stone-400"
                }`}
              >
                <input
                  type="radio"
                  name={`answer-${question.id}`}
                  value={index}
                  checked={selected}
                  onChange={() => onChoose(question.id, index)}
                  className="sr-only"
                />
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${selected ? "bg-orange-500 text-white" : "bg-stone-100 text-stone-600"}`}>
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="text-[15px] leading-relaxed">{option}</span>
              </label>
            );
          })}
        </fieldset>
      </article>

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error.message || "Jawaban belum berhasil dikirim. Coba lagi."}</p>}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onNavigate(currentQuestionIndex - 1)}
          disabled={currentQuestionIndex === 0 || isLoading}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl px-4 font-semibold text-stone-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft size={17} aria-hidden /> Sebelumnya
        </button>
        {isLast ? (
          <button
            type="button"
            onClick={onSubmit}
            disabled={isLoading || answeredCount < exam.questions.length}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-orange-500 px-5 font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Mengirim…" : "Kumpulkan ujian"} <Send size={16} aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate(currentQuestionIndex + 1)}
            disabled={isLoading}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-orange-500 px-5 font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
          >
            Soal berikutnya <ArrowRight size={17} aria-hidden />
          </button>
        )}
      </div>
      <p className="mt-3 text-right text-xs text-stone-500">{answeredCount}/{exam.questions.length} soal dijawab</p>
    </section>
  );
}
