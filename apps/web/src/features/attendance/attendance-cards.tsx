import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { toDataURL } from "qrcode";
import { attendanceQrPayload } from "@simpul/shared";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/I18nContext";
import { EmptyState, PageHeader, Skeleton } from "../../components/design-system/primitives";

interface CardsResponse {
  class: { id: string; name: string; grade: string; major: string };
  students: Array<{ id: string; name: string; attendanceCode: string }>;
}

/** QR dirender sebagai data URL agar ikut tercetak tanpa bergantung jaringan. */
function QrImage({ payload, size }: { payload: string; size: number }) {
  const { t } = useI18n();
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    toDataURL(payload, { margin: 1, width: size * 2, errorCorrectionLevel: "M" })
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [payload, size]);

  if (failed) return <div className="font-mono2 text-xs p-4" role="alert">{payload}</div>;
  if (!src) return <Skeleton className="mx-auto" label={t("common.loading")} />;
  return (
    <img
      src={src}
      alt={`${t("attendance.qrAlt")} — ${payload}`}
      width={size}
      height={size}
      className="mx-auto block"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

/** Kartu QR seluruh siswa satu kelas, siap dicetak dan dipotong. */
export function AttendanceCardsPage() {
  const { classId } = useParams<{ classId: string }>();
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["attendance-cards", classId],
    queryFn: () => api.get<CardsResponse>(`/attendance/classes/${classId}/cards`),
    enabled: Boolean(classId),
  });
  const data = q.data;

  return (
    <div>
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          body * { visibility: hidden !important; }
          #attendance-print, #attendance-print * { visibility: visible !important; }
          #attendance-print { position: absolute; left: 0; top: 0; width: 100%; }
          #attendance-print .att-print-card { break-inside: avoid; border-color: #bbb !important; }
          #attendance-print .att-print-only { display: block !important; }
        }
        #attendance-print .att-print-only { display: none; }
      `}</style>

      <PageHeader
        no={t("attendance.cardsNo")}
        title={t("attendance.cardsTitle")}
        subtitle={data ? `${data.class.name} · ${t("attendance.cardsSub")}` : t("attendance.cardsSub")}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/teacher/attendance" className="btn-ghost text-sm inline-flex items-center gap-2">
              <ArrowLeft size={15} aria-hidden /> {t("attendance.backToHub")}
            </Link>
            <button
              type="button"
              className="btn-primary text-sm inline-flex items-center gap-2"
              onClick={() => window.print()}
              disabled={!data || data.students.length === 0}
            >
              <Printer size={15} aria-hidden /> {t("attendance.print")}
            </button>
          </div>
        }
      />

      {q.isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : q.isError || !data ? (
        <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
          {t("attendance.cardsLoadFail")}
        </p>
      ) : data.students.length === 0 ? (
        <EmptyState title={t("attendance.cardsEmpty")} body={t("attendance.cardsEmptyBody")} />
      ) : (
        <div id="attendance-print">
          <p className="att-print-only mb-4">
            <strong>{data.class.name}</strong> — {t("attendance.cardsTitle")}
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2">
            {data.students.map((student) => (
              <li key={student.id} className="att-print-card card p-4 text-center break-inside-avoid">
                <p className="tech-no">{t("attendance.cardFooter")}</p>
                <p className="font-display font-semibold mt-1 leading-tight">{student.name}</p>
                <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>
                  {data.class.name} · {data.class.major}
                </p>
                <QrImage payload={attendanceQrPayload(student.attendanceCode)} size={168} />
                <p className="font-mono2 text-xs tracking-[0.18em] mt-2">{student.attendanceCode}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
