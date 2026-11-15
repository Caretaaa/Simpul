import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/I18nContext";
import { PageHeader, Skeleton } from "../../components/design-system/primitives";
import { QrImage, checkInUrl } from "./session-qr";
import { sessionDateIso, type AttendanceSessionDetail } from "./types";

/** Poster QR satu sesi — dicetak/ditempel agar siswa memindai dengan ponsel. */
export function AttendanceQrPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { t, formatDate } = useI18n();
  const q = useQuery({
    queryKey: ["attendance-session", sessionId],
    queryFn: () => api.get<{ session: AttendanceSessionDetail }>(`/attendance/sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  });
  const session = q.data?.session ?? null;

  return (
    <div>
      <style>{`
        @page { size: A4 portrait; margin: 14mm; }
        @media print {
          body * { visibility: hidden !important; }
          #attendance-qr-print, #attendance-qr-print * { visibility: visible !important; }
          #attendance-qr-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <PageHeader
        no={t("attendance.qrPosterNo")}
        title={t("attendance.qrPosterTitle")}
        subtitle={t("attendance.qrPosterSub")}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/teacher/attendance" className="btn-ghost text-sm inline-flex items-center gap-2">
              <ArrowLeft size={15} aria-hidden /> {t("attendance.backToHub")}
            </Link>
            <button
              type="button"
              className="btn-primary text-sm inline-flex items-center gap-2"
              onClick={() => window.print()}
              disabled={!session}
            >
              <Printer size={15} aria-hidden /> {t("attendance.print")}
            </button>
          </div>
        }
      />

      {q.isLoading ? (
        <Skeleton className="h-96 max-w-md mx-auto" />
      ) : !session ? (
        <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
          {t("attendance.notFound")}
        </p>
      ) : (
        <div id="attendance-qr-print" className="mx-auto max-w-md">
          <div className="card p-6 text-center">
            <p className="tech-no">{t("attendance.posterFooter")}</p>
            <h2 className="font-display text-2xl font-bold mt-1 leading-tight">{session.className}</h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
              {session.courseTitle ?? t("attendance.dailySession")} · {formatDate(sessionDateIso(session.date))}
            </p>

            <div className="rounded-xl border rule-line p-3 mt-5 mx-auto w-fit" style={{ background: "#ffffff" }}>
              <QrImage payload={checkInUrl(session.code)} size={300} />
            </div>

            <p className="font-mono2 text-2xl font-bold tracking-[0.28em] mt-4">{session.code}</p>
            <p className="text-sm mt-3" style={{ color: "var(--muted)" }}>
              {t("attendance.posterScanHint")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
