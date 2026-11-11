/**
 * Primitif pengalaman belajar: bilah progres, penanda status materi,
 * dan utilitas bacaan. Semua angka berasal dari data nyata pemakaian.
 */

/** Bilah progres dengan label aksesibel. */
export function ProgressBar({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="tech-no">{label}</p>
        <p className="font-mono2 text-xs" style={{ color: "var(--muted)" }} aria-live="polite">
          {value}/{total} · {pct}%
        </p>
      </div>
      <div
        className="mt-1.5 h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--paper)" }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="h-full transition-quiet progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Titik status materi pada jalur belajar: selesai / berjalan / terkunci. */
export function LessonStatusDot({ state, index }: { state: "done" | "current" | "todo"; index: number }) {
  if (state === "done") {
    return (
      <span aria-hidden className="lesson-dot lesson-dot-done" role="presentation">
        ✓
      </span>
    );
  }
  if (state === "current") {
    return (
      <span aria-hidden className="lesson-dot lesson-dot-current font-mono2" role="presentation">
        {String(index + 1).padStart(2, "0")}
      </span>
    );
  }
  return (
    <span aria-hidden className="lesson-dot lesson-dot-todo font-mono2" role="presentation">
      {String(index + 1).padStart(2, "0")}
    </span>
  );
}

/** Estimasi waktu baca dari jumlah kata (200 kata/menit, minimal 1 menit). */
export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Slug jangkar stabil untuk judul heading. */
export function slugify(text: string, fallback: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F\u1E00-\u1EFF\s-]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return slug.length > 0 ? slug : fallback;
}
