import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, ApiError } from "../../lib/api";
import { useI18n } from "../../lib/I18nContext";
import { EmptyState, FieldError, PageHeader, StatusPill } from "../../components/design-system/primitives";
import { CourseCover } from "../../components/design-system/CourseCover";


interface CourseRow {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  subjectName: string | null;
  className: string | null;
  teacherName: string | null;
}

/** Daftar kursus milik guru (atau semua kursus untuk admin). */
export function TeacherCoursesPage({ scope }: { scope: "teacher" | "admin" }) {
  const qc = useQueryClient();
  const { t } = useI18n();
  const courses = useQuery({ queryKey: ["courses"], queryFn: () => api.get<{ courses: CourseRow[] }>("/courses") });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const CourseForm = z.object({
    title: z.string().min(5, t("teacher.titleMin5")).max(200),
    description: z.string().max(5000).optional(),
  });

  const form = useForm<z.infer<typeof CourseForm>>({
    resolver: zodResolver(CourseForm),
    defaultValues: { title: "", description: "" },
  });

  const create = useMutation({
    mutationFn: async (v: z.infer<typeof CourseForm>) => {
      // Ambil referensi aktif: mapel pertama & kelas pertama yang tersedia.
      const [subjects, classes] = await Promise.all([
        api.get<{ subjects: Array<{ id: string }> }>("/subjects"),
        api.get<{ classes: Array<{ id: string }> }>("/classes"),
      ]);
      const subjectId = subjects.subjects[0]?.id;
      const classId = classes.classes[0]?.id;
      if (!subjectId || !classId) {
        throw new ApiError(409, t("teacher.needRefs"));
      }
      return api.post<{ course: CourseRow }>("/courses", { ...v, subjectId, classId });
    },
    onSuccess: (res) => {
      setError(null);
      setNotice(t("teacher.draftMade"));
      form.reset();
      setCreating(false);
      void qc.invalidateQueries({ queryKey: ["courses"] });
      window.location.assign(`/teacher/courses/${res.course.id}/edit`);
    },
    onError: (e) => {
      setNotice(null);
      setError(e instanceof ApiError ? e.message : t("teacher.createFail"));
    },
  });

  const rows = courses.data?.courses ?? [];
  // Pencarian global di bilah atas mendarat di sini lewat ?q=.
  const [params, setParams] = useSearchParams();
  const q = (params.get("q") ?? "").trim().toLowerCase();
  const shown = q.length === 0 ? rows : rows.filter((c) =>
    [c.title, c.subjectName, c.className, c.teacherName]
      .filter((v): v is string => typeof v === "string")
      .join(" ")
      .toLowerCase()
      .includes(q),
  );

  return (
    <div>
      <PageHeader
        no={scope === "teacher" ? t("teacher.coursesNo") : "ADM-05 · KURSUS"}
        title={t("teacher.coursesTitle")}
        subtitle={t("teacher.coursesSub")}
        action={
          <button className="btn-primary text-sm" onClick={() => setCreating((v) => !v)}>
            {creating ? t("teacher.close") : t("teacher.newCourse")}
          </button>
        }
      />

      {notice && <p role="status" className="text-sm mb-4" style={{ color: "var(--ok)" }}>{notice}</p>}
      {error && <p role="alert" className="text-sm mb-4" style={{ color: "var(--danger)" }}>{error}</p>}

      {creating && (
        <form
          className="card p-5 mb-6 space-y-4"
          onSubmit={form.handleSubmit((v) => create.mutate(v))}
          noValidate
          aria-label={t("teacher.newFormTitle")}
        >
          <div>
            <label htmlFor="c-title" className="text-sm font-medium">{t("teacher.courseTitleLabel")}</label>
            <input id="c-title" className="input mt-1" placeholder={t("teacher.courseTitlePh")} aria-invalid={!!form.formState.errors.title} {...form.register("title")} />
            <FieldError message={form.formState.errors.title?.message ?? undefined} />
          </div>
          <div>
            <label htmlFor="c-desc" className="text-sm font-medium">{t("teacher.courseDescLabel")}</label>
            <textarea id="c-desc" rows={3} className="input mt-1" {...form.register("description")} />
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              {t("teacher.courseDescNote")}
            </p>
          </div>
          <button type="submit" className="btn-primary text-sm" disabled={create.isPending}>
            {create.isPending ? t("teacher.creating") : t("teacher.createDraft")}
          </button>
        </form>
      )}

      {courses.isLoading ? (
        <p role="status">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <EmptyState title={t("teacher.noCourses")} body={t("teacher.noCoursesBody2")} />
      ) : (
        <>
          {q.length > 0 && (
            <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>
              {t("teacher.searchResult")} “{params.get("q")}” — {shown.length} / {rows.length}.{" "}
              <button className="underline" onClick={() => setParams({})}>{t("teacher.reset")}</button>
            </p>
          )}
          {shown.length === 0 ? (
            <EmptyState title={t("teacher.noMatch")} body={t("teacher.noMatchBody")} />
          ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {shown.map((c) => (
            <article key={c.id} className="card overflow-hidden flex flex-col transition-quiet hover:border-accent">
              <div className="h-28">
                <CourseCover
                  courseId={c.id}
                  label={c.subjectName ?? c.title}
                  sublabel={[c.className, c.status === "published" ? t("teacher.published").toUpperCase() : c.status.toUpperCase()].filter(Boolean).join(" · ")}
                />
              </div>
              <div className="p-4 flex flex-col gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <StatusPill status={c.status} />
                </div>
                <h2 className="font-display font-semibold leading-snug">{c.title}</h2>
                {c.description && (
                  <p className="text-sm line-clamp-2" style={{ color: "var(--muted)" }}>{c.description}</p>
                )}
                <div className="mt-auto pt-2">
                  <Link to={`/teacher/courses/${c.id}/edit`} className="text-sm font-medium" style={{ color: "var(--accent)" }}>
                    {t("teacher.manageLessons")} →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
          )}
        </>
      )}

      {scope === "teacher" && (
        <p className="text-sm mt-6" style={{ color: "var(--muted)" }}>
          {t("teacher.announceHint")} <Link to="/teacher/announcements" className="underline">{t("teacher.announceMenu")}</Link>.
        </p>
      )}
    </div>
  );
}
