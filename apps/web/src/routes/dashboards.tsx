import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  ClipboardList,
  FlaskConical,
  Megaphone,
  Search,
} from "lucide-react";
import { api } from "../lib/api";
import { useI18n } from "../lib/I18nContext";
import { useAuth } from "../features/auth/AuthContext";
import {
  EmptyState,
  PageHeader,
  SectionHead,
  Skeleton,
} from "../components/design-system/primitives";
import { CourseCover } from "../components/design-system/CourseCover";
import { ProgressBar } from "../components/design-system/Learning";
import { useLearningOverview, type CourseSummary } from "../features/courses/useLearning";
import {
  courseStatus,
  filterCourses,
  useCourseFilter,
  type CourseStatusFilter,
} from "../features/courses/courseFilter";

function coverLabel(
  c: Pick<CourseSummary, "subjectName" | "className" | "teacherName" | "title">,
): { label: string; sub: string } {
  return {
    label: c.subjectName ?? c.title,
    sub: [c.className, c.teacherName].filter(Boolean).join(" · "),
  };
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  scope: string;
  courseId: string | null;
  createdAt: string;
}

function greetingKey(hour: number): string {
  if (hour < 11) return "dashboard.greetingMorning";
  if (hour < 18) return "dashboard.greetingDay";
  return "dashboard.greetingEvening";
}

function StatusBadge({ value, total }: { value: number; total: number }) {
  const { t } = useI18n();
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  if (total > 0 && value >= total) {
    return (
      <span className="text-xs font-semibold" style={{ color: "var(--ok)" }}>
        {t("courses.filterCompleted")}
      </span>
    );
  }
  if (value > 0) {
    return (
      <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
        {pct}%
      </span>
    );
  }
  return (
    <span className="text-xs" style={{ color: "var(--muted)" }}>
      {t("courses.filterNotStarted")}
    </span>
  );
}

/** Dasbor siswa — berpusat pada "lanjutkan belajar" dari data progres nyata. */
export function StudentDashboard() {
  const { user } = useAuth();
  const { t, formatDate } = useI18n();
  const { coursesQ, detailQ } = useLearningOverview();
  const announcementsQ = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api.get<{ announcements: Announcement[] }>("/announcements"),
    staleTime: 60_000,
  });
  const filter = useCourseFilter();

  const rows = coursesQ.data?.courses ?? [];
  const enriched = detailQ.data?.enriched ?? [];
  const resume = detailQ.data?.resume ?? null;
  const done = detailQ.data?.done ?? 0;
  const total = detailQ.data?.total ?? 0;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const loading = coursesQ.isLoading || detailQ.isLoading;
  const firstName = user?.name.split(" ")[0] ?? "Siswa";
  const greet = t(greetingKey(new Date().getHours()));
  const latest = (announcementsQ.data?.announcements ?? []).slice(0, 4);
  const visible = filterCourses(enriched, filter.state);

  const stats = [
    {
      label: t("dashboard.stats.enrolled"),
      value: String(enriched.length),
      hint: rows.filter((c) => !c.isEnrolled).length > 0
        ? `+${rows.filter((c) => !c.isEnrolled).length}`
        : undefined,
      icon: BookOpen,
    },
    {
      label: t("dashboard.stats.completed"),
      value: `${done}/${total}`,
      hint: undefined,
      icon: Award,
    },
    {
      label: t("dashboard.stats.overall"),
      value: `${pct}%`,
      hint: undefined,
      icon: ArrowRight,
    },
    {
      label: t("dashboard.stats.announcements"),
      value: announcementsQ.isLoading ? "…" : String(announcementsQ.data?.announcements.length ?? 0),
      hint: undefined,
      icon: Megaphone,
    },
  ];

  return (
    <div>
      {/* Pita sambutan */}
      <section className="welcome-band p-5 md:p-6 mb-5" aria-label={t("nav.dashboard")}>
        <div className="relative z-10 flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1 basis-60">
            <p className="tech-no">{t("dashboard.studentNo")}</p>
            <h1 className="font-display text-2xl md:text-[28px] font-bold tracking-tight mt-1">
              {greet}, {firstName}
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              {t("dashboard.welcomeSub")}
            </p>
            {!loading && enriched.length > 0 && (
              <p className="text-sm mt-2">
                <strong>{enriched.length}</strong> {t("dashboard.stats.enrolled").toLowerCase()} ·{" "}
                <strong>{done}/{total}</strong> {t("common.lessons")} ·{" "}
                <strong>{pct}%</strong>
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            {resume ? (
              <Link
                to={`/student/lessons/${resume.lessonId}`}
                className="btn-primary text-sm inline-flex items-center gap-2"
              >
                {t("dashboard.resumeCta")} <ArrowRight size={15} aria-hidden />
              </Link>
            ) : (
              !loading && (
                <Link to="/student/courses" className="btn-primary text-sm inline-flex items-center gap-2">
                  {t("common.allCourses")} <ArrowRight size={15} aria-hidden />
                </Link>
              )
            )}
          </div>
        </div>
        {!loading && total > 0 && (
          <div className="relative z-10 mt-4 max-w-xl">
            <ProgressBar value={done} total={total} label={t("dashboard.stats.overall")} />
          </div>
        )}
      </section>

      {loading ? (
        <div className="space-y-4" aria-label={t("common.loading")}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-44" />
          <div className="grid sm:grid-cols-2 gap-4">
            <Skeleton className="h-52" />
            <Skeleton className="h-52" />
          </div>
        </div>
      ) : coursesQ.isError ? (
        <p role="alert" style={{ color: "var(--danger)" }}>{t("common.loadFail")}</p>
      ) : enriched.length === 0 ? (
        <EmptyState
          title={t("dashboard.noCoursesTitle")}
          body={t("dashboard.noCoursesBody")}
          action={
            <Link to="/student/courses" className="btn-primary text-sm inline-block">
              {t("dashboard.joinClass")}
            </Link>
          }
        />
      ) : (
        <>
          {/* Statistik ringkas */}
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((s) => (
              <div key={s.label} className="card stat-card p-4 pl-5">
                <dt className="tech-no flex items-center gap-1.5">
                  <s.icon size={12} aria-hidden /> {s.label.toUpperCase()}
                </dt>
                <dd className="font-display text-2xl md:text-3xl font-bold mt-1">
                  {s.value}
                  {s.hint && (
                    <span className="text-sm font-medium ml-1.5" style={{ color: "var(--accent)" }}>
                      {s.hint}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>

          <div className="grid lg:grid-cols-[1.65fr_1fr] gap-6 items-start">
            <div className="space-y-6 min-w-0">
              {/* Lanjutkan belajar */}
              {resume ? (
                <section className="card overflow-hidden" aria-label={t("dashboard.resumeBadge")}>
                  <div className="grid sm:grid-cols-[220px_1fr]">
                    <div className="h-36 sm:h-full min-h-36">
                      <CourseCover
                        courseId={resume.courseId}
                        label={resume.courseTitle}
                        sublabel={resume.moduleTitle}
                      />
                    </div>
                    <div className="p-5">
                      <p className="tech-no">{t("dashboard.resumeBadge")}</p>
                      <h2 className="font-display text-xl font-bold mt-1 leading-snug">{resume.lessonTitle}</h2>
                      <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
                        {resume.courseTitle} · {resume.moduleTitle}
                      </p>
                      <div className="mt-3">
                        <ProgressBar value={resume.done} total={resume.total} label={t("courseDetail.progressLabel")} />
                      </div>
                      <Link
                        to={`/student/lessons/${resume.lessonId}`}
                        className="btn-primary text-sm inline-flex items-center gap-2 mt-4"
                      >
                        {t("dashboard.resumeCta")} <ArrowRight size={15} aria-hidden />
                      </Link>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="card p-5" aria-label={t("dashboard.allDoneTitle")} role="status">
                  <p className="tech-no">{t("dashboard.allDoneTitle")}</p>
                  <h2 className="font-display text-lg font-semibold mt-1">
                    {t("dashboard.allDoneBody")}
                  </h2>
                </section>
              )}

              {/* Kursus saya + filter */}
              <section aria-label={t("courses.mine")}>
                <SectionHead
                  title={`${t("courses.mine")} · ${visible.length}/${enriched.length}`}
                  action={
                    <Link to="/student/courses" className="text-sm font-medium" style={{ color: "var(--accent)" }}>
                      {t("common.viewAll")} →
                    </Link>
                  }
                />
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search size={15} aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--muted)" }} />
                    <label htmlFor="dash-q" className="sr-only">{t("courses.searchLabel")}</label>
                    <input
                      id="dash-q"
                      className="input !pl-9"
                      placeholder={t("courses.searchPh")}
                      value={filter.q}
                      onChange={(e) => filter.setQ(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div className="flex gap-2">
                    <label htmlFor="dash-status" className="sr-only">{t("courses.filterStatus")}</label>
                    <select
                      id="dash-status"
                      className="input sm:w-auto"
                      value={filter.status}
                      onChange={(e) => filter.setStatus(e.target.value as CourseStatusFilter)}
                    >
                      <option value="all">{t("courses.filterAll")}</option>
                      <option value="in-progress">{t("courses.filterInProgress")}</option>
                      <option value="completed">{t("courses.filterCompleted")}</option>
                      <option value="not-started">{t("courses.filterNotStarted")}</option>
                    </select>
                    <label htmlFor="dash-sort" className="sr-only">{t("courses.sortBy")}</label>
                    <select
                      id="dash-sort"
                      className="input sm:w-auto"
                      value={filter.sort}
                      onChange={(e) => filter.setSort(e.target.value as "progress" | "title" | "materials")}
                    >
                      <option value="progress">{t("courses.sortProgress")}</option>
                      <option value="title">{t("courses.sortTitle")}</option>
                      <option value="materials">{t("courses.sortMaterials")}</option>
                    </select>
                  </div>
                </div>
                {visible.length === 0 ? (
                  <EmptyState
                    title={t("courses.noResult")}
                    body={t("courses.noResultBody")}
                    action={
                      <button
                        className="btn-ghost text-sm"
                        onClick={() => {
                          filter.setQ("");
                          filter.setStatus("all");
                        }}
                      >
                        {t("courses.resetFilter")}
                      </button>
                    }
                  />
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {visible.map((c) => {
                      const cover = coverLabel(c);
                      const st = courseStatus(c);
                      return (
                        <Link
                          key={c.id}
                          to={`/student/courses/${c.id}`}
                          className="card overflow-hidden block transition-quiet hover:border-accent"
                          aria-label={`${c.title} — ${c.completedLessons}/${c.totalLessons}`}
                        >
                          <div className="h-28">
                            <CourseCover courseId={c.id} label={cover.label} sublabel={cover.sub} />
                          </div>
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-display font-semibold leading-snug min-w-0">{c.title}</h3>
                              <StatusBadge value={c.completedLessons} total={c.totalLessons} />
                            </div>
                            <p className="tech-no mt-1 truncate">
                              {[c.className, c.teacherName].filter(Boolean).join(" · ") || "—"}
                            </p>
                            <div className="mt-3">
                              <ProgressBar value={c.completedLessons} total={c.totalLessons} label={t("courses.progressLabel")} />
                            </div>
                            {st === "completed" ? (
                              <p className="text-xs mt-2" style={{ color: "var(--ok)" }}>{t("dashboard.reviewOnly")}</p>
                            ) : c.nextLessonTitle ? (
                              <p className="text-xs mt-2 truncate" style={{ color: "var(--muted)" }}>
                                {t("dashboard.nextUp")}: {c.nextLessonTitle}
                              </p>
                            ) : null}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* Kolom aktivitas */}
            <aside className="space-y-4" aria-label={t("dashboard.activity")}>
              <section className="card p-5">
                <SectionHead
                  title={t("dashboard.activity")}
                  action={
                    <Link to="/notifications" className="text-sm font-medium" style={{ color: "var(--accent)" }}>
                      {t("common.viewAll")}
                    </Link>
                  }
                />
                {announcementsQ.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-14" />
                    <Skeleton className="h-14" />
                  </div>
                ) : latest.length === 0 ? (
                  <div className="flex items-start gap-3">
                    <Bell size={16} aria-hidden className="mt-0.5 shrink-0" style={{ color: "var(--muted)" }} />
                    <p className="text-sm" style={{ color: "var(--muted)" }}>
                      {t("dashboard.activityEmpty")}
                    </p>
                  </div>
                ) : (
                  <ol className="space-y-3">
                    {latest.map((a) => (
                      <li key={a.id} className="border-b rule-line last:border-0 pb-3 last:pb-0">
                        <p className="tech-no">
                          {a.scope === "school" ? t("notifications.schoolTag") : t("notifications.courseTag")} · {formatDate(a.createdAt)}
                        </p>
                        <p className="text-sm font-semibold mt-0.5 leading-snug">{a.title}</p>
                        <p className="text-[13px] mt-0.5 line-clamp-2" style={{ color: "var(--muted)" }}>
                          {a.body}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className="card p-5">
                <p className="tech-no">{t("dashboard.tasksTitle")}</p>
                <div className="flex items-start gap-3 mt-2">
                  <ClipboardList size={18} aria-hidden className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                  <div>
                    <p className="text-sm" style={{ color: "var(--muted)" }}>
                      {t("dashboard.tasksBody")}
                    </p>
                    <Link to="/student/assignments" className="text-sm font-medium mt-2 inline-block" style={{ color: "var(--accent)" }}>
                      {t("dashboard.openTasks")} →
                    </Link>
                  </div>
                </div>
              </section>

              <section className="card p-5">
                <p className="tech-no">{t("dashboard.labTitle")}</p>
                <div className="flex items-start gap-3 mt-2">
                  <FlaskConical size={18} aria-hidden className="mt-0.5 shrink-0" style={{ color: "var(--teal)" }} />
                  <div>
                    <p className="text-sm" style={{ color: "var(--muted)" }}>
                      {t("dashboard.labBody")}
                    </p>
                    <Link to="/student/labs" className="text-sm font-medium mt-2 inline-block" style={{ color: "var(--accent)" }}>
                      {t("dashboard.openLabs")} →
                    </Link>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

interface TeacherCourseRow {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  subjectName: string | null;
  className: string | null;
  teacherName: string | null;
  teacherId: string | null;
}

/** Dasbor guru — kursus yang diajar dengan status materi, plus aksi cepat. */
export function TeacherDashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get<{ courses: TeacherCourseRow[] }>("/courses"),
  });
  const mine = (courses.data?.courses ?? []).filter((c) => c.teacherId === user?.id);
  const published = mine.filter((c) => c.status === "published").length;
  const draft = mine.filter((c) => c.status !== "published").length;

  return (
    <div>
      <PageHeader
        no={t("teacher.dashNo")}
        title={`${t("teacher.teachingSpace")}, ${user?.name.split(" ")[0] ?? "Guru"}`}
        subtitle={t("teacher.dashSub")}
        action={
          <Link to="/teacher/courses" className="btn-primary text-sm">
            {t("teacher.newCourse")}
          </Link>
        }
      />
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
        <section aria-label={t("teacher.myCourses")}>
          <h2 className="tech-no mb-3">{t("teacher.myCourses")} · {mine.length}</h2>
          {courses.isLoading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          ) : mine.length === 0 ? (
            <EmptyState
              title={t("teacher.noCourses")}
              body={t("teacher.noCoursesBody")}
              action={
                <Link to="/teacher/courses" className="btn-primary text-sm inline-block">
                  {t("teacher.firstCourse")}
                </Link>
              }
            />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {mine.map((c) => (
                <Link
                  key={c.id}
                  to={`/teacher/courses/${c.id}/edit`}
                  className="card overflow-hidden block transition-quiet hover:border-accent"
                >
                  <div className="h-24">
                    <CourseCover
                      courseId={c.id}
                      label={c.subjectName ?? c.title}
                      sublabel={[c.className, c.status === "published" ? t("teacher.published").toUpperCase() : c.status.toUpperCase()].filter(Boolean).join(" · ")}
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-display font-semibold leading-snug">{c.title}</h3>
                    <p className="tech-no mt-1.5">{c.className ?? "—"}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
        <aside className="space-y-4" aria-label={t("dashboard.summary")}>
          <div className="card stat-card p-5 pl-6">
            <p className="tech-no">{t("teacher.publishStatus")}</p>
            <p className="font-display text-3xl font-bold mt-1">
              {published}
              <span className="text-base font-medium" style={{ color: "var(--muted)" }}> {t("teacher.published")} · {draft} {t("teacher.draft")}</span>
            </p>
            <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>
              {t("teacher.publishedNote")}
            </p>
          </div>
          <nav className="card p-5 space-y-2" aria-label={t("teacher.quickActions")}>
            <p className="tech-no mb-1">{t("teacher.quickActions")}</p>
            <Link to="/teacher/classes" className="block text-sm font-medium py-1" style={{ color: "var(--accent)" }}>
              {t("teacher.shareCode")} →
            </Link>
            <Link to="/teacher/announcements" className="block text-sm font-medium py-1" style={{ color: "var(--accent)" }}>
              {t("teacher.writeAnnouncement")} →
            </Link>
            <Link to="/teacher/classes" className="block text-sm font-medium py-1" style={{ color: "var(--accent)" }}>
              {t("teacher.manageClasses")} →
            </Link>
          </nav>
        </aside>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const { t } = useI18n();
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => api.get<{ users: unknown[] }>("/users") });
  const classes = useQuery({ queryKey: ["admin-classes"], queryFn: () => api.get<{ classes: unknown[] }>("/classes") });
  const subjects = useQuery({ queryKey: ["admin-subjects"], queryFn: () => api.get<{ subjects: unknown[] }>("/subjects") });
  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get<{ courses: Array<{ status: string }> }>("/courses"),
  });

  function statOf(q: { isLoading: boolean; isError: boolean; data?: unknown }, key: string): number | string {
    if (q.isLoading) return "…";
    if (q.isError) return "—";
    const data = q.data as Record<string, unknown[]> | undefined;
    return data?.[key]?.length ?? 0;
  }

  const publishedCount = (courses.data?.courses ?? []).filter((c) => c.status === "published").length;
  const draftCount = (courses.data?.courses ?? []).filter((c) => c.status !== "published").length;

  const stats = [
    { no: "01", label: t("admin.users"), value: statOf(users, "users"), to: "/admin/users" },
    { no: "02", label: t("admin.classes"), value: statOf(classes, "classes"), to: "/admin/classes" },
    { no: "03", label: t("admin.subjects"), value: statOf(subjects, "subjects"), to: "/admin/subjects" },
  ];

  return (
    <div>
      <PageHeader
        no={t("admin.dashNo")}
        title={t("admin.title")}
        subtitle={t("admin.subtitle")}
        action={
          <Link to="/admin/users" className="btn-ghost text-sm">
            {t("admin.manageUsers")}
          </Link>
        }
      />
      <dl className="grid sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="card stat-card p-5 pl-6 block transition-quiet hover:border-accent">
            <dt className="tech-no">{s.no} · {s.label.toUpperCase()}</dt>
            <dd className="font-display text-4xl font-bold mt-1">{s.value}</dd>
          </Link>
        ))}
      </dl>
      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        <Link to="/admin/courses" className="card p-5 block transition-quiet hover:border-accent">
          <p className="tech-no">{t("admin.coursesTag")} · {publishedCount} {t("admin.coursesPublished")} · {draftCount} {t("admin.coursesDraft")}</p>
          <p className="font-display text-lg font-semibold mt-1">{t("admin.reviewPath")}</p>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {t("admin.reviewPathBody")}
          </p>
        </Link>
        <Link to="/admin/academic-years" className="card p-5 block transition-quiet hover:border-accent">
          <p className="tech-no">{t("admin.yearTag")}</p>
          <p className="font-display text-lg font-semibold mt-1">{t("admin.yearTitle")}</p>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {t("admin.yearBody")}
          </p>
        </Link>
      </div>
    </div>
  );
}
