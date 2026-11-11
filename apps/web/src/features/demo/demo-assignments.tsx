import { useState, type ChangeEvent } from "react";
import { CalendarClock, FileCheck2, Paperclip, Upload, X } from "lucide-react";
import { Breadcrumbs, PageHeader } from "../../components/design-system/primitives";
import { useI18n } from "../../lib/I18nContext";
import {
  DEMO_ASSIGNMENTS,
  demoSubmitKey,
  pickText,
  readJSON,
  writeJSON,
  type DemoAssignment,
  type DemoSubmitRecord,
} from "../../lib/demo";
import { DemoBanner, DemoPill, dueStateOf } from "./demo-ui";

/** Metadata kiriman demo — isi berkas TIDAK disimpan, hanya nama/ukuran/waktu. */
function asRecord(v: unknown): DemoSubmitRecord | null {
  if (v && typeof v === "object" && "fileName" in v && "sizeBytes" in v && "submittedAt" in v) {
    return v as DemoSubmitRecord;
  }
  return null;
}

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

const up = (ext: string) => ext.toUpperCase();

/**
 * Halaman Tugas (DEMO) — tiga tugas contoh dengan tenggat relatif.
 * Pengumpulan: pilih berkas → divalidasi terhadap format & ukuran yang
 * "diizinkan guru" (per tugas, dari data demo) → status tersimpan di
 * localStorage perangkat ini (demo), bukan server.
 */
export function DemoAssignmentsPage() {
  const { t } = useI18n();
  const [records, setRecords] = useState<Record<string, DemoSubmitRecord | null>>(() => {
    const out: Record<string, DemoSubmitRecord | null> = {};
    for (const a of DEMO_ASSIGNMENTS) out[a.id] = asRecord(readJSON<unknown>(demoSubmitKey(a.id), null));
    return out;
  });

  function submit(id: string, rec: DemoSubmitRecord) {
    setRecords((s) => ({ ...s, [id]: rec }));
    writeJSON(demoSubmitKey(id), rec);
  }

  function undo(id: string) {
    setRecords((s) => ({ ...s, [id]: null }));
    writeJSON(demoSubmitKey(id), null);
  }

  return (
    <div className="max-w-4xl">
      <Breadcrumbs items={[{ label: t("nav.dashboard"), to: "/student/dashboard" }, { label: t("placeholders.assignmentTitle") }]} />
      <PageHeader no="STD-ASG" title={t("placeholders.assignmentTitle")} subtitle={t("demo.subtitleAssignments")} />
      <DemoBanner />
      <div className="space-y-5">
        {DEMO_ASSIGNMENTS.map((a) => (
          <AssignmentCard
            key={a.id}
            a={a}
            record={records[a.id] ?? null}
            onSubmit={(rec) => submit(a.id, rec)}
            onUndo={() => undo(a.id)}
          />
        ))}
      </div>
    </div>
  );
}

function AssignmentCard({
  a,
  record,
  onSubmit,
  onUndo,
}: {
  a: DemoAssignment;
  record: DemoSubmitRecord | null;
  onSubmit: (rec: DemoSubmitRecord) => void;
  onUndo: () => void;
}) {
  const { t, lang, formatDate } = useI18n();
  const due = dueStateOf(a.dueAt);
  const [picked, setPicked] = useState<{ name: string; sizeBytes: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accept = a.allowedTypes.map((x) => `.${x}`).join(",");

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!a.allowedTypes.includes(ext)) {
      setError(`${t("demo.wrongType")} ${a.allowedTypes.map(up).join(", ")}`);
      setPicked(null);
      return;
    }
    if (f.size > a.maxFileMB * 1024 * 1024) {
      setError(`${t("demo.tooBig")} (maks ${a.maxFileMB} MB)`);
      setPicked(null);
      return;
    }
    setError(null);
    setPicked({ name: f.name, sizeBytes: f.size });
  }

  function submitPicked() {
    if (!picked) return;
    onSubmit({ fileName: picked.name, sizeBytes: picked.sizeBytes, submittedAt: new Date().toISOString() });
    setPicked(null);
  }

  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="tech-no">{a.code} · {a.points} {t("demo.pointsUnit")}</p>
        <div className="flex items-center gap-2">
          {record && <DemoPill tone="ok">{t("demo.submitted")}</DemoPill>}
          <DemoPill tone={due === "overdue" ? "danger" : due === "dueSoon" ? "warn" : "neutral"}>
            {due === "overdue" ? t("demo.overdue") : due === "dueSoon" ? t("demo.dueSoon") : t("demo.dueLater")}
          </DemoPill>
        </div>
      </div>
      <h2 className="font-display text-lg font-bold mt-2">{pickText(a.title, lang)}</h2>
      <p className="text-[13px] mt-0.5" style={{ color: "var(--muted)" }}>
        {pickText(a.course, lang)} · {pickText(a.kind, lang)}
      </p>
      <p className="text-[13px] mt-2 inline-flex items-center gap-1.5">
        <CalendarClock size={14} aria-hidden />
        {t("demo.dueAt")}: {formatDate(a.dueAt, true)}
      </p>

      <div className="mt-3 pt-3 border-t rule-line">
        <p className="tech-no mb-1.5">{t("demo.instructions")}</p>
        <ol className="space-y-1 text-sm list-decimal pl-5">
          {a.instructions.map((ins, i) => (
            <li key={i}>{pickText(ins, lang)}</li>
          ))}
        </ol>
      </div>

      <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
        {t("demo.rubric")}: {a.rubric.map((r) => `${pickText(r.aspect, lang)} ${r.weight}%`).join(" · ")}
      </p>

      {a.attachments.length > 0 && (
        <div className="mt-3">
          <p className="tech-no mb-1.5">{t("demo.attachments")}</p>
          <ul className="flex flex-wrap gap-2">
            {a.attachments.map((name) => (
              <li
                key={name}
                className="font-mono2 text-xs px-2 py-1 rounded border rule-line inline-flex items-center gap-1.5"
                style={{ background: "var(--paper)" }}
              >
                <Paperclip size={12} aria-hidden /> {name}
              </li>
            ))}
          </ul>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{t("demo.attachmentsNote")}</p>
        </div>
      )}

      <div className="mt-4 pt-3 border-t rule-line">
        <p className="tech-no mb-2">{t("demo.submissionTitle")}</p>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {t("demo.allowedFormats")}: {a.allowedTypes.map(up).join(", ")} · {t("demo.maxSize")}: {a.maxFileMB} MB
        </p>

        {picked ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span
              className="font-mono2 text-xs px-2 py-1 rounded border rule-line inline-flex items-center gap-1.5"
              style={{ background: "var(--paper)" }}
            >
              {picked.name} · {fmtSize(picked.sizeBytes)}
              <button
                type="button"
                className="btn-ghost !px-1 !py-0.5"
                onClick={() => setPicked(null)}
                aria-label={t("demo.removeFile")}
              >
                <X size={12} aria-hidden />
              </button>
            </span>
            <label className="btn-ghost text-sm cursor-pointer inline-flex items-center gap-2">
              <Upload size={14} aria-hidden />
              {t("demo.changeFile")}
              <input type="file" className="sr-only" accept={accept} onChange={onPick} />
            </label>
            <button type="button" className="btn-primary text-sm" onClick={submitPicked}>
              {t("demo.submitFile")}
            </button>
          </div>
        ) : record ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <FileCheck2 size={16} aria-hidden style={{ color: "var(--ok)" }} />
              {record.fileName} · {fmtSize(record.sizeBytes)}
            </span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{formatDate(record.submittedAt, true)}</span>
            <label className="btn-ghost text-xs cursor-pointer inline-flex items-center gap-1.5">
              <Upload size={13} aria-hidden />
              {t("demo.changeFile")}
              <input type="file" className="sr-only" accept={accept} onChange={onPick} />
            </label>
            <button type="button" className="btn-ghost text-xs" onClick={onUndo}>
              {t("demo.unmarkSubmitted")}
            </button>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="btn-ghost text-sm cursor-pointer inline-flex items-center gap-2">
              <Upload size={14} aria-hidden />
              {t("demo.chooseFile")}
              <input type="file" className="sr-only" accept={accept} onChange={onPick} />
            </label>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{t("demo.notSubmitted")}</span>
          </div>
        )}

        {error && <p role="alert" className="text-sm mt-2" style={{ color: "var(--danger)" }}>{error}</p>}
        <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
          {t("demo.uploadNote")} {t("demo.submitNote")}
        </p>
      </div>
    </article>
  );
}
