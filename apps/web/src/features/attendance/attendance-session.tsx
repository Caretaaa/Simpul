import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ClipboardCheck,
  Lock,
  LockOpen,
  Printer,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@simpul/shared";
import { api, ApiError } from "../../lib/api";
import { useI18n } from "../../lib/I18nContext";
import { EmptyState, PageHeader, Skeleton } from "../../components/design-system/primitives";
import { CameraScanner } from "./camera-scanner";
import {
  sessionDateIso,
  statusColor,
  statusKey,
  type AttendanceSessionDetail,
  type AttendanceSummary,
  type AttendanceStudentRow,
} from "./types";

interface ScanResponse {
  student: { id: string; name: string };
  record: { status: AttendanceStatus; method: "scan" | "manual" };
  summary: AttendanceSummary;
  duplicate: boolean;
  overwritten: boolean;
}

function SummaryStrip({ summary }: { summary: AttendanceSummary }) {
  const { t } = useI18n();
  return (
    <dl className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {ATTENDANCE_STATUSES.map((status) => (
        <div key={status} className="rounded-lg border rule-line px-3 py-2" style={{ background: "var(--paper)" }}>
          <dt className="text-[11px] font-medium" style={{ color: statusColor(status) }}>
            {t(statusKey(status))}
          </dt>
          <dd className="font-display text-xl font-bold tabular-nums">{summary[status]}</dd>
        </div>
      ))}
      <div className="rounded-lg border rule-line px-3 py-2" style={{ background: "var(--paper)" }}>
        <dt className="text-[11px] font-medium" style={{ color: "var(--muted)" }}>
          {t("attendance.unmarked")}
        </dt>
        <dd className="font-display text-xl font-bold tabular-nums">{summary.unmarked}</dd>
      </div>
    </dl>
  );
}

function StudentRow({
  student,
  disabled,
  onMark,
  busy,
}: {
  student: AttendanceStudentRow;
  disabled: boolean;
  onMark: (studentId: string, status: AttendanceStatus | null, note: string | null) => void;
  busy: boolean;
}) {
  const { t, formatDate } = useI18n();
  const [note, setNote] = useState(student.note ?? "");
  useEffect(() => setNote(student.note ?? ""), [student.note]);

  const status = student.status;
  return (
    <li className="card p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium leading-snug truncate">{student.name}</p>
          <p className="font-mono2 text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
            {student.attendanceCode ?? student.email}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-semibold" style={{ color: status ? statusColor(status) : "var(--muted)" }}>
            {status ? t(statusKey(status)) : t("attendance.unmarked")}
          </p>
          {status && student.markedAt && (
            <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
              {student.method === "scan" ? t("attendance.markedScan") : t("attendance.markedManual")} ·{" "}
              {formatDate(student.markedAt, true)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label={`${t("attendance.colStatus")} ${student.name}`}>
        {ATTENDANCE_STATUSES.map((value) => {
          const selected = status === value;
          return (
            <button
              key={value}
              type="button"
              className="text-xs rounded-md border px-2.5 min-h-9 inline-flex items-center gap-1 transition-quiet"
              style={{
                borderColor: selected ? statusColor(value) : "var(--line)",
                color: selected ? statusColor(value) : "var(--muted)",
                background: selected ? "var(--paper)" : "transparent",
                fontWeight: selected ? 600 : 500,
              }}
              aria-pressed={selected}
              disabled={disabled || busy}
              onClick={() => onMark(student.id, value, note.trim() || null)}
            >
              {selected && <Check size={12} aria-hidden />}
              {t(statusKey(value))}
            </button>
          );
        })}
        {status && (
          <button
            type="button"
            className="text-xs rounded-md border px-2.5 min-h-9"
            style={{ borderColor: "var(--line)", color: "var(--muted)" }}
            disabled={disabled || busy}
            onClick={() => onMark(student.id, null, null)}
          >
            {t("attendance.clearStatus")}
          </button>
        )}
      </div>

      <div className="mt-2">
        <label htmlFor={`note-${student.id}`} className="sr-only">
          {t("attendance.note")} {student.name}
        </label>
        <input
          id={`note-${student.id}`}
          className="input !py-1.5 text-xs"
          placeholder={t("attendance.notePlaceholder")}
          value={note}
          maxLength={300}
          disabled={disabled || status === null}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            const next = note.trim();
            if ((student.note ?? "") !== next) onMark(student.id, status, next || null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      </div>
    </li>
  );
}

/** Ruang kerja absensi satu sesi: pindai kartu atau tandai daftar manual. */
export function AttendanceSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { t, formatDate } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const sessionQ = useQuery({
    queryKey: ["attendance-session", sessionId],
    queryFn: () => api.get<{ session: AttendanceSessionDetail }>(`/attendance/sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  });
  const session = sessionQ.data?.session ?? null;
  const closed = session?.status === "closed";

  const [code, setCode] = useState("");
  const [scanFeedback, setScanFeedback] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [marking, setMarking] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["attendance-session", sessionId] });
    void qc.invalidateQueries({ queryKey: ["attendance-sessions"] });
    void qc.invalidateQueries({ queryKey: ["attendance-classes"] });
  }

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const mark = useMutation({
    mutationFn: (input: { studentId: string; status: AttendanceStatus | null; note: string | null }) =>
      api.post<{ record: unknown; summary: AttendanceSummary }>(
        `/attendance/sessions/${sessionId}/records`,
        input,
      ),
    onMutate: (input) => setMarking(input.studentId),
    onSuccess: () => {
      setNotice(null);
      invalidate();
    },
    onError: (e) => {
      setNotice({ tone: "error", text: e instanceof ApiError ? e.message : t("attendance.saveFail") });
      invalidate();
    },
    onSettled: () => setMarking(null),
  });

  const scan = useMutation({
    mutationFn: (payload: string) =>
      api.post<ScanResponse>(`/attendance/sessions/${sessionId}/scan`, { code: payload }),
    onSuccess: (res) => {
      const detail = res.duplicate
        ? t("attendance.scanDuplicate")
        : res.overwritten
          ? t("attendance.scanUpdated")
          : t("attendance.scanOk");
      setScanFeedback({ tone: res.duplicate ? "warn" : "ok", text: `${res.student.name} — ${detail}` });
      setCode("");
      invalidate();
      codeInputRef.current?.focus();
    },
    onError: (e) => {
      const message =
        e instanceof ApiError && e.status === 404
          ? t("attendance.scanUnknown")
          : e instanceof ApiError
            ? e.message
            : t("attendance.scanFail");
      setScanFeedback({ tone: "error", text: message });
      codeInputRef.current?.select();
    },
  });

  const markAll = useMutation({
    mutationFn: async () => {
      const pending = (session?.students ?? []).filter((s) => s.status === null);
      for (const student of pending) {
        await api.post(`/attendance/sessions/${sessionId}/records`, {
          studentId: student.id,
          status: "hadir",
        });
      }
      return pending.length;
    },
    onSuccess: (count) => {
      setNotice(
        count === 0
          ? { tone: "warn", text: t("attendance.markAllNone") }
          : { tone: "ok", text: t("attendance.markAllOk") },
      );
      invalidate();
    },
    onError: () => setNotice({ tone: "error", text: t("attendance.markAllFail") }),
  });

  const setStatus = useMutation({
    mutationFn: (status: "open" | "closed") =>
      api.patch<{ session: AttendanceSessionDetail }>(`/attendance/sessions/${sessionId}`, { status }),
    onSuccess: (_res, status) => {
      setNotice({
        tone: "ok",
        text: status === "closed" ? t("attendance.closeOk") : t("attendance.reopenOk"),
      });
      invalidate();
    },
    onError: (e) => setNotice({ tone: "error", text: e instanceof ApiError ? e.message : t("attendance.statusFail") }),
  });

  const remove = useMutation({
    mutationFn: () => api.del<{ ok: boolean }>(`/attendance/sessions/${sessionId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["attendance-sessions"] });
      void qc.invalidateQueries({ queryKey: ["attendance-classes"] });
      navigate("/teacher/attendance");
    },
    onError: (e) => setNotice({ tone: "error", text: e instanceof ApiError ? e.message : t("attendance.statusFail") }),
  });

  if (sessionQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (sessionQ.isError || !session) {
    return (
      <div>
        <PageHeader no={t("attendance.sessionNo")} title={t("attendance.notFound")} subtitle={t("attendance.notFoundBody")} />
        <Link to="/teacher/attendance" className="btn-ghost text-sm inline-flex items-center gap-2">
          <ArrowLeft size={15} aria-hidden /> {t("attendance.backToHub")}
        </Link>
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  const visible = query
    ? session.students.filter(
        (s) =>
          s.name.toLowerCase().includes(query) || (s.attendanceCode ?? "").toLowerCase().includes(query),
      )
    : session.students;
  const unmarked = session.students.filter((s) => s.status === null).length;

  return (
    <div>
      <div className="mb-3">
        <Link to="/teacher/attendance" className="text-sm inline-flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
          <ArrowLeft size={14} aria-hidden /> {t("attendance.backToHub")}
        </Link>
      </div>
      <PageHeader
        no={t("attendance.sessionNo")}
        title={session.title}
        subtitle={`${session.className} · ${formatDate(sessionDateIso(session.date))}${
          session.courseTitle ? ` · ${session.courseTitle}` : ` · ${t("attendance.dailySession")}`
        }`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/teacher/attendance/cards/${session.classId}`}
              className="btn-ghost text-sm inline-flex items-center gap-2"
            >
              <Printer size={15} aria-hidden /> {t("attendance.cardLink")}
            </Link>
            <button
              type="button"
              className="btn-ghost text-sm inline-flex items-center gap-2"
              onClick={() => setStatus.mutate(closed ? "open" : "closed")}
              disabled={setStatus.isPending}
            >
              {closed ? <LockOpen size={15} aria-hidden /> : <Lock size={15} aria-hidden />}
              {closed ? t("attendance.reopenSession") : t("attendance.closeSession")}
            </button>
            <button
              type="button"
              className="btn-ghost text-sm inline-flex items-center gap-2"
              style={{ color: "var(--danger)" }}
              onClick={() => {
                if (window.confirm(t("attendance.deleteConfirm"))) remove.mutate();
              }}
              disabled={remove.isPending}
              aria-label={t("attendance.deleteSession")}
              title={t("attendance.deleteSession")}
            >
              <Trash2 size={15} aria-hidden />
              <span className="hidden sm:inline">{t("attendance.deleteSession")}</span>
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full border rule-line inline-flex items-center gap-1.5"
          style={{ color: closed ? "var(--muted)" : "var(--ok)" }}
        >
          {closed ? <Lock size={12} aria-hidden /> : <ClipboardCheck size={12} aria-hidden />}
          {closed ? t("attendance.closedTag") : t("attendance.openTag")}
        </span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          <Users size={12} aria-hidden className="inline -mt-0.5" /> {session.summary.total}{" "}
          {t("attendance.studentsUnit")} · {session.summary.total - session.summary.unmarked}{" "}
          {t("attendance.marked").toLowerCase()}
        </span>
        {session.createdByName && (
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            · {session.createdByName}
          </span>
        )}
        {session.updatedAt && (
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            · {t("attendance.lastUpdate")} {formatDate(session.updatedAt, true)}
          </span>
        )}
      </div>

      {notice && (
        <p
          role="status"
          className="text-sm mb-4 px-3 py-2 rounded-lg border rule-line"
          style={{
            color:
              notice.tone === "error" ? "var(--danger)" : notice.tone === "warn" ? "var(--warn)" : "var(--ok)",
            background: "var(--paper)",
          }}
        >
          {notice.text}
        </p>
      )}

      <div className="grid lg:grid-cols-[0.95fr_1.35fr] gap-6 items-start">
        <div className="space-y-4">
          <section className="card p-4" aria-label={t("attendance.scanTitle")}>
            <h2 className="font-display font-semibold mb-3 flex items-center gap-2">
              <ClipboardCheck size={17} aria-hidden /> {t("attendance.scanTitle")}
            </h2>
            <CameraScanner
              disabled={closed}
              onCode={(payload) => {
                if (closed || scan.isPending) return;
                scan.mutate(payload);
              }}
            />

            <form
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!code.trim() || closed || scan.isPending) return;
                scan.mutate(code.trim());
              }}
            >
              <label htmlFor="scan-code" className="text-sm font-medium">
                {t("attendance.scanInputLabel")}
              </label>
              <div className="flex flex-col sm:flex-row gap-2 mt-1">
                <input
                  ref={codeInputRef}
                  id="scan-code"
                  className="input font-mono2"
                  placeholder={t("attendance.scanInputPlaceholder")}
                  value={code}
                  autoComplete="off"
                  autoFocus
                  disabled={closed}
                  onChange={(e) => setCode(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn-primary text-sm shrink-0 min-h-11 px-4 w-full sm:w-auto"
                  disabled={closed || scan.isPending || code.trim().length === 0}
                >
                  {scan.isPending ? t("attendance.scanScanning") : t("attendance.scanSubmit")}
                </button>
              </div>
            </form>

            <div role="status" aria-live="polite" className="min-h-6 mt-2 text-sm">
              {scanFeedback && (
                <p
                  style={{
                    color:
                      scanFeedback.tone === "error"
                        ? "var(--danger)"
                        : scanFeedback.tone === "warn"
                          ? "var(--warn)"
                          : "var(--ok)",
                  }}
                >
                  {scanFeedback.text}
                </p>
              )}
            </div>
          </section>

          <section className="card p-4" aria-label={t("attendance.summaryTitle")}>
            <h2 className="tech-no mb-2">{t("attendance.summaryTitle")}</h2>
            <SummaryStrip summary={session.summary} />
          </section>
        </div>

        <section aria-label={t("attendance.manualTitle")}>
          <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
            <div>
              <h2 className="font-display font-semibold">{t("attendance.manualTitle")}</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                {closed ? t("attendance.closedNotice") : t("attendance.manualHint")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="tech-no">
                {session.summary.total - session.summary.unmarked}/{session.summary.total}
              </span>
              <button
                type="button"
                className="btn-ghost text-xs min-h-9"
                onClick={() => markAll.mutate()}
                disabled={closed || markAll.isPending || unmarked === 0}
              >
                {markAll.isPending ? t("attendance.markAllWorking") : `${t("attendance.markAll")} (${unmarked})`}
              </button>
            </div>
          </div>

          {session.students.length > 0 && (
            <div className="relative mb-3">
              <Search
                size={15}
                aria-hidden
                className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--muted)" }}
              />
              <label htmlFor="att-search" className="sr-only">
                {t("attendance.search")}
              </label>
              <input
                id="att-search"
                className="input pl-8"
                placeholder={t("attendance.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}

          {session.students.length === 0 ? (
            <EmptyState title={t("attendance.noStudents")} body={t("attendance.noStudentsBody")} />
          ) : visible.length === 0 ? (
            <EmptyState
              title={t("attendance.noMatch")}
              body={t("attendance.noMatchBody")}
              action={
                <button type="button" className="btn-ghost text-sm" onClick={() => setSearch("")}>
                  {t("attendance.resetSearch")}
                </button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {visible.map((student) => (
                <StudentRow
                  key={student.id}
                  student={student}
                  disabled={closed}
                  busy={marking === student.id}
                  onMark={(studentId, status, note) => mark.mutate({ studentId, status, note })}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
