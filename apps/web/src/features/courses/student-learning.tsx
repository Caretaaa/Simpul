import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Clock, Search, UserRound } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useI18n } from "../../lib/I18nContext";
import {
  Breadcrumbs,
  CommandBlock,
  EmptyState,
  PageHeader,
  SectionHead,
  Skeleton,
  StatusPill,
} from "../../components/design-system/primitives";
import { CourseCover } from "../../components/design-system/CourseCover";
import {
  LessonStatusDot,
  ProgressBar,
  readingMinutes,
  slugify,
} from "../../components/design-system/Learning";
import { JoinClassForm } from "../classes/class-join";
import { useAuth } from "../auth/AuthContext";
import { useLearningOverview, type CourseSummary } from "./useLearning";
import {
  courseStatus,
  filterCourses,
  useCourseFilter,
  type CourseStatusFilter,
  type CourseSort,
} from "./courseFilter";

interface CourseDetail {
  course: { id: string; title: string; description: string | null; status: string; subjectId: string | null; classId: string | null; teacherId: string | null };
  modules: Array<{
    id: string; title: string; position: number;
    lessons: Array<{ id: string; title: string; contentType: string; position: number; isPublished: boolean }>;
  }>;
  competencyIds: string[];
  progress?: { completed: string[] };
}

interface LessonBlock {
  type: "h1" | "h2" | "p" | "code" | "quote";
  text: string;
  id?: string;
}

/** Urai isi materi menjadi blok render + daftar isi. */
function parseLessonBlocks(body: string): { blocks: LessonBlock[]; toc: Array<{ id: string; level: "h1" | "h2"; text: string }> } {
  // Konten berasal dari guru (operator); teks selalu di-escape oleh React.
  const blocks: LessonBlock[] = [];
  const toc: Array<{ id: string; level: "h1" | "h2"; text: string }> = [];
  const lines = body.split("\n");
  let inCode = false;
  let codeBuf: string[] = [];
  for (const raw of lines) {
    if (raw.trim().startsWith("```")) {
      if (inCode) { blocks.push({ type: "code", text: codeBuf.join("\n") }); codeBuf = []; inCode = false; }
      else inCode = true;
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }
    if (raw.startsWith("## ")) {
      const text = raw.slice(3);
      const id = slugify(text, `bagian-${toc.length + 1}`);
      toc.push({ id, level: "h2", text });
      blocks.push({ type: "h2", text, id });
    } else if (raw.startsWith("# ")) {
      const text = raw.slice(2);
      const id = slugify(text, `bagian-${toc.length + 1}`);
      toc.push({ id, level: "h1", text });
      blocks.push({ type: "h1", text, id });
    } else if (raw.startsWith("> ")) blocks.push({ type: "quote", text: raw.slice(2) });
    else if (raw.trim() === "") continue;
    else blocks.push({ type: "p", text: raw });
  }
  return { blocks, toc };
}

function LessonBody({ body }: { body: string }) {
  const { blocks } = parseLessonBlocks(body);
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === "h1") return <h1 key={i} id={b.id} className="font-display text-2xl font-bold mt-6 mb-2 scroll-mt-20">{b.text}</h1>;
        if (b.type === "h2") return <h2 key={i} id={b.id} className="font-display text-lg font-semibold mt-5 mb-2 scroll-mt-20">{b.text}</h2>;
        if (b.type === "code") return <CommandBlock key={i} command={b.text} label="perintah" />;
        if (b.type === "quote") return (
          <blockquote key={i} className="border-l-2 pl-3 text-sm my-3" style={{ borderColor: "var(--teal)", color: "var(--muted)" }}>
            {b.text}
          </blockquote>
        );
        return <p key={i} className="my-3 leading-relaxed">{b.text}</p>;
      })}
    </>
  );
}

function CourseToolbar({
  filter,
  idPrefix,
}: {
  filter: ReturnType<typeof useCourseFilter>;
  idPrefix: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col sm:flex-row gap-2 mb-4">
      <div className="relative flex-1">
        <Search size={15} aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--muted)" }} />
        <label htmlFor={`${idPrefix}-q`} className="sr-only">{t("courses.searchLabel")}</label>
        <input
          id={`${idPrefix}-q`}
          className="input !pl-9"
          placeholder={t("courses.searchPh")}
          value={filter.q}
          onChange={(e) => filter.setQ(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="flex gap-2">
        <label htmlFor={`${idPrefix}-status`} className="sr-only">{t("courses.filterStatus")}</label>
        <select
          id={`${idPrefix}-status`}
          className="input sm:w-auto"
          value={filter.status}
          onChange={(e) => filter.setStatus(e.target.value as CourseStatusFilter)}
        >
          <option value="all">{t("courses.filterAll")}</option>
          <option value="in-progress">{t("courses.filterInProgress")}</option>
          <option value="completed">{t("courses.filterCompleted")}</option>
          <option value="not-started">{t("courses.filterNotStarted")}</option>
        </select>
        <label htmlFor={`${idPrefix}-sort`} className="sr-only">{t("courses.sortBy")}</label>
        <select
          id={`${idPrefix}-sort`}
          className="input sm:w-auto"
          value={filter.sort}
          onChange={(e) => filter.setSort(e.target.value as CourseSort)}
        >
          <option value="progress">{t("courses.sortProgress")}</option>
          <option value="title">{t("courses.sortTitle")}</option>
          <option value="materials">{t("courses.sortMaterials")}</option>
        </select>
      </div>
    </div>
  );
}

/** Daftar kursus untuk siswa — kartu identitas visual + progres nyata. */
export function StudentCoursesPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get<{ courses: CourseSummary[] }>("/courses"),
  });
  const { detailQ } = useLearningOverview();
  const filter = useCourseFilter(params.get("q") ?? "");

  // Pencarian global di bilah atas mendarat di sini lewat ?q=.
  useEffect(() => {
    filter.setQ(params.get("q") ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const rows = courses.data?.courses ?? [];
  const enrolled = detailQ.data?.enriched ?? rows.filter((c) => c.isEnrolled).map((c) => ({
    ...c, totalLessons: 0, completedLessons: 0, nextLessonId: null, nextLessonTitle: null, nextModuleTitle: null,
  }));
  const visible = filterCourses(enrolled, filter.state);
  const otherRows = rows.filter((c) => !c.isEnrolled);
  const q = filter.q.trim().toLowerCase();
  const visibleOthers = q.length === 0 ? otherRows : otherRows.filter((c) =>
    [c.title, c.subjectName, c.className, c.teacherName]
      .filter((v): v is string => typeof v === "string")
      .join(" ")
      .toLowerCase()
      .includes(q),
  );

  return (
    <div>
      <Breadcrumbs items={[{ label: t("nav.dashboard"), to: "/student/dashboard" }, { label: t("courses.title") }]} />
      <PageHeader no={t("courses.pageNo")} title={t("courses.title")} subtitle={t("courses.subtitle")} />

      <section className="card p-5 mb-8" aria-label={t("courses.joinLabel")}>
        <div className="mb-3">
          <p className="tech-no">{t("courses.joinLabel")}</p>
          <h2 className="font-display font-semibold mt-1">{t("courses.joinTitle")}</h2>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {t("courses.joinBody")}
          </p>
        </div>
        <JoinClassForm />
      </section>

      <SectionHead
        title={`${t("courses.mine")} · ${visible.length}/${enrolled.length}`}
        action={
          visible.length > 0 ? (
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {visible.length} {t("courses.resultCount")}
            </span>
          ) : undefined
        }
      />
      <CourseToolbar filter={filter} idPrefix="crs" />
      {courses.isLoading || detailQ.isLoading ? (
        <div className="grid sm:grid-cols-2 gap-4 mb-8" aria-label={t("common.loading")}>
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
        </div>
      ) : enrolled.length === 0 ? (
        <EmptyState title={t("courses.notEnrolled")} body={t("courses.notEnrolledBody")} />
      ) : visible.length === 0 ? (
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
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {visible.map((c) => (
            <Link key={c.id} to={`/student/courses/${c.id}`} className="card overflow-hidden block transition-quiet hover:border-accent">
              <div className="h-28">
                <CourseCover courseId={c.id} label={c.subjectName ?? c.title} sublabel={c.className ?? ""} />
              </div>
              <div className="p-4">
                <h3 className="font-display font-semibold leading-snug">{c.title}</h3>
                <p className="tech-no mt-1 truncate">{[c.className, c.teacherName].filter(Boolean).join(" · ") || "—"}</p>
                <div className="mt-3">
                  <ProgressBar value={c.completedLessons} total={c.totalLessons} label={t("courses.progressLabel")} />
                </div>
                {c.nextLessonTitle && courseStatus(c) !== "completed" && (
                  <p className="text-xs mt-2 truncate" style={{ color: "var(--muted)" }}>
                    {t("courses.continueAt")}: {c.nextLessonTitle}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <h2 className="tech-no mb-3">{t("courses.others")}</h2>
      {visibleOthers.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {otherRows.length === 0 ? t("courses.noOthers") : t("courses.noResultBody")}
        </p>
      ) : (
        <ul className="space-y-2">
          {visibleOthers.map((c) => (
            <li key={c.id}>
              <Link
                to={`/student/courses/${c.id}`}
                className="card p-3 flex items-center justify-between gap-3 transition-quiet hover:border-accent"
              >
                <span className="text-sm min-w-0 truncate">{c.title}</span>
                <span className="tech-no shrink-0">{c.className ?? "—"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Detail kursus: spanduk identitas + jalur belajar timeline + progres. */
export function StudentCourseDetailPage() {
  const { courseId = "" } = useParams();
  const { t } = useI18n();
  const { detailQ } = useLearningOverview();
  const q = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => api.get<CourseDetail>(`/courses/${courseId}`),
    enabled: courseId.length > 0,
  });

  if (q.isLoading) {
    return (
      <div className="space-y-4" aria-label={t("common.loading")}>
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="card p-6" role="alert">
        <p style={{ color: "var(--danger)" }}>{t("courseDetail.loadFail")}</p>
        <Link to="/student/courses" className="btn-ghost text-sm mt-3 inline-block">{t("common.back")}</Link>
      </div>
    );
  }

  const { course, modules, progress } = q.data;
  const lessons = modules.flatMap((m) => m.lessons);
  const completed = new Set(progress?.completed ?? []);
  const doneCount = lessons.filter((l) => completed.has(l.id)).length;
  const flatIndex = new Map(lessons.map((l, i) => [l.id, i]));
  const firstTodo = lessons.find((l) => !completed.has(l.id)) ?? null;
  const meta = (detailQ.data?.enriched ?? []).find((c) => c.id === course.id);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: t("nav.dashboard"), to: "/student/dashboard" },
          { label: t("courses.title"), to: "/student/courses" },
          { label: course.title },
        ]}
      />
      <section className="card overflow-hidden mb-6" aria-label={course.title}>
        <div className="h-36 md:h-44">
          <CourseCover courseId={course.id} label={course.title} sublabel={t("courseDetail.pathBadge")} />
        </div>
        <div className="p-5 md:p-6">
          <p className="tech-no">{t("courseDetail.pathNo")}</p>
          <div className="flex flex-wrap items-start justify-between gap-3 mt-1">
            <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">{course.title}</h1>
            <Link to="/student/courses" className="btn-ghost text-sm shrink-0">{t("courseDetail.backToCourses")}</Link>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm">
            {meta?.teacherName && (
              <div className="flex items-center gap-1.5">
                <UserRound size={14} aria-hidden style={{ color: "var(--muted)" }} />
                <dt className="sr-only">{t("courseDetail.instructor")}</dt>
                <dd>{meta.teacherName}</dd>
              </div>
            )}
            {meta?.className && (
              <div className="flex items-center gap-1.5">
                <dt className="tech-no">{t("courseDetail.classLabel")}</dt>
                <dd>{meta.className}</dd>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <dt className="tech-no">{t("common.lessons")}</dt>
              <dd>{lessons.length}</dd>
            </div>
          </dl>
          <div className="mt-4 max-w-2xl">
            <h2 className="tech-no mb-1.5">{t("courseDetail.objectives")}</h2>
            <p className="text-sm max-w-2xl" style={{ color: "var(--muted)" }}>
              {course.description ?? t("courseDetail.objectivesFallback")}
            </p>
          </div>
          <div className="mt-4 max-w-md">
            <ProgressBar value={doneCount} total={lessons.length} label={t("courseDetail.progressLabel")} />
          </div>
          {firstTodo && (
            <Link
              to={`/student/lessons/${firstTodo.id}`}
              className="btn-primary text-sm inline-block mt-4"
            >
              {t("common.continue")}: {firstTodo.title}
            </Link>
          )}
        </div>
      </section>

      <ol className="space-y-5">
        {modules.map((m, i) => {
          const moduleDone = m.lessons.filter((l) => completed.has(l.id)).length;
          return (
            <li key={m.id} className="card p-5">
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <p className="tech-no">{t("courseDetail.module")} {String(i + 1).padStart(2, "0")}</p>
                <p className="font-mono2 text-xs" style={{ color: "var(--muted)" }}>
                  {moduleDone}/{m.lessons.length}
                </p>
              </div>
              <h2 className="font-display text-lg font-semibold mb-3">{m.title}</h2>
              {m.lessons.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--muted)" }}>{t("courseDetail.noMaterials")}</p>
              ) : (
                <ol className="path-rail space-y-1 pl-0">
                  {m.lessons.map((l) => {
                    const done = completed.has(l.id);
                    const state = done ? "done" : firstTodo?.id === l.id ? "current" : "todo";
                    return (
                      <li key={l.id}>
                        <Link
                          to={`/student/lessons/${l.id}`}
                          className="flex items-center gap-3 py-2 pl-0 group"
                          aria-label={`${l.title}${done ? ` ${t("courseDetail.doneSuffix")}` : firstTodo?.id === l.id ? ` ${t("courseDetail.continueSuffix")}` : ""}`}
                        >
                          <LessonStatusDot state={state as "done" | "current" | "todo"} index={flatIndex.get(l.id) ?? 0} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium truncate group-hover:underline">{l.title}</span>
                            <span className="tech-no">{l.contentType}</span>
                          </span>
                          {state === "current" && (
                            <span className="text-xs font-semibold shrink-0" style={{ color: "var(--accent)" }}>
                              {t("courseDetail.continueHere")} →
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Halaman baca materi: daftar isi, estimasi baca, navigasi, tandai selesai. */export function StudentLessonPage() {
  const { lessonId = "" } = useParams();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const lesson = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: () => api.get<{
      lesson: { id: string; title: string; contentType: string; body: string | null; isPublished: boolean };
      course: { id: string; title: string; status: string };
      prevLessonId: string | null;
      nextLessonId: string | null;
    }>(`/lessons/${lessonId}`),
    enabled: lessonId.length > 0,
  });

  const progress = useQuery({
    queryKey: ["me-progress"],
    queryFn: () => api.get<{ progress: Array<{ lessonId: string; status: string }> }>("/me/progress"),
  });

  const complete = useMutation({
    mutationFn: () => api.post(`/lessons/${lessonId}/progress`, { status: "completed" }),
    onSuccess: async () => {
      setError(null);
      setNotice(t("lesson.markedDone"));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["me-progress"] }),
        qc.invalidateQueries({ queryKey: ["course"] }),
        qc.invalidateQueries({ queryKey: ["learning-overview"] }),
      ]);
    },
    onError: (e) => setNotice(null) ?? setError(e instanceof ApiError ? e.message : t("lesson.markFail")),
  });

  const uncomplete = useMutation({
    mutationFn: () => api.post(`/lessons/${lessonId}/progress`, { status: "started" }),
    onSuccess: async () => {
      setError(null); setNotice(t("lesson.unmarked"));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["me-progress"] }),
        qc.invalidateQueries({ queryKey: ["learning-overview"] }),
      ]);
    },
    onError: (e) => setNotice(null) ?? setError(e instanceof ApiError ? e.message : t("lesson.updateFail")),
  });

  if (lesson.isLoading) {
    return (
      <div className="space-y-3 max-w-2xl" aria-label={t("common.loading")}>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (lesson.isError || !lesson.data) {
    return (
      <div className="card p-6" role="alert">
        <p style={{ color: "var(--danger)" }}>{t("lesson.loadFail")}</p>
        <Link to="/student/courses" className="btn-ghost text-sm mt-3 inline-block">{t("lesson.backToCourses")}</Link>
      </div>
    );
  }

  const data = lesson.data;
  const isDone = (progress.data?.progress ?? []).some((p) => p.lessonId === lessonId && p.status === "completed");
  const body = data.lesson.body ?? "";
  const { toc } = parseLessonBlocks(body);
  const minutes = readingMinutes(body);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: t("nav.dashboard"), to: "/student/dashboard" },
          { label: t("courses.title"), to: "/student/courses" },
          { label: data.course.title, to: `/student/courses/${data.course.id}` },
          { label: data.lesson.title },
        ]}
      />
      <div className="grid lg:grid-cols-[1fr_220px] gap-8 items-start">
        <article className="max-w-2xl w-full min-w-0">
          <p className="tech-no">
            {data.course.title.toUpperCase()} · {data.lesson.contentType.toUpperCase()}
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight mt-2">{data.lesson.title}</h1>
          <p className="flex items-center gap-1.5 text-xs mt-2 mb-6" style={{ color: "var(--muted)" }}>
            <Clock size={13} aria-hidden /> ± {minutes} {t("lesson.readingTime")}
            {isDone && <span style={{ color: "var(--ok)" }}>· {t("lesson.alreadyDone")}</span>}
          </p>

          {notice && <p role="status" className="text-sm mb-4" style={{ color: "var(--ok)" }}>{notice}</p>}
          {error && <p role="alert" className="text-sm mb-4" style={{ color: "var(--danger)" }}>{error}</p>}

          {body.trim().length === 0 ? (
            <EmptyState title={t("lesson.emptyTitle")} body={t("lesson.emptyBody")} />
          ) : (
            <div className="text-[15px] leading-relaxed">
              <LessonBody body={body} />
            </div>
          )}

          {user?.role === "siswa" && (
            <div className="flex flex-wrap items-center gap-3 mt-10 pt-6 border-t rule-line">
              <button
                className="btn-primary text-sm"
                onClick={() => complete.mutate()}
                disabled={complete.isPending || isDone}
              >
                {isDone ? t("lesson.isDone") : complete.isPending ? t("lesson.saving") : t("lesson.markDone")}
              </button>
              {isDone && (
                <button className="btn-ghost text-sm" onClick={() => uncomplete.mutate()} disabled={uncomplete.isPending}>
                  {t("lesson.cancel")}
                </button>
              )}
              <p className="text-xs basis-full sm:basis-auto" style={{ color: "var(--muted)" }}>
                {t("lesson.offlineNote")}
              </p>
            </div>
          )}

          <nav className="flex items-center justify-between gap-4 mt-8" aria-label={data.lesson.title}>
            {data.prevLessonId ? (
              <Link to={`/student/lessons/${data.prevLessonId}`} className="btn-ghost text-sm">{t("lesson.prev")}</Link>
            ) : <span />}
            <Link to={`/student/courses/${data.course.id}`} className="text-sm" style={{ color: "var(--muted)" }}>
              {t("lesson.list")}
            </Link>
            {data.nextLessonId ? (
              <Link to={`/student/lessons/${data.nextLessonId}`} className="btn-ghost text-sm">{t("lesson.next")}</Link>
            ) : <span />}
          </nav>
        </article>

        {toc.length > 0 && (
          <aside className="hidden lg:block sticky top-20" aria-label={t("lesson.toc")}>
            <p className="tech-no mb-2">{t("lesson.toc")}</p>
            <nav>
              {toc.map((item) => (
                <a key={item.id} href={`#${item.id}`} className={`toc-link ${item.level === "h1" ? "toc-link-h1" : "toc-link-h2"}`}>
                  {item.text}
                </a>
              ))}
            </nav>
            <div className="mt-4">
              <StatusPill status={isDone ? "completed" : "started"} />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/**
 * Progres baca siswa — agregat nyata per kursus.
 * Peta kompetensi berbasis aktivitas (lab/asesmen) jujur dinyatakan menyusul.
 */
export function StudentProgressPage() {
  const { t } = useI18n();
  const { coursesQ, detailQ } = useLearningOverview();
  const enriched = detailQ.data?.enriched ?? [];
  const done = detailQ.data?.done ?? 0;
  const total = detailQ.data?.total ?? 0;

  return (
    <div className="max-w-3xl">
      <Breadcrumbs items={[{ label: t("nav.dashboard"), to: "/student/dashboard" }, { label: t("placeholders.progressTitle") }]} />
      <PageHeader
        no="STD-PRG"
        title={t("placeholders.progressTitle")}
        subtitle={t("placeholders.progressBody")}
      />
      {coursesQ.isLoading || detailQ.isLoading ? (
        <div className="space-y-3" aria-label={t("common.loading")}>
          <Skeleton className="h-28" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : coursesQ.isError ? (
        <p role="alert" style={{ color: "var(--danger)" }}>{t("common.loadFail")}</p>
      ) : (
        <>
          <section className="card stat-card p-5 pl-6 mb-5" aria-label={t("placeholders.myReadingTitle")}>
            <p className="tech-no">{t("placeholders.myReadingTitle")}</p>
            <p className="font-display text-3xl font-bold mt-1">
              {done}
              <span className="text-base font-medium" style={{ color: "var(--muted)" }}>
                {" "}/ {total} {t("common.lessons")}
              </span>
            </p>
            <div className="mt-3 max-w-md">
              <ProgressBar value={done} total={total} label={t("dashboard.stats.overall")} />
            </div>
          </section>
          <ol className="space-y-3">
            {enriched.map((c) => (
              <li key={c.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display font-semibold leading-snug">{c.title}</h2>
                    <p className="tech-no mt-0.5 truncate">
                      {[c.className, c.teacherName].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <Link
                    to={`/student/courses/${c.id}`}
                    className="text-sm font-medium shrink-0"
                    style={{ color: "var(--accent)" }}
                  >
                    {t("common.open")} →
                  </Link>
                </div>
                <div className="mt-3">
                  <ProgressBar value={c.completedLessons} total={c.totalLessons} label={t("courses.progressLabel")} />
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
