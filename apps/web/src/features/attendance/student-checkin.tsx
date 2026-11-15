import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Check, Clock, Lock, UserCheck, Users } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useI18n } from "../../lib/I18nContext";
import { PageHeader, Skeleton } from "../../components/design-system/primitives";
import { SessionCodeForm } from "./code-form";
import {
  sessionDateIso,
  statusColor,
  statusKey,
  type AttendanceSummary,
  type StudentSessionPreview,
} from "./types";

interface CheckInResponse {
  record: { studentId: string; status: string; method: "scan" | "manual"; note: string | null; markedAt: string };
  summary: AttendanceSummary;
  duplicate: boolean;
}

/**
 * Halaman tujuan QR sesi: siswa membuka `/absen/<kode>` dari kamera ponsel,
 * memeriksa sesi yang benar, lalu menandai kehadirannya sendiri.
 */
export function StudentCheckInPage() {
  const { code = "" } = useParams<{ code: string }>();
  const { t, formatDate } = useI18n();
  const qc = useQueryClient();

  const previewQ = useQuery({
    queryKey: ["attendance-checkin", code],
    queryFn: () => api.get<{ session: StudentSessionPreview }>(`/attendance/sessions/by-code/${code}`),
    retry: false,
  });
  const session = previewQ.data?.session ?? null;

  const checkIn = useMutation({
    mutationFn: () => api.post<CheckInResponse>(`/attendance/sessions/by-code/${code}/check-in`, {}),
    // Tulis hasil ke cache agar status langsung berubah tanpa menunggu refetch.
    onSuccess: (res) => {
      qc.setQueryData<{ session: StudentSessionPreview }>(["attendance-checkin", code], (old) =>
        old
          ? {
              session: {
                ...old.session,
                myStatus: res.record.status as StudentSessionPreview["myStatus"],
                myMethod: res.record.method,
                myNote: res.record.note,
                myMarkedAt: res.record.markedAt,
                presentCount: res.summary.hadir,
              },
            }
          : old,
      );
      void qc.invalidateQueries({ queryKey: ["attendance-me"] });
    },
  });

  const backLink = (
    <div className="mb-3">
      <Link to="/student/attendance" className="text-sm inline-flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
        <ArrowLeft size={14} aria-hidden /> {t("attendance.backToHistory")}
      </Link>
    </div>
  );

  if (previewQ.isLoading) {
    return (
      <div className="max-w-xl mx-auto">
        {backLink}
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (previewQ.isError || !session) {
    const status = previewQ.error instanceof ApiError ? previewQ.error.status : 0;
    const title = status === 403 ? t("attendance.checkinNotMemberTitle") : t("attendance.checkinUnknownTitle");
    const body = status === 403 ? t("attendance.checkinNotMember") : t("attendance.checkinUnknown");
    return (
      <div className="max-w-xl mx-auto">
        {backLink}
        <PageHeader no={t("attendance.checkinNo")} title={title} subtitle={body} />
        <div className="card p-5">
          <SessionCodeForm autoFocus />
        </div>
      </div>
    );
  }

  const checkedIn = session.myStatus !== null;
  const closed = session.status === "closed";
  const errorStatus = checkIn.error instanceof ApiError ? checkIn.error.status : 0;
  const myStatus = session.myStatus;

  return (
    <div className="max-w-xl mx-auto">
      {backLink}
      <PageHeader
        no={t("attendance.checkinNo")}
        title={t("attendance.checkinTitle")}
        subtitle={checkIn.isSuccess ? t("attendance.checkinOk") : t("attendance.checkinBody")}
      />

      <section className="card p-5" aria-label={t("attendance.checkinTitle")}>
        <p className="tech-no inline-flex items-center gap-1.5">
          <CalendarDays size={12} aria-hidden /> {formatDate(sessionDateIso(session.date))}
        </p>
        <h2 className="font-display text-xl font-bold mt-1">{session.title}</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
          {[session.className, session.courseTitle].filter(Boolean).join(" · ")}
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full border rule-line inline-flex items-center gap-1"
            style={{ color: closed ? "var(--muted)" : "var(--ok)" }}
          >
            {closed ? <Lock size={11} aria-hidden /> : <Clock size={11} aria-hidden />}
            {closed ? t("attendance.closedTag") : t("attendance.openTag")}
          </span>
          <span className="text-xs inline-flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
            <Users size={12} aria-hidden /> {session.presentCount} {t("attendance.checkinPresentOf")}{" "}
            {session.memberCount} {t("attendance.studentsUnit")}
          </span>
        </div>

        <div className="mt-4 pt-4 border-t rule-line">
          <p className="tech-no">{t("attendance.checkinYourStatus")}</p>
          {checkedIn && myStatus ? (
            <div className="mt-1">
              <p className="font-display text-lg font-bold" style={{ color: statusColor(myStatus) }}>
                {t(statusKey(myStatus))}
              </p>
              {session.myMarkedAt && (
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                  {session.myMethod === "manual" ? t("attendance.markedManual") : t("attendance.markedSelf")} ·{" "}
                  {formatDate(session.myMarkedAt, true)}
                </p>
              )}
              {session.myNote && (
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  {session.myNote}
                </p>
              )}
              <p className="text-sm mt-3 inline-flex items-center gap-1.5" style={{ color: "var(--ok)" }}>
                <Check size={15} aria-hidden /> {t("attendance.checkinAlready")}
              </p>
            </div>
          ) : (
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              {t("attendance.myStatusNone")}
            </p>
          )}
        </div>

        {!checkedIn && (
          <div className="mt-5">
            {closed ? (
              <p
                role="status"
                className="text-sm px-3 py-2 rounded-lg border rule-line"
                style={{ color: "var(--warn)", background: "var(--paper)" }}
              >
                {t("attendance.checkinClosed")}
              </p>
            ) : (
              <button
                type="button"
                className="btn-primary text-sm w-full min-h-12 inline-flex items-center justify-center gap-2"
                onClick={() => checkIn.mutate()}
                disabled={checkIn.isPending}
              >
                <UserCheck size={17} aria-hidden />
                {checkIn.isPending ? t("attendance.checkinWorking") : t("attendance.checkinBtn")}
              </button>
            )}
          </div>
        )}

        {checkIn.isError && (
          <p role="alert" className="text-sm mt-3" style={{ color: "var(--danger)" }}>
            {errorStatus === 409
              ? t("attendance.checkinClosed")
              : errorStatus === 403
                ? t("attendance.checkinNotMember")
                : errorStatus === 404
                  ? t("attendance.checkinUnknown")
                  : t("attendance.checkinFail")}
          </p>
        )}
      </section>
    </div>
  );
}
