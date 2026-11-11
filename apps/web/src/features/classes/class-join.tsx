import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { JoinClassSchema } from "@simpul/shared";
import { api, ApiError } from "../../lib/api";
import { useI18n } from "../../lib/I18nContext";
import { useAuth } from "../auth/AuthContext";
import { EmptyState, FieldError, PageHeader } from "../../components/design-system/primitives";

interface JoinPreview {
  class: { id: string; name: string; grade: string; major: string; homeroomTeacherName: string | null };
  isMember: boolean;
  publishedCourseCount: number;
}

/** Formulir gabung kelas — dipakai ulang di halaman kursus & halaman tautan. */
export function JoinClassForm({ initialCode = "", onJoined }: { initialCode?: string; onJoined?: () => void }) {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const join = useMutation({
    mutationFn: (c: string) =>
      api.post<{ already: boolean; class: { name: string }; enrolledCourses: number }>("/classes/join", { code: c }),
    onSuccess: (res) => {
      setError(null);
      setNotice(
        res.already
          ? `${t("join.alreadyIn")} ${res.class.name}.`
          : `${t("join.joinedNew")} ${res.class.name}. ${res.enrolledCourses} ${t("join.coursesAdded")}`,
      );
      void qc.invalidateQueries({ queryKey: ["courses"] });
      void qc.invalidateQueries({ queryKey: ["teaching-classes"] });
      void qc.invalidateQueries({ queryKey: ["my-classes"] });
      onJoined?.();
    },
    onError: (e) => {
      setNotice(null);
      setError(e instanceof ApiError ? e.message : t("join.fail"));
    },
  });

  return (
    <form
      className="flex flex-col sm:flex-row gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = JoinClassSchema.safeParse({ code });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? t("join.invalid"));
          return;
        }
        join.mutate(parsed.data.code);
      }}
      noValidate
      aria-label={t("courses.joinLabel")}
    >
      <div className="flex-1">
        <label htmlFor="join-code" className="sr-only">{t("join.codeLabel")}</label>
        <input
          id="join-code"
          className="input font-mono2 uppercase tracking-[0.2em]"
          placeholder={t("join.codePh")}
          maxLength={12}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-invalid={!!error}
          autoComplete="off"
        />
      </div>
      <button type="submit" className="btn-primary text-sm whitespace-nowrap" disabled={join.isPending}>
        {join.isPending ? t("join.checking") : t("join.submit")}
      </button>
      {notice && <p role="status" className="text-sm sm:basis-full" style={{ color: "var(--ok)" }}>{notice}</p>}
      {error && <FieldError message={error} />}
    </form>
  );
}

/** Halaman tujuan tautan gabung (/join/:code): pratinjau kelas + tombol gabung. */
export function JoinClassPage() {
  const { code = "" } = useParams();
  const { user } = useAuth();
  const { t } = useI18n();
  const preview = useQuery({
    queryKey: ["class-preview", code],
    queryFn: () => api.get<JoinPreview>(`/classes/code/${encodeURIComponent(code)}`),
    enabled: code.length > 0,
    retry: false,
  });

  return (
    <div className="max-w-xl mx-auto">
      <PageHeader no={t("join.previewNo")} title={t("join.previewTitle")} subtitle={`${t("join.inviteCode")}: ${code.toUpperCase()}`} />

      {preview.isLoading ? (
        <p role="status">{t("common.loading")}</p>
      ) : preview.isError || !preview.data ? (
        <EmptyState
          title={t("join.notFoundTitle")}
          body={t("join.notFoundBody")}
          action={<Link to="/student/courses" className="btn-ghost text-sm">{t("join.backToCourses")}</Link>}
        />
      ) : user?.role !== "siswa" ? (
        <div className="card p-5" role="note">
          <p className="text-sm">
            {t("join.wrongRole")} <strong>{preview.data.class.name}</strong>.
          </p>
        </div>
      ) : (
        <div className="card p-5 space-y-4">
          <div>
            <p className="tech-no">{t("join.classOf")} {preview.data.class.grade}</p>
            <h2 className="font-display text-xl font-bold mt-1">{preview.data.class.name}</h2>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              {[preview.data.class.major, preview.data.class.homeroomTeacherName ? `${t("join.homeroom")}: ${preview.data.class.homeroomTeacherName}` : null]
                .filter(Boolean)
                .join(" · ")}
              {" · "}
              {preview.data.publishedCourseCount} {t("join.publishedCourses")}
            </p>
          </div>
          {preview.data.isMember ? (
            <div role="status" className="text-sm" style={{ color: "var(--ok)" }}>
              {t("join.alreadyMember")}{" "}
              <Link to="/student/courses" className="underline">{t("join.openCourses")}</Link>
            </div>
          ) : (
            <>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {t("join.afterJoin")}
              </p>
              <JoinClassForm initialCode={code} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
