import type { ReactNode } from "react";
import { useI18n } from "../../lib/I18nContext";

/**
 * Pita peringatan demo — tampil di atas setiap halaman demo.
 * Kejujuran pertama: pengguna harus tahu ini konten contoh, bukan data sekolah.
 */
export function DemoBanner() {
  const { t } = useI18n();
  return (
    <div className="card demo-banner p-4 mb-6" role="note">
      <p className="flex items-center gap-2 flex-wrap">
        <span className="demo-badge">{t("demo.badge")}</span>
        <span className="text-sm font-semibold">{t("demo.demoBanner")}</span>
      </p>
      <p className="text-[13px] mt-1.5" style={{ color: "var(--muted)" }}>{t("demo.demoNote")}</p>
      <p className="text-[13px] mt-0.5" style={{ color: "var(--muted)" }}>{t("demo.deviceNote")}</p>
      <p className="text-[13px] mt-0.5" style={{ color: "var(--muted)" }}>{t("demo.phaseNote")}</p>
    </div>
  );
}

export type DemoPillTone = "ok" | "warn" | "danger" | "neutral";

const PILL_COLOR: Record<DemoPillTone, string> = {
  ok: "var(--ok)",
  warn: "var(--warn)",
  danger: "var(--danger)",
  neutral: "var(--muted)",
};

/** Pil status kecil (tenggat, skor) dengan warna semantik token. */
export function DemoPill({ tone, children }: { tone: DemoPillTone; children: ReactNode }) {
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full border rule-line inline-flex items-center gap-1 whitespace-nowrap"
      style={{ color: PILL_COLOR[tone] }}
    >
      {children}
    </span>
  );
}

export type DueState = "overdue" | "dueSoon" | "later";

/** Status tenggat relatif terhadap "sekarang" agar demo selalu relevan. */
export function dueStateOf(dueAt: string, now: Date = new Date()): DueState {
  const diff = new Date(dueAt).getTime() - now.getTime();
  if (diff < 0) return "overdue";
  if (diff <= 48 * 60 * 60 * 1000) return "dueSoon";
  return "later";
}
