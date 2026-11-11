import { useMemo, useState } from "react";
import {
  generateExercise,
  validateAnswer,
  type Difficulty,
  type SubnetAnswer,
  type SubnetExercise,
} from "@simpul/shared";
import {
  Breadcrumbs,
  CIDRBadge,
  IPAddressDisplay,
  PageHeader,
  SectionHead,
} from "../../components/design-system/primitives";
import { useI18n } from "../../lib/I18nContext";
import { demoSubnetKey, readJSON, writeJSON } from "../../lib/demo";
import { DemoBanner, DemoPill } from "./demo-ui";

/**
 * Halaman Latihan Subnetting (DEMO) — memakai mesin soal NYATA dari
 * @simpul/shared (generateExercise + validateAnswer). Riwayat & rentetan
 * disimpan di localStorage perangkat ini.
 */
interface SubnetHistoryEntry {
  ts: string;
  difficulty: Difficulty;
  prefix: number;
  score: number;
  correct: boolean;
}

const FIELD_DEFS: Array<{ key: keyof SubnetAnswer; labelKey: string; ph: string }> = [
  { key: "networkAddress", labelKey: "demo.fNet", ph: "192.168.1.0" },
  { key: "broadcastAddress", labelKey: "demo.fBroadcast", ph: "192.168.1.255" },
  { key: "firstUsableHost", labelKey: "demo.fFirst", ph: "192.168.1.1" },
  { key: "lastUsableHost", labelKey: "demo.fLast", ph: "192.168.1.254" },
  { key: "subnetMask", labelKey: "demo.fMask", ph: "255.255.255.0" },
];

const DIFFICULTIES: Difficulty[] = ["mudah", "sedang", "sukar"];

export function DemoSubnetPage() {
  const { t, lang, formatDate } = useI18n();
  const [difficulty, setDifficulty] = useState<Difficulty>("mudah");
  const [exercise, setExercise] = useState<SubnetExercise>(() => generateExercise("mudah"));
  const [answers, setAnswers] = useState<Partial<Record<keyof SubnetAnswer, string>>>({});
  const [result, setResult] = useState<ReturnType<typeof validateAnswer> | null>(null);
  const [blankError, setBlankError] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [history, setHistory] = useState<SubnetHistoryEntry[]>(() => readJSON<SubnetHistoryEntry[]>(demoSubnetKey(), []));

  const streak = useMemo(() => {
    let s = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const e = history[i];
      if (e && e.correct) s += 1;
      else break;
    }
    return s;
  }, [history]);

  function nextExercise(d: Difficulty) {
    setExercise(generateExercise(d));
    setAnswers({});
    setResult(null);
    setShowSolution(false);
    setBlankError(false);
  }

  function changeDifficulty(d: Difficulty) {
    setDifficulty(d);
    nextExercise(d);
  }

  function check() {
    const answer: SubnetAnswer = {};
    for (const { key } of FIELD_DEFS) {
      const v = answers[key];
      if (v && v.trim() !== "") answer[key] = v.trim();
    }
    if (Object.keys(answer).length === 0) {
      setBlankError(true);
      return;
    }
    setBlankError(false);
    const res = validateAnswer(exercise, answer);
    setResult(res);
    const entry: SubnetHistoryEntry = {
      ts: new Date().toISOString(),
      difficulty,
      prefix: exercise.prefix,
      score: Math.round(res.score * 100),
      correct: res.correct,
    };
    const next = [...history, entry];
    writeJSON(demoSubnetKey(), next);
    setHistory(next);
    setShowSolution(false);
  }

  function clearHistory() {
    if (!window.confirm(t("demo.clearConfirm"))) return;
    writeJSON(demoSubnetKey(), []);
    setHistory([]);
  }

  const diffLabel = (d: Difficulty) =>
    d === "mudah" ? t("demo.diffMudah") : d === "sedang" ? t("demo.diffSedang") : t("demo.diffSukar");

  return (
    <div className="max-w-4xl">
      <Breadcrumbs items={[{ label: t("nav.dashboard"), to: "/student/dashboard" }, { label: t("placeholders.subnetTitle") }]} />
      <PageHeader no="STD-SUB" title={t("placeholders.subnetTitle")} subtitle={t("demo.subtitleSubnet")} />
      <DemoBanner />

      <div className="flex flex-wrap gap-2" role="group" aria-label={t("demo.difficulty")}>
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => changeDifficulty(d)}
            aria-pressed={difficulty === d}
            className={`text-sm px-3 py-1.5 rounded-lg border rule-line transition-quiet ${difficulty === d ? "font-semibold" : ""}`}
            style={{
              background: difficulty === d ? "var(--accent)" : "transparent",
              color: difficulty === d ? "var(--accent-ink)" : "var(--ink)",
            }}
          >
            {diffLabel(d)}
          </button>
        ))}
      </div>

      <div className="card p-5 mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="tech-no">{t("demo.given")}</p>
          <button type="button" className="btn-ghost text-xs" onClick={() => nextExercise(difficulty)}>
            {t("demo.newExercise")}
          </button>
        </div>
        <p className="mt-2 flex items-center gap-2 flex-wrap">
          <IPAddressDisplay ip={exercise.ip} />
          <CIDRBadge prefix={exercise.prefix} />
        </p>

        <div className="mt-4 pt-3 border-t rule-line">
          <p className="tech-no mb-2">{t("demo.answerFields")}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {FIELD_DEFS.map((f) => {
              const state = result?.perField[f.key];
              const color = state === true ? "var(--ok)" : state === false ? "var(--danger)" : undefined;
              return (
                <div key={f.key}>
                  <label htmlFor={`subnet-${f.key}`} className="text-[13px] font-medium block">
                    {t(f.labelKey)}
                  </label>
                  <input
                    id={`subnet-${f.key}`}
                    className="input mt-1 font-mono2 text-sm"
                    style={color ? { borderColor: color } : undefined}
                    aria-invalid={state === false ? true : undefined}
                    value={answers[f.key] ?? ""}
                    onChange={(e) => setAnswers((s) => ({ ...s, [f.key]: e.target.value }))}
                    placeholder={f.ph}
                    autoComplete="off"
                  />
                  {result && state === true && (
                    <p className="text-xs mt-1" style={{ color: "var(--ok)" }}>✓ {t("demo.correct")}</p>
                  )}
                  {result && state === false && (
                    <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>✕ {t("demo.wrong")}</p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs mt-1.5" style={{ color: "var(--muted)" }}>{t("demo.blankNote")}</p>
          {blankError && (
            <p role="alert" className="text-sm mt-1" style={{ color: "var(--danger)" }}>{t("demo.allBlank")}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button type="button" className="btn-primary text-sm" onClick={check}>
              {result ? t("demo.recheck") : t("demo.check")}
            </button>
            <button type="button" className="btn-ghost text-sm" onClick={() => setShowSolution((v) => !v)}>
              {showSolution ? t("demo.hideSolution") : t("demo.showSolution")}
            </button>
            {result && (
              <span aria-live="polite">
                <DemoPill tone={result.correct ? "ok" : "warn"}>
                  {result.correct ? t("demo.allCorrect") : `${t("demo.partial")} ${Math.round(result.score * 100)}%`}
                </DemoPill>
              </span>
            )}
          </div>
        </div>

        {showSolution && (
          <div className="mt-4 pt-3 border-t rule-line">
            <p className="tech-no mb-2">{t("demo.solutionTitle")}</p>
            <dl className="grid sm:grid-cols-2 gap-2 text-sm">
              {FIELD_DEFS.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-2">
                  <dt style={{ color: "var(--muted)" }}>{t(f.labelKey)}</dt>
                  <dd><IPAddressDisplay ip={String(exercise.solution[f.key])} /></dd>
                </div>
              ))}
            </dl>
            <p className="text-[13px] mt-2" style={{ color: "var(--muted)" }}>{t("demo.solutionNote")}</p>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-5 mt-6">
        <div className="card p-5">
          <p className="tech-no">{t("demo.streak")}</p>
          <p className="font-display text-4xl font-bold mt-2">{streak}</p>
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>{t("demo.streakUnit")}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="tech-no">{t("demo.history")}</p>
            {history.length > 0 && (
              <button type="button" className="btn-ghost text-xs" onClick={clearHistory}>
                {t("demo.clearHistory")}
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-[13px] mt-2" style={{ color: "var(--muted)" }}>{t("demo.historyEmpty")}</p>
          ) : (
            <ul className="mt-2 space-y-1.5 max-h-55 overflow-y-auto">
              {[...history].reverse().slice(0, 10).map((e, i) => (
                <li key={`${e.ts}-${i}`} className="flex items-center justify-between gap-2 text-[13px]">
                  <span style={{ color: "var(--muted)" }}>{formatDate(e.ts, true)}</span>
                  <span className="font-mono2 text-xs">/{e.prefix}</span>
                  <span className="font-mono2 text-xs">{e.score}%</span>
                  <DemoPill tone={e.correct ? "ok" : "danger"}>
                    {e.correct ? t("demo.correct") : t("demo.wrong")}
                  </DemoPill>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
