import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Clock, FlaskConical, Info, ListChecks, Target } from "lucide-react";
import {
  Breadcrumbs,
  CommandBlock,
  EmptyState,
  PageHeader,
  SectionHead,
} from "../../components/design-system/primitives";
import { useI18n } from "../../lib/I18nContext";
import { DEMO_LABS, demoCheckKey, pickText, readJSON, writeJSON, type DemoLab } from "../../lib/demo";
import { DemoBanner, DemoPill } from "./demo-ui";

/**
 * Halaman Lab (DEMO) — daftar lab praktikum contoh.
 * Konten dari lib/demo.ts; badge demo menegaskan ini bukan lab kelas asli.
 */
export function DemoLabsPage() {
  const { t } = useI18n();
  return (
    <div className="max-w-4xl">
      <Breadcrumbs items={[{ label: t("nav.dashboard"), to: "/student/dashboard" }, { label: t("placeholders.labTitle") }]} />
      <PageHeader no="STD-LAB" title={t("placeholders.labTitle")} subtitle={t("demo.subtitleLabs")} />
      <DemoBanner />
      <div className="grid md:grid-cols-2 gap-5">
        {DEMO_LABS.map((lab) => (
          <LabCard key={lab.id} lab={lab} />
        ))}
      </div>
    </div>
  );
}

function LabCard({ lab }: { lab: DemoLab }) {
  const { t, lang } = useI18n();
  return (
    <article className="card p-5 flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <p className="tech-no">{lab.code}</p>
        <DemoPill tone="neutral">{pickText(lab.level, lang)}</DemoPill>
      </div>
      <h2 className="font-display text-lg font-bold mt-2 leading-snug">{pickText(lab.title, lang)}</h2>
      <p className="text-[13px] mt-0.5" style={{ color: "var(--muted)" }}>{pickText(lab.course, lang)}</p>
      <ul className="mt-3 space-y-1.5 text-sm" style={{ color: "var(--muted)" }}>
        {lab.objectives.slice(0, 2).map((o, i) => (
          <li key={i} className="flex gap-2">
            <Target size={14} aria-hidden className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
            <span className="line-clamp-2">{pickText(o, lang)}</span>
          </li>
        ))}
      </ul>
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mt-3 pt-3 border-t rule-line"
        style={{ color: "var(--muted)" }}
      >
        <span className="inline-flex items-center gap-1">
          <Clock size={13} aria-hidden /> {lab.durationMinutes} {t("demo.durationMin")}
        </span>
        <span className="inline-flex items-center gap-1">
          <ListChecks size={13} aria-hidden /> {lab.checklist.length} {t("demo.checklist").toLowerCase()}
        </span>
        <span className="inline-flex items-center gap-1">
          <FlaskConical size={13} aria-hidden /> {lab.steps.length} {t("demo.steps").toLowerCase()}
        </span>
      </div>
      <div className="mt-4">
        <Link to={`/student/labs/${lab.id}`} className="btn-primary text-sm">
          {t("demo.openLab")} →
        </Link>
      </div>
    </article>
  );
}

/**
 * Detail lab demo — tujuan, skenario, perangkat, langkah + blok perintah,
 * rubrik, dan checklist interaktif (tersimpan di localStorage perangkat).
 */
export function DemoLabDetailPage() {
  const { t, lang } = useI18n();
  const { labId } = useParams<{ labId: string }>();
  const storageKey = demoCheckKey(labId ?? "");
  const [checked, setChecked] = useState<number[]>(() => readJSON<number[]>(storageKey, []));

  function toggle(i: number) {
    const next = checked.includes(i) ? checked.filter((c) => c !== i) : [...checked, i];
    setChecked(next);
    writeJSON(storageKey, next);
  }

  function resetChecklist() {
    if (!window.confirm(t("demo.checklistResetConfirm"))) return;
    setChecked([]);
    writeJSON(storageKey, []);
  }

  const lab = DEMO_LABS.find((l) => l.id === labId);
  if (!lab) {
    return (
      <div className="max-w-2xl">
        <EmptyState
          title={t("demo.labNotFound")}
          body={t("demo.labNotFoundBody")}
          action={<Link to="/student/labs" className="btn-ghost text-sm">{t("demo.backToLabs")}</Link>}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <Breadcrumbs
        items={[
          { label: t("nav.dashboard"), to: "/student/dashboard" },
          { label: t("placeholders.labTitle"), to: "/student/labs" },
          { label: pickText(lab.title, lang) },
        ]}
      />
      <PageHeader
        no={lab.code}
        title={pickText(lab.title, lang)}
        subtitle={`${pickText(lab.course, lang)} · ${pickText(lab.level, lang)} · ${lab.durationMinutes} ${t("demo.durationMin")}`}
      />
      <DemoBanner />

      <div className="grid lg:grid-cols-[1fr_280px] gap-8 items-start">
        <div className="max-w-3xl min-w-0">
          <section className="mb-6">
            <SectionHead title={t("demo.objectives")} />
            <ol className="space-y-1.5 text-sm list-decimal pl-5">
              {lab.objectives.map((o, i) => (
                <li key={i}>{pickText(o, lang)}</li>
              ))}
            </ol>
          </section>

          <section className="mb-6">
            <SectionHead title={t("demo.scenario")} />
            <p className="text-sm card p-4">{pickText(lab.scenario, lang)}</p>
          </section>

          <section className="mb-6">
            <SectionHead title={t("demo.devices")} />
            <ul className="card overflow-hidden">
              {lab.devices.map((d, i) => (
                <li
                  key={i}
                  className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm ${i > 0 ? "border-t rule-line" : ""}`}
                >
                  <span className="font-medium">{pickText(d.name, lang)}</span>
                  <code className="font-mono2 text-xs" style={{ color: "var(--muted)" }}>{d.detail}</code>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-6">
            <SectionHead title={t("demo.steps")} />
            <ol className="space-y-4">
              {lab.steps.map((s, i) => (
                <li key={i} className="card p-4">
                  <p className="font-semibold text-sm">
                    {t("demo.stepWord")} {i + 1} — {pickText(s.title, lang)}
                  </p>
                  <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{pickText(s.detail, lang)}</p>
                  {s.commands && s.commands.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {s.commands.map((c, ci) => (
                        <CommandBlock key={ci} command={c} />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>

          <section className="mb-6">
            <SectionHead title={t("demo.rubric")} />
            <ul className="card overflow-hidden">
              {lab.rubric.map((r, i) => (
                <li
                  key={i}
                  className={`px-4 py-3 text-sm flex flex-wrap items-baseline gap-x-3 gap-y-1 ${i > 0 ? "border-t rule-line" : ""}`}
                >
                  <span className="font-medium">{pickText(r.aspect, lang)}</span>
                  <span className="font-mono2 text-xs" style={{ color: "var(--accent)" }}>{r.weight}%</span>
                  <span className="text-[13px] basis-full sm:basis-auto" style={{ color: "var(--muted)" }}>
                    {pickText(r.excellent, lang)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <p className="text-[13px] flex gap-2 max-w-2xl" style={{ color: "var(--muted)" }}>
            <Info size={14} aria-hidden className="mt-0.5 shrink-0" />
            {t("demo.evidenceNote")}
          </p>
        </div>

        <aside className="lg:sticky lg:top-20">
          <div className="card p-4">
            <p className="tech-no">{t("demo.checklist")}</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }} aria-live="polite">
              {checked.length}/{lab.checklist.length} {t("demo.checklistProgress")}
            </p>
            <ul className="mt-3 space-y-2">
              {lab.checklist.map((c, i) => (
                <li key={i}>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-[var(--accent)]"
                      checked={checked.includes(i)}
                      onChange={() => toggle(i)}
                    />
                    <span>{pickText(c, lang)}</span>
                  </label>
                </li>
              ))}
            </ul>
            <button type="button" className="btn-ghost text-xs mt-3" onClick={resetChecklist}>
              {t("demo.checklistReset")}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
