import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { useI18n } from "../../lib/I18nContext";
import { CopyButton, EmptyState, FieldError, PageHeader } from "../../components/design-system/primitives";
import { joinLink } from "../admin/admin-pages";

interface TeachingClass {
  id: string;
  name: string;
  grade: string;
  major: string;
  academicYearName: string | null;
  homeroomTeacherName: string | null;
  joinCode: string;
  memberCount: number;
  courseCount: number;
}

/**
 * Kelas yang diajar guru: kode gabung + tautan untuk dibagikan ke siswa,
 * beserta jumlah anggota yang sudah bergabung.
 */
export function TeacherClassesPage() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const classes = useQuery({
    queryKey: ["teaching-classes"],
    queryFn: () => api.get<{ classes: TeachingClass[] }>("/classes/mine"),
  });
  const years = useQuery({
    queryKey: ["academic-years"],
    queryFn: () => api.get<{ academicYears: Array<{ id: string; name: string; isActive: boolean }> }>("/academic-years"),
  });
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<"X" | "XI" | "XII">("XI");
  const [yearId, setYearId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const rows = classes.data?.classes ?? [];

  useEffect(() => {
    const active = years.data?.academicYears.find((y) => y.isActive);
    if (active && !yearId) setYearId(active.id);
  }, [years.data, yearId]);

  const create = useMutation({
    mutationFn: () =>
      api.post<{ class: TeachingClass & { joinCode: string } }>("/classes", {
        name: name.trim(),
        grade,
        major: "TKJ",
        academicYearId: yearId,
      }),
    onSuccess: (res) => {
      setError(null);
      setNotice(`${t("teacher.classCreatedA")} ${res.class.name} ${t("teacher.classCreatedB")} ${res.class.joinCode} ${t("teacher.shareIt")}`);
      setName("");
      setCreating(false);
      void qc.invalidateQueries({ queryKey: ["teaching-classes"] });
    },
    onError: (e) => {
      setNotice(null);
      setError(e instanceof ApiError ? e.message : t("teacher.createClassFail"));
    },
  });

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    <div>
      <PageHeader
        no={t("teacher.classesNo")}
        title={t("teacher.myClasses")}
        subtitle={t("teacher.myClassesSub")}
        action={
          <button className="btn-primary text-sm" onClick={() => setCreating((v) => !v)}>
            {creating ? t("teacher.close") : t("teacher.createClass")}
          </button>
        }
      />

      {notice && <p role="status" className="text-sm mb-4" style={{ color: "var(--ok)" }}>{notice}</p>}
      {error && <p role="alert" className="text-sm mb-4" style={{ color: "var(--danger)" }}>{error}</p>}

      {creating && (
        <form
          className="card p-5 mb-6 grid sm:grid-cols-4 gap-4 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length < 3) { setError(t("teacher.classMin")); return; }
            if (!yearId) { setError(t("teacher.yearRequired")); return; }
            create.mutate();
          }}
          noValidate
          aria-label={t("teacher.newClassForm")}
        >
          <div className="sm:col-span-2">
            <label htmlFor="tk-name" className="text-sm font-medium">{t("teacher.classNameLabel")}</label>
            <input id="tk-name" className="input mt-1" placeholder={t("teacher.classNamePh")} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!error} />
          </div>
          <div>
            <label htmlFor="tk-grade" className="text-sm font-medium">{t("teacher.gradeLabel")}</label>
            <select id="tk-grade" className="input mt-1" value={grade} onChange={(e) => setGrade(e.target.value as "X" | "XI" | "XII")}>
              <option value="X">X</option>
              <option value="XI">XI</option>
              <option value="XII">XII</option>
            </select>
          </div>
          <div>
            <label htmlFor="tk-year" className="text-sm font-medium">{t("teacher.yearLabel")}</label>
            <select id="tk-year" className="input mt-1" value={yearId} onChange={(e) => setYearId(e.target.value)}>
              <option value="">{t("teacher.pickYear")}</option>
              {(years.data?.academicYears ?? []).map((y) => (
                <option key={y.id} value={y.id}>{y.name}{y.isActive ? ` (${t("teacher.activeTag")})` : ""}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-4">
            <button type="submit" className="btn-primary text-sm" disabled={create.isPending}>
              {create.isPending ? t("teacher.creating") : t("teacher.createAsHomeroom")}
            </button>
            {error && <FieldError message={error} />}
          </div>
        </form>
      )}

      {classes.isLoading ? (
        <p role="status">{t("teacher.loadingClasses")}</p>
      ) : classes.isError ? (
        <p role="alert" style={{ color: "var(--danger)" }}>{t("teacher.classesFail")}</p>
      ) : rows.length === 0 && !creating ? (
        <EmptyState
          title={t("teacher.noMyClasses")}
          body={t("teacher.noMyClassesBody")}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((c) => (
            <article key={c.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="tech-no">{t("teacher.classN")} · {c.grade}</p>
                  <h2 className="font-display text-lg font-semibold mt-0.5">{c.name}</h2>
                  <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
                    {[c.major, c.academicYearName, c.homeroomTeacherName ? `${t("teacher.homeroom")}: ${c.homeroomTeacherName}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tech-no">{t("teacher.joinedStudents")}</p>
                  <p className="font-display text-2xl font-bold">{c.memberCount}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t rule-line grid sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <span className="tech-no">{t("teacher.codeTag")}</span>
                  <code className="font-mono2 text-base font-semibold tracking-[0.2em] px-2.5 py-1 rounded border rule-line" style={{ background: "var(--paper)" }}>
                    {c.joinCode}
                  </code>
                  <CopyButton text={c.joinCode} label={`${t("teacher.copyCode")} ${c.name}`} />
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="tech-no shrink-0">{t("teacher.linkTag")}</span>
                  <code className="font-mono2 text-xs truncate" style={{ color: "var(--muted)" }}>
                    {joinLink(c.joinCode)}
                  </code>
                  <CopyButton text={joinLink(c.joinCode)} label={`${t("teacher.copyLink")} ${c.name}`} />
                </div>
              </div>
              <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
                {c.courseCount} {t("teacher.coursesInClassA")}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
