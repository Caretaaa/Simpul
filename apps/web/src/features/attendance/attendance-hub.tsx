import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CalendarDays, Printer, QrCode, Users } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useI18n } from "../../lib/I18nContext";
import { EmptyState, PageHeader, SectionHead, Skeleton } from "../../components/design-system/primitives";
import {
  sessionDateIso,
  todayIso,
  type AttendanceClass,
  type AttendanceSessionDetail,
  type AttendanceSessionSummary,
} from "./types";

/**
 * Hub absensi guru: buka sesi per kelas/tanggal, lihat kelas yang diampu,
 * dan lanjutkan sesi terakhir. Kehadiran dicatat di halaman sesi.
 */
export function TeacherAttendancePage() {
  const { t, formatDate } = useI18n();
  const navigate = useNavigate();
  const [classId, setClassId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);

  const classesQ = useQuery({
    queryKey: ["attendance-classes"],
    queryFn: () => api.get<{ classes: AttendanceClass[] }>("/attendance/classes"),
  });
  const sessionsQ = useQuery({
    queryKey: ["attendance-sessions"],
    queryFn: () => api.get<{ sessions: AttendanceSessionSummary[] }>("/attendance/sessions?limit=12"),
  });

  const rows = classesQ.data?.classes ?? [];
  const selected = rows.find((c) => c.id === classId) ?? null;

  // Kelas pertama dipilih otomatis agar formulir langsung siap dipakai.
  useEffect(() => {
    if (!classId && rows[0]) setClassId(rows[0].id);
  }, [rows, classId]);
  // Mata pelajaran milik kelas sebelumnya tidak boleh terbawa.
  useEffect(() => {
    setCourseId("");
  }, [classId]);

  const openSession = useMutation({
    mutationFn: (input: { classId: string; courseId?: string | null; date: string }) =>
      api.post<{ session: AttendanceSessionDetail; created: boolean }>("/attendance/sessions", input),
    onSuccess: (res) => navigate(`/teacher/attendance/${res.session.id}`),
    onError: (e) => setError(e instanceof ApiError ? e.message : t("attendance.startFail")),
  });

  function start(classOverride?: string) {
    const target = classOverride ?? classId;
    if (!target) {
      setError(t("attendance.noClasses"));
      return;
    }
    setError(null);
    // Mulai dari kartu kelas selalu memakai absensi harian: pilihan mapel
    // pada formulir bisa milik kelas lain.
    openSession.mutate({ classId: target, courseId: classOverride ? null : courseId || null, date });
  }

  return (
    <div>
      <PageHeader
        no={t("attendance.hubNo")}
        title={t("attendance.hubTitle")}
        subtitle={t("attendance.hubSub")}
        action={
          <Link to="/teacher/classes" className="btn-ghost text-sm inline-flex items-center gap-2">
            <Users size={15} aria-hidden /> {t("nav.classes")}
          </Link>
        }
      />

      {error && (
        <p role="alert" className="text-sm mb-4" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      <form
        className="card p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          start();
        }}
        aria-label={t("attendance.hubTitle")}
      >
        <div>
          <label htmlFor="att-class" className="text-sm font-medium">
            {t("attendance.pickClass")}
          </label>
          <select
            id="att-class"
            className="input mt-1"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            disabled={rows.length === 0}
          >
            {rows.length === 0 && <option value="">{t("attendance.noClasses")}</option>}
            {rows.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.memberCount} {t("attendance.studentsUnit")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="att-course" className="text-sm font-medium">
            {t("attendance.pickCourse")}
          </label>
          <select
            id="att-course"
            className="input mt-1"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            disabled={!selected || selected.courses.length === 0}
          >
            <option value="">{t("attendance.noCourse")}</option>
            {(selected?.courses ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="att-date" className="text-sm font-medium">
            {t("attendance.date")}
          </label>
          <input
            id="att-date"
            type="date"
            className="input mt-1"
            value={date}
            max="2100-12-31"
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn-primary text-sm inline-flex items-center justify-center gap-2 min-h-11" disabled={openSession.isPending || !classId}>
          <QrCode size={16} aria-hidden />
          {openSession.isPending ? t("attendance.starting") : t("attendance.start")}
        </button>
      </form>

      <div className="mt-6 grid lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
        <section aria-label={t("attendance.classesTitle")}>
          <SectionHead title={t("attendance.classesTitle")} />
          {classesQ.isLoading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          ) : classesQ.isError ? (
            <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
              {t("attendance.loadFail")}
            </p>
          ) : rows.length === 0 ? (
            <EmptyState title={t("attendance.noClasses")} body={t("attendance.noClassesBody")} />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {rows.map((c) => (
                <article key={c.id} className="card p-4 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="tech-no">
                        {c.grade} · {c.major}
                        {c.isHomeroom ? ` · ${t("teacher.homeroom")}` : ""}
                      </p>
                      <h3 className="font-display text-lg font-semibold mt-0.5 truncate">{c.name}</h3>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="tech-no">{t("attendance.totalStudents")}</p>
                      <p className="font-display text-xl font-bold">{c.memberCount}</p>
                    </div>
                  </div>

                  {c.today ? (
                    <div className="mt-3 pt-3 border-t rule-line">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full border rule-line"
                          style={{ color: "var(--ok)" }}
                        >
                          {t("attendance.todayBadge")}
                        </span>
                        <span className="text-xs" style={{ color: "var(--muted)" }}>
                          {c.today.courseTitle ?? t("attendance.dailySession")} · {c.today.markedCount}/
                          {c.today.memberCount} {t("attendance.marked").toLowerCase()}
                        </span>
                        <span className="text-[11px]" style={{ color: c.today.status === "open" ? "var(--ok)" : "var(--muted)" }}>
                          {c.today.status === "open" ? t("attendance.openTag") : t("attendance.closedTag")}
                        </span>
                      </div>
                      <Link
                        to={`/teacher/attendance/${c.today.sessionId}`}
                        className="btn-ghost text-xs inline-flex items-center gap-1.5 mt-2"
                      >
                        {t("attendance.openSession")} <ArrowRight size={13} aria-hidden />
                      </Link>
                    </div>
                  ) : (
                    <p className="text-xs mt-3 pt-3 border-t rule-line" style={{ color: "var(--muted)" }}>
                      {t("attendance.sessionEmpty")}
                    </p>
                  )}

                  <div className="mt-auto pt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="btn-primary text-xs min-h-9"
                      onClick={() => {
                        setClassId(c.id);
                        setDate(todayIso());
                        start(c.id);
                      }}
                      disabled={openSession.isPending}
                    >
                      {t("attendance.start")}
                    </button>
                    <Link
                      to={`/teacher/attendance/cards/${c.id}`}
                      className="btn-ghost text-xs inline-flex items-center gap-1.5 min-h-9"
                    >
                      <Printer size={13} aria-hidden /> {t("attendance.printCards")}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside aria-label={t("attendance.sessionsTitle")}>
          <SectionHead title={t("attendance.sessionsTitle")} />
          {sessionsQ.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : sessionsQ.isError ? (
            <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
              {t("attendance.loadFail")}
            </p>
          ) : (sessionsQ.data?.sessions ?? []).length === 0 ? (
            <EmptyState title={t("attendance.sessionEmpty")} body={t("attendance.sessionEmptyBody")} />
          ) : (
            <ol className="space-y-2">
              {(sessionsQ.data?.sessions ?? []).map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/teacher/attendance/${s.id}`}
                    className="card p-3.5 block transition-quiet hover:border-accent"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="tech-no inline-flex items-center gap-1.5">
                        <CalendarDays size={12} aria-hidden /> {formatDate(sessionDateIso(s.date))}
                      </span>
                      <span
                        className="text-[11px] font-medium"
                        style={{ color: s.status === "open" ? "var(--ok)" : "var(--muted)" }}
                      >
                        {s.status === "open" ? t("attendance.openTag") : t("attendance.closedTag")}
                      </span>
                    </div>
                    <p className="font-medium text-sm mt-1 truncate">{s.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                      {s.className} · {s.presentCount} {t("attendance.presentOf")} {s.memberCount}
                    </p>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </div>
  );
}
