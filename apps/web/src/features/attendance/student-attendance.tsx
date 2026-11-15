import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Check, QrCode } from "lucide-react";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/I18nContext";
import { EmptyState, PageHeader, Skeleton } from "../../components/design-system/primitives";
import { SessionCodeForm } from "./code-form";
import {
  sessionDateIso,
  statusColor,
  statusKey,
  type StudentAttendanceHistoryRow,
} from "./types";

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

/** Riwayat kehadiran siswa + pintu masuk kode sesi dari QR guru. */
export function StudentAttendancePage() {
  const { t, formatDate } = useI18n();
  const q = useQuery({
    queryKey: ["attendance-me"],
    queryFn: () => api.get<{ classes: Array<{ id: string; name: string }>; history: StudentAttendanceHistoryRow[] }>(
      "/attendance/me",
    ),
  });

  const history = q.data?.history ?? [];

  return (
    <div>
      <PageHeader no={t("attendance.studentNo")} title={t("attendance.studentTitle")} subtitle={t("attendance.studentSub")} />

      <div className="grid lg:grid-cols-[340px_1fr] gap-6 items-start">
        <section className="card p-5" aria-label={t("attendance.codeFormTitle")}>
          <h2 className="font-display font-semibold inline-flex items-center gap-2">
            <QrCode size={17} aria-hidden /> {t("attendance.codeFormTitle")}
          </h2>
          <p className="text-xs mt-1 mb-3" style={{ color: "var(--muted)" }}>
            {t("attendance.codeFormBody")}
          </p>
          <SessionCodeForm />
        </section>

        <section aria-label={t("attendance.historyTitle")}>
          <div className="mb-3">
            <h2 className="font-display text-lg font-semibold">{t("attendance.historyTitle")}</h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {t("attendance.historySub")}
            </p>
          </div>

          {q.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : q.isError ? (
            <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
              {t("attendance.historyLoadFail")}
            </p>
          ) : history.length === 0 ? (
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
                        {row.method === "manual" ? t("attendance.markedManual") : t("attendance.markedSelf")} ·{" "}
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
