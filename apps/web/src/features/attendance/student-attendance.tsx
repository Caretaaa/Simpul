import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CalendarDays, Check } from "lucide-react";
import { toDataURL } from "qrcode";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/I18nContext";
import { CopyButton, EmptyState, PageHeader, Skeleton } from "../../components/design-system/primitives";
import {
  sessionDateIso,
  statusColor,
  statusKey,
  type StudentAttendanceCard,
  type StudentAttendanceHistoryRow,
} from "./types";

function CardQr({ payload }: { payload: string }) {
  const { t } = useI18n();
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    toDataURL(payload, { margin: 1, width: 440, errorCorrectionLevel: "M" })
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [payload]);

  if (failed) {
    return (
      <p className="font-mono2 text-sm py-10" role="alert">
        {payload}
      </p>
    );
  }
  if (!src) return <Skeleton className="w-full aspect-square max-w-[240px] mx-auto" label={t("common.loading")} />;
  return (
    <img
      src={src}
      alt={t("attendance.qrAlt")}
      width={240}
      height={240}
      className="block mx-auto max-w-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

function StatusPill({ status }: { status: StudentAttendanceHistoryRow["status"] }) {
  const { t } = useI18n();
  const color = statusColor(status);
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border"
      style={{ color, borderColor: color }}
    >
      {status === "hadir" && <Check size={11} aria-hidden />}
      {t(statusKey(status))}
    </span>
  );
}

/** Kartu absensi siswa (QR untuk dipindai guru) + riwayat kehadiran. */
export function StudentAttendanceCardPage() {
  const { t, formatDate } = useI18n();
  const q = useQuery({
    queryKey: ["attendance-me"],
    queryFn: () =>
      api.get<{ card: StudentAttendanceCard; history: StudentAttendanceHistoryRow[] }>("/attendance/me"),
  });

  if (q.isLoading) {
    return (
      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div>
        <PageHeader no={t("attendance.studentNo")} title={t("attendance.studentTitle")} subtitle={t("attendance.studentSub")} />
        <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
          {t("attendance.historyLoadFail")}
        </p>
      </div>
    );
  }

  const { card, history } = q.data;
  return (
    <div>
      <PageHeader
        no={t("attendance.studentNo")}
        title={t("attendance.studentTitle")}
        subtitle={t("attendance.studentSub")}
      />

      <div className="grid lg:grid-cols-[320px_1fr] gap-6 items-start">
        <section aria-label={t("attendance.studentTitle")}>
          <div className="card overflow-hidden">
            <div className="h-1.5" style={{ background: "var(--accent)" }} aria-hidden />
            <div className="p-5 text-center">
              <p className="tech-no">{t("attendance.cardFooter")}</p>
              <p className="font-display text-xl font-bold mt-1 leading-tight">{card.name}</p>
              <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
                {card.className ?? "—"}
              </p>
              {/* Latar putih tetap agar QR kontras dan mudah dipindai di tema gelap. */}
              <div className="rounded-lg border rule-line p-3" style={{ background: "#ffffff" }}>
                <CardQr payload={card.qrPayload} />
              </div>
              <div className="mt-4 flex items-center justify-center gap-2">
                <span className="tech-no">{t("attendance.codeLabel")}</span>
                <code className="font-mono2 text-base font-semibold tracking-[0.18em]">{card.attendanceCode}</code>
                <CopyButton text={card.attendanceCode} label={t("attendance.copyCode")} />
              </div>
            </div>
          </div>
        </section>

        <section aria-label={t("attendance.historyTitle")}>
          <div className="mb-3">
            <h2 className="font-display text-lg font-semibold">{t("attendance.historyTitle")}</h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {t("attendance.historySub")}
            </p>
          </div>

          {history.length === 0 ? (
            <EmptyState title={t("attendance.historyEmpty")} body={t("attendance.historyEmptyBody")} />
          ) : (
            <ul className="space-y-2">
              {history.map((row) => (
                <li key={row.sessionId} className="card p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="tech-no inline-flex items-center gap-1.5">
                        <CalendarDays size={12} aria-hidden /> {formatDate(sessionDateIso(row.date))}
                      </p>
                      <p className="font-medium text-sm mt-1 truncate">{row.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                        {[row.className, row.courseTitle].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusPill status={row.status} />
                      <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                        {formatDate(row.markedAt, true)}
                      </p>
                    </div>
                  </div>
                  {row.note && (
                    <p className="text-xs mt-2 pt-2 border-t rule-line" style={{ color: "var(--muted)" }}>
                      {row.note}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
