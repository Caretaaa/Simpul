import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Clock, ListChecks, Timer } from "lucide-react";
import { Breadcrumbs, EmptyState, PageHeader, SectionHead } from "../../components/design-system/primitives";
import { useI18n } from "../../lib/I18nContext";
import { DEMO_QUIZZES, demoQuizBestKey, pickText, readJSON, writeJSON, type DemoQuiz } from "../../lib/demo";
import { DemoBanner, DemoPill } from "./demo-ui";

/**
 * Halaman Kuis (DEMO) — daftar kuis contoh.
 * Skor terbaik disimpan di localStorage perangkat ini; tidak ada pengiriman ke server.
 */
export function DemoQuizzesPage() {
  const { t, lang } = useI18n();
  return (
    <div className="max-w-4xl">
      <Breadcrumbs items={[{ label: t("nav.dashboard"), to: "/student/dashboard" }, { label: t("placeholders.quizTitle") }]} />
      <PageHeader no="STD-QUIZ" title={t("placeholders.quizTitle")} subtitle={t("demo.subtitleQuizzes")} />
      <DemoBanner />
      <div className="grid md:grid-cols-2 gap-5">
        {DEMO_QUIZZES.map((q) => (
          <QuizCard key={q.id} quiz={q} />
        ))}
      </div>
    </div>
  );
}

function QuizCard({ quiz }: { quiz: DemoQuiz }) {
  const { t, lang } = useI18n();
  const best = readJSON<number>(demoQuizBestKey(quiz.id), 0);
  return (
    <article className="card p-5 flex flex-col">
      <p className="tech-no">{quiz.code}</p>
      <h2 className="font-display text-lg font-bold mt-2 leading-snug">{pickText(quiz.title, lang)}</h2>
      <p className="text-[13px] mt-0.5" style={{ color: "var(--muted)" }}>{pickText(quiz.course, lang)}</p>
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mt-3 pt-3 border-t rule-line"
        style={{ color: "var(--muted)" }}
      >
        <span className="inline-flex items-center gap-1">
          <Clock size={13} aria-hidden /> {quiz.minutes} {t("demo.durationMin")}
        </span>
        <span className="inline-flex items-center gap-1">
          <ListChecks size={13} aria-hidden /> {quiz.questions.length} {t("demo.questionCount")}
        </span>
        <span>{t("demo.passingScore")}: {quiz.passingScore}</span>
      </div>
      <div className="mt-3">
        {best > 0 ? (
          <DemoPill tone={best >= quiz.passingScore ? "ok" : "warn"}>{t("demo.bestScore")}: {best}</DemoPill>
        ) : (
          <DemoPill tone="neutral">{t("demo.noAttempt")}</DemoPill>
        )}
      </div>
      <div className="mt-4">
        <Link to={`/student/quizzes/${quiz.id}`} className="btn-primary text-sm">
          {t("demo.startQuiz")} →
        </Link>
      </div>
    </article>
  );
}

type QuizPhase = "intro" | "run" | "result";

/**
 * Menjalankan kuis demo: intro → soal per soal dengan pewaktu → hasil + tinjauan.
 * Penilaian murni di browser; hanya skor terbaik yang dipersist.
 */
export function DemoQuizRunnerPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const { t, lang } = useI18n();
  const quiz = DEMO_QUIZZES.find((q) => q.id === quizId);

  const [phase, setPhase] = useState<QuizPhase>("intro");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [autoClosed, setAutoClosed] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [best, setBest] = useState<number>(() => (quiz ? readJSON<number>(demoQuizBestKey(quiz.id), 0) : 0));

  function start() {
    if (!quiz) return;
    setAnswers({});
    setIdx(0);
    setScore(null);
    setAutoClosed(false);
    setTimeLeft(quiz.minutes * 60);
    setPhase("run");
  }

  function finalize(final: Record<number, number>) {
    if (!quiz) return;
    const total = quiz.questions.length;
    let correct = 0;
    quiz.questions.forEach((q, i) => {
      if (final[i] === q.answerIndex) correct += 1;
    });
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const prevBest = readJSON<number>(demoQuizBestKey(quiz.id), 0);
    if (pct > prevBest) writeJSON(demoQuizBestKey(quiz.id), pct);
    setBest(Math.max(prevBest, pct));
    setScore(pct);
    setPhase("result");
  }

  useEffect(() => {
    if (phase !== "run") return;
    const id = window.setInterval(() => setTimeLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === "run" && timeLeft === 0) {
      setAutoClosed(true);
      finalize(answers);
    }
  }, [timeLeft, phase]); // answers sengaja tidak masuk deps — nilai terkini dari render ini

  if (!quiz) {
    return (
      <div className="max-w-2xl">
        <EmptyState
          title={t("demo.quizNotFound")}
          body={t("demo.quizNotFoundBody")}
          action={<Link to="/student/quizzes" className="btn-ghost text-sm">{t("demo.backToQuizzes")}</Link>}
        />
      </div>
    );
  }

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");
  const q = quiz.questions[idx];

  return (
    <div className="max-w-3xl">
      <Breadcrumbs
        items={[
          { label: t("nav.dashboard"), to: "/student/dashboard" },
          { label: t("placeholders.quizTitle"), to: "/student/quizzes" },
          { label: pickText(quiz.title, lang) },
        ]}
      />
      <PageHeader no={quiz.code} title={pickText(quiz.title, lang)} subtitle={pickText(quiz.course, lang)} />
      <DemoBanner />

      {phase === "intro" && (
        <div className="card p-6">
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm" style={{ color: "var(--muted)" }}>
            <li className="inline-flex items-center gap-1.5"><Clock size={14} aria-hidden /> {quiz.minutes} {t("demo.durationMin")}</li>
            <li className="inline-flex items-center gap-1.5"><ListChecks size={14} aria-hidden /> {quiz.questions.length} {t("demo.questionCount")}</li>
            <li>{t("demo.passingScore")}: {quiz.passingScore}</li>
            <li>{t("demo.bestScore")}: {best}</li>
          </ul>
          <p className="text-sm mt-3">{t("demo.quizIntro")}</p>
          <button type="button" className="btn-primary text-sm mt-4" onClick={start}>
            {t("demo.startQuiz")}
          </button>
        </div>
      )}

      {phase === "run" && q && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="tech-no">{t("demo.questionWord")} {idx + 1} / {quiz.questions.length}</p>
            <span className="font-mono2 text-sm inline-flex items-center gap-1.5" style={{ color: "var(--warn)" }}>
              <Timer size={14} aria-hidden /> {mm}:{ss}
            </span>
          </div>
          <fieldset className="card p-5">
            <legend className="sr-only">{t("demo.questionWord")} {idx + 1}</legend>
            <h2 className="font-display text-lg font-semibold leading-snug">{pickText(q.prompt, lang)}</h2>
            <div className="mt-4 space-y-2">
              {q.options.map((opt, oi) => (
                <label
                  key={oi}
                  className="flex items-start gap-3 text-sm p-3 rounded-lg border rule-line cursor-pointer transition-quiet"
                  style={{ background: answers[idx] === oi ? "var(--paper)" : "var(--surface)" }}
                >
                  <input
                    type="radio"
                    name={`demo-q-${idx}`}
                    className="mt-0.5 accent-[var(--accent)]"
                    checked={answers[idx] === oi}
                    onChange={() => setAnswers((s) => ({ ...s, [idx]: oi }))}
                  />
                  <span>{pickText(opt, lang)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            {idx > 0 && (
              <button type="button" className="btn-ghost text-sm" onClick={() => setIdx(idx - 1)}>
                {t("common.back")}
              </button>
            )}
            {idx < quiz.questions.length - 1 ? (
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={answers[idx] === undefined}
                onClick={() => setIdx(idx + 1)}
              >
                {t("demo.next")}
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={answers[idx] === undefined}
                onClick={() => finalize(answers)}
              >
                {t("demo.finish")}
              </button>
            )}
            {answers[idx] === undefined && (
              <span className="text-xs" style={{ color: "var(--muted)" }}>{t("demo.chooseFirst")}</span>
            )}
          </div>
        </div>
      )}

      {phase === "result" && (
        <div>
          {autoClosed && (
            <p className="text-sm mb-3" style={{ color: "var(--warn)" }}>{t("demo.timeUp")}</p>
          )}
          <div className="card p-6 text-center">
            <p className="tech-no">{t("demo.yourScore")}</p>
            <p className="font-display text-5xl font-bold mt-2">{score}%</p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
              {score !== null && score >= quiz.passingScore ? (
                <DemoPill tone="ok">{t("demo.passed")}</DemoPill>
              ) : (
                <DemoPill tone="warn">{t("demo.notPassed")}</DemoPill>
              )}
              <DemoPill tone="neutral">{t("demo.passingScore")}: {quiz.passingScore}</DemoPill>
              <DemoPill tone="neutral">{t("demo.bestScore")}: {best}</DemoPill>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
              <button type="button" className="btn-ghost text-sm" onClick={start}>{t("demo.retake")}</button>
              <Link to="/student/quizzes" className="btn-ghost text-sm">{t("demo.backToQuizzes")}</Link>
            </div>
          </div>

          <section className="mt-6">
            <SectionHead title={t("demo.reviewTitle")} />
            <ol className="space-y-3">
              {quiz.questions.map((qq, i) => {
                const chosen = answers[i];
                const isCorrect = chosen === qq.answerIndex;
                const chosenOption = chosen === undefined ? undefined : qq.options[chosen];
                const chosenText = chosenOption ? pickText(chosenOption, lang) : t("demo.unanswered");
                const correctOption = qq.options[qq.answerIndex];
                const correctText = correctOption ? pickText(correctOption, lang) : "—";
                return (
                  <li key={i} className="card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">
                        {i + 1}. {pickText(qq.prompt, lang)}
                      </p>
                      {chosen === undefined ? (
                        <DemoPill tone="neutral">{t("demo.unanswered")}</DemoPill>
                      ) : isCorrect ? (
                        <DemoPill tone="ok">{t("demo.correct")}</DemoPill>
                      ) : (
                        <DemoPill tone="danger">{t("demo.wrong")}</DemoPill>
                      )}
                    </div>
                    <p className="text-[13px] mt-2" style={{ color: "var(--muted)" }}>
                      {t("demo.yourAnswer")}: {chosenText}
                    </p>
                    <p className="text-[13px]" style={{ color: "var(--ok)" }}>
                      {t("demo.correctAnswer")}: {correctText}
                    </p>
                    <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
                      {pickText(qq.explanation, lang)}
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}
