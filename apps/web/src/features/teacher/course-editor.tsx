import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { useI18n } from "../../lib/I18nContext";
import { EmptyState, FieldError, PageHeader, StatusPill } from "../../components/design-system/primitives";
import { useAuth } from "../auth/AuthContext";

interface CourseDetail {
  course: {
    id: string; title: string; description: string | null; status: "draft" | "published" | "archived";
    subjectId: string | null; classId: string | null; teacherId: string | null;
  };
  modules: Array<{
    id: string; title: string; position: number;
    lessons: Array<{ id: string; title: string; contentType: string; position: number; isPublished: boolean; body: string | null }>;
  }>;
  competencyIds: string[];
}

/** Editor kursus: modul, materi, status terbit. */
export function CourseEditorPage() {
  const { courseId = "" } = useParams();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { t } = useI18n();
  const detail = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => api.get<CourseDetail>(`/courses/${courseId}`),
    enabled: courseId.length > 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [moduleTitle, setModuleTitle] = useState("");
  const [lessonForms, setLessonForms] = useState<Record<string, { title: string; body: string }>>({});

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["course", courseId] });

  const addModule = useMutation({
    mutationFn: (title: string) => api.post(`/courses/${courseId}/modules`, { title }),
    onSuccess: () => { setModuleTitle(""); setError(null); setNotice(t("teacher.moduleAdded")); invalidate(); },
    onError: (e) => setError(e instanceof ApiError ? e.message : t("teacher.moduleAddFail")),
  });

  const setStatus = useMutation({
    mutationFn: (status: "draft" | "published" | "archived") =>
      api.post(`/courses/${courseId}/status`, { status }),
    onSuccess: (_res, status) => {
      setError(null);
      setNotice(status === "published" ? t("teacher.publishedMsg") : t("teacher.statusUpdated"));
      void qc.invalidateQueries({ queryKey: ["courses"] });
      invalidate();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : t("teacher.statusFail")),
  });

  const addLesson = useMutation({
    mutationFn: (v: { moduleId: string; title: string; contentType: string; body: string }) =>
      api.post("/lessons", v),
    onSuccess: () => { setError(null); setNotice(t("teacher.lessonAdded")); invalidate(); },
    onError: (e) => setError(e instanceof ApiError ? e.message : t("teacher.lessonAddFail")),
  });

  const removeLesson = useMutation({
    mutationFn: (id: string) => api.del(`/lessons/${id}`),
    onSuccess: () => { setNotice(t("teacher.lessonDeleted")); invalidate(); },
    onError: (e) => setError(e instanceof ApiError ? e.message : t("teacher.lessonDelFail")),
  });

  const removeModule = useMutation({
    mutationFn: (id: string) => api.del(`/modules/${id}`),
    onSuccess: () => { setNotice(t("teacher.moduleDeleted")); invalidate(); },
    onError: (e) => setError(e instanceof ApiError ? e.message : t("teacher.moduleDelFail")),
  });

  if (detail.isLoading) return <p role="status">{t("common.loading")}</p>;
  if (detail.isError || !detail.data) {
    return (
      <div className="card p-6" role="alert">
        <p style={{ color: "var(--danger)" }}>{t("teacher.loadFail")}</p>
        <Link to="/teacher/courses" className="btn-ghost text-sm mt-3 inline-block">{t("teacher.backToList")}</Link>
      </div>
    );
  }

  const { course, modules } = detail.data;
  const isOwner = user?.role === "admin" || course.teacherId === user?.id;

  function confirmDelete(kind: "lesson" | "module", run: () => void) {
    const label = kind === "lesson" ? t("teacher.delete") : t("teacher.deleteModule");
    if (window.confirm(`${label}?`)) run();
  }

  return (
    <div>
      <PageHeader
        no={t("teacher.editorNo")}
        title={course.title}
        subtitle={course.description ?? t("teacher.noDescription")}
        action={<Link to="/teacher/courses" className="btn-ghost text-sm">{t("teacher.allCourses")}</Link>}
      />

      {notice && <p role="status" className="text-sm mb-4" style={{ color: "var(--ok)" }}>{notice}</p>}
      {error && <p role="alert" className="text-sm mb-4" style={{ color: "var(--danger)" }}>{error}</p>}
      {!isOwner && (
        <p className="text-sm mb-4" style={{ color: "var(--warn)" }}>
          {t("teacher.readOnly")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <StatusPill status={course.status} />
        {isOwner && (
          <>
            <button className="btn-ghost text-sm" onClick={() => setStatus.mutate("published")} disabled={setStatus.isPending}>
              {t("teacher.publish")}
            </button>
            <button className="btn-ghost text-sm" onClick={() => setStatus.mutate("draft")} disabled={setStatus.isPending}>
              {t("teacher.toDraft")}
            </button>
            <button className="btn-ghost text-sm" onClick={() => setStatus.mutate("archived")} disabled={setStatus.isPending}>
              {t("teacher.archive")}
            </button>
          </>
        )}
      </div>

      {modules.length === 0 ? (
        <EmptyState title={t("teacher.noModules")} body={t("teacher.noModulesBody")} />
      ) : (
        <ol className="space-y-4">
          {modules.map((m, i) => (
            <li key={m.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="tech-no">{t("teacher.moduleN")} {String(i + 1).padStart(2, "0")}</p>
                  <h2 className="font-display text-lg font-semibold mt-0.5">{m.title}</h2>
                </div>
                {isOwner && (
                  <button className="btn-ghost text-xs" onClick={() => confirmDelete("module", () => removeModule.mutate(m.id))} disabled={removeModule.isPending}>
                    {t("teacher.deleteModule")}
                  </button>
                )}
              </div>

              <ul className="mt-3 space-y-1.5">
                {m.lessons.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-1.5 border-b rule-line last:border-0">
                    <span className="text-sm">
                      {l.title}
                      <span className="ml-2 tech-no">{l.contentType}{l.isPublished ? "" : ` · ${t("teacher.draftTag")}`}</span>
                    </span>
                    {isOwner && (
                      <button className="btn-ghost text-xs" onClick={() => confirmDelete("lesson", () => removeLesson.mutate(l.id))} disabled={removeLesson.isPending}>
                        {t("teacher.delete")}
                      </button>
                    )}
                  </li>
                ))}
                {m.lessons.length === 0 && (
                  <li className="text-sm py-1.5" style={{ color: "var(--muted)" }}>{t("teacher.noLessons")}</li>
                )}
              </ul>

              {isOwner && (
                <form
                  className="mt-3 grid sm:grid-cols-[1fr_1.6fr_auto] gap-2 items-end"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = lessonForms[m.id] ?? { title: "", body: "" };
                    if (f.title.trim().length < 3) { setError(t("teacher.lessonMin")); return; }
                    addLesson.mutate({ moduleId: m.id, title: f.title.trim(), contentType: "article", body: f.body });
                    setLessonForms((prev) => ({ ...prev, [m.id]: { title: "", body: "" } }));
                  }}
                  noValidate
                >
                  <div>
                    <label htmlFor={`lt-${m.id}`} className="text-xs font-medium">{t("teacher.lessonTitleLabel")}</label>
                    <input
                      id={`lt-${m.id}`}
                      className="input mt-1"
                      value={lessonForms[m.id]?.title ?? ""}
                      onChange={(e) => setLessonForms((p) => ({ ...p, [m.id]: { title: e.target.value, body: p[m.id]?.body ?? "" } }))}
                    />
                  </div>
                  <div>
                    <label htmlFor={`lb-${m.id}`} className="text-xs font-medium">{t("teacher.lessonBodyLabel")}</label>
                    <input
                      id={`lb-${m.id}`}
                      className="input mt-1"
                      value={lessonForms[m.id]?.body ?? ""}
                      onChange={(e) => setLessonForms((p) => ({ ...p, [m.id]: { body: e.target.value, title: p[m.id]?.title ?? "" } }))}
                    />
                  </div>
                  <button type="submit" className="btn-primary text-sm" disabled={addLesson.isPending}>{t("teacher.addLesson")}</button>
                </form>
              )}
            </li>
          ))}
        </ol>
      )}

      {isOwner && (
        <form
          className="card p-5 mt-6 flex gap-3 items-end"
          onSubmit={(e) => { e.preventDefault(); if (moduleTitle.trim().length < 3) { setError(t("teacher.moduleMin")); return; } addModule.mutate(moduleTitle.trim()); }}
          noValidate
        >
          <div className="flex-1">
            <label htmlFor="nm-title" className="text-sm font-medium">{t("teacher.newModule")}</label>
            <input id="nm-title" className="input mt-1" placeholder={t("teacher.newModulePh")} value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} aria-invalid={!!error} />
          </div>
          <button type="submit" className="btn-primary text-sm" disabled={addModule.isPending}>{t("teacher.addModule")}</button>
        </form>
      )}
    </div>
  );
}
