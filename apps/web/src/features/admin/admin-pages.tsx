import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, ApiError } from "../../lib/api";
import { useI18n } from "../../lib/I18nContext";
import { CopyButton, EmptyState, FieldError, PageHeader, PasswordInput, StatusPill } from "../../components/design-system/primitives";
import { useAuth } from "../auth/AuthContext";

/* ---------------------------------------------------------------- pengguna */

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "guru" | "siswa";
}

export function AdminUsersPage() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const { user: me } = useAuth();
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => api.get<{ users: AdminUser[] }>("/users") });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const CreateUserForm = z.object({
    email: z.string().email(t("admin.badEmail")).max(160),
    name: z.string().min(3, t("admin.nameMin")).max(120),
    password: z.string().min(8, t("admin.pwMin")).max(128),
    role: z.enum(["admin", "guru", "siswa"]),
  });

  const form = useForm<z.infer<typeof CreateUserForm>>({
    resolver: zodResolver(CreateUserForm),
    defaultValues: { email: "", name: "", password: "", role: "siswa" },
  });

  const create = useMutation({
    mutationFn: (values: z.infer<typeof CreateUserForm>) => api.post<{ user: AdminUser }>("/users", values),
    onSuccess: () => {
      setError(null);
      setNotice(t("admin.accountMade"));
      form.reset();
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => {
      setNotice(null);
      setError(e instanceof ApiError ? e.message : t("admin.accountFail"));
    },
  });

  const toggleActive = useMutation({
    mutationFn: (v: { id: string; isActive: boolean }) =>
      api.patch<{ user: AdminUser }>(`/users/${v.id}`, { isActive: v.isActive }),
    onSuccess: () => {
      setError(null);
      setNotice(t("admin.statusUpdated"));
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : t("admin.statusFail")),
  });

  function confirmDeactivate(name: string, run: () => void) {
    if (window.confirm(`${t("admin.deactivate")} — ${name}?`)) run();
  }

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const rows = users.data?.users ?? [];
  const roleName = (r: AdminUser["role"]) =>
    r === "admin" ? t("admin.roleNames.admin") : r === "guru" ? t("admin.roleNames.guru") : t("admin.roleNames.siswa");

  return (
    <div>
      <PageHeader
        no={t("admin.usersNo")}
        title={t("admin.usersTitle")}
        subtitle={t("admin.usersSub")}
        action={<Link to="/admin/classes" className="btn-ghost text-sm">{t("admin.manageClasses")}</Link>}
      />

      <form
        className="card p-5 mb-6 grid sm:grid-cols-2 gap-4"
        onSubmit={form.handleSubmit((v) => create.mutate(v))}
        noValidate
        aria-label={t("admin.newUserForm")}
      >
        <div>
          <label htmlFor="nu-name" className="text-sm font-medium">{t("admin.fullName")}</label>
          <input id="nu-name" className="input mt-1" aria-invalid={!!form.formState.errors.name} {...form.register("name")} />
          <FieldError message={form.formState.errors.name?.message ?? undefined} />
        </div>
        <div>
          <label htmlFor="nu-email" className="text-sm font-medium">{t("admin.emailLabel")}</label>
          <input id="nu-email" type="email" className="input mt-1" aria-invalid={!!form.formState.errors.email} {...form.register("email")} />
          <FieldError message={form.formState.errors.email?.message ?? undefined} />
        </div>
        <div>
          <label htmlFor="nu-pw" className="text-sm font-medium">{t("admin.initialPw")}</label>
          <PasswordInput id="nu-pw" autoComplete="new-password" aria-invalid={!!form.formState.errors.password} {...form.register("password")} />
          <FieldError message={form.formState.errors.password?.message ?? undefined} />
        </div>
        <div>
          <label htmlFor="nu-role" className="text-sm font-medium">{t("admin.roleLabel")}</label>
          <select id="nu-role" className="input mt-1" {...form.register("role")}>
            <option value="siswa">{t("admin.roleNames.siswa")}</option>
            <option value="guru">{t("admin.roleNames.guru")}</option>
            <option value="admin">{t("admin.roleNames.admin")}</option>
          </select>
        </div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button type="submit" className="btn-primary text-sm" disabled={create.isPending}>
            {create.isPending ? t("admin.saving") : t("admin.createAccount")}
          </button>
          {notice && <p role="status" className="text-sm" style={{ color: "var(--ok)" }}>{notice}</p>}
          {error && <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
        </div>
      </form>

      {users.isLoading ? (
        <p role="status">{t("admin.loadingUsers")}</p>
      ) : users.isError ? (
        <p role="alert" style={{ color: "var(--danger)" }}>{t("admin.usersFail")}</p>
      ) : rows.length === 0 ? (
        <EmptyState title={t("admin.noUsers")} body={t("admin.noUsersBody")} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{t("admin.userTable")}</caption>
            <thead>
              <tr className="text-left border-b rule-line">
                <th scope="col" className="px-4 py-2.5 tech-no">{t("admin.colName")}</th>
                <th scope="col" className="px-4 py-2.5 tech-no">{t("admin.colEmail")}</th>
                <th scope="col" className="px-4 py-2.5 tech-no">{t("admin.colRole")}</th>
                <th scope="col" className="px-4 py-2.5 tech-no sr-only">{t("admin.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b rule-line last:border-0">
                  <td className="px-4 py-3">
                    <span className="font-medium">{u.name}</span>
                    {u.id === me?.id && <span className="ml-2 tech-no">({t("admin.youTag")})</span>}
                  </td>
                  <td className="px-4 py-3 font-mono2 text-xs" style={{ color: "var(--muted)" }}>{u.email}</td>
                  <td className="px-4 py-3 capitalize">{roleName(u.role)}</td>
                  <td className="px-4 py-3">
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => confirmDeactivate(u.name, () => toggleActive.mutate({ id: u.id, isActive: false }))}
                      disabled={toggleActive.isPending}
                    >
                      {t("admin.deactivate")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- kelas */

interface AcademicYear { id: string; name: string; isActive: boolean }
interface ClassRow {
  id: string;
  name: string;
  grade: string;
  major: string;
  academicYearId: string | null;
  homeroomTeacherId: string | null;
  homeroomTeacherName: string | null;
  joinCode: string;
  memberCount: number;
  courseCount: number;
}

interface DirectoryUser { id: string; name: string; email: string }
interface ClassMember { id: string; name: string; email: string; joinedAt: string }

/** Editor wali + anggota kelas (dipakai admin pada kartu kelas). */
function ClassMemberEditor({
  classId,
  currentWaliId,
  gurus,
  siswas,
  onSaved,
}: {
  classId: string;
  currentWaliId: string | null;
  gurus: DirectoryUser[];
  siswas: DirectoryUser[];
  onSaved: (message: string) => void;
}) {
  const qc = useQueryClient();
  const { t } = useI18n();
  const members = useQuery({
    queryKey: ["class-members", classId],
    queryFn: () => api.get<{ members: ClassMember[] }>(`/classes/${classId}/members`),
  });
  const [wali, setWali] = useState(currentWaliId ?? "");
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = members.data?.members ?? [];
  // Inisialisasi pilihan dari data server sekali dimuat.
  const checked = selected ?? new Set(current.map((m) => m.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const base = prev ?? new Set(current.map((m) => m.id));
      const next = new Set(base);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const save = useMutation({
    mutationFn: () =>
      api.patch<{ ok: boolean }>(`/classes/${classId}`, {
        homeroomTeacherId: wali,
        studentIds: [...checked],
      }),
    onSuccess: () => {
      setError(null);
      setSelected(null);
      onSaved(`${t("admin.membersSavedA")} (${checked.size} ${t("admin.membersSavedB")}).`);
      void qc.invalidateQueries({ queryKey: ["class-members", classId] });
      void qc.invalidateQueries({ queryKey: ["admin-classes"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : t("admin.membersFail")),
  });

  return (
    <div className="mt-3 pt-3 border-t rule-line space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`wali-${classId}`} className="text-sm font-medium">{t("admin.homeroomLabel")}</label>
          <select id={`wali-${classId}`} className="input mt-1" value={wali} onChange={(e) => setWali(e.target.value)}>
            <option value="">{t("admin.noHomeroom")}</option>
            {gurus.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div className="text-sm self-end" style={{ color: "var(--muted)" }}>
          {members.isLoading ? t("admin.loadingMembers") : `${current.length} ${t("admin.registeredStudents")}`}
        </div>
      </div>
      <fieldset>
        <legend className="text-sm font-medium mb-2">{t("admin.memberStudents")} ({checked.size} {t("admin.selected")})</legend>
        {siswas.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>{t("admin.noSiswa")}</p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-1.5 max-h-55 overflow-y-auto pr-1">
            {siswas.map((s) => (
              <li key={s.id}>
                <label className="flex items-center gap-2.5 text-sm card !rounded-lg px-3 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked.has(s.id)}
                    onChange={() => toggle(s.id)}
                    className="w-4 h-4 accent-[#DE653F]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.name}</span>
                    <span className="block truncate font-mono2 text-[11px]" style={{ color: "var(--muted)" }}>{s.email}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary text-sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? t("admin.saving") : t("admin.saveMembers")}
        </button>
        {error && <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
      </div>
    </div>
  );
}

/** Tautan gabung kelas yang dibagikan ke siswa. */
export function joinLink(code: string): string {
  return `${window.location.origin}/join/${code}`;
}

export function AdminClassesPage() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const years = useQuery({ queryKey: ["academic-years"], queryFn: () => api.get<{ academicYears: AcademicYear[] }>("/academic-years") });
  const classes = useQuery({ queryKey: ["admin-classes"], queryFn: () => api.get<{ classes: ClassRow[] }>("/classes") });
  const gurus = useQuery({ queryKey: ["directory-guru"], queryFn: () => api.get<{ users: DirectoryUser[] }>("/users/by-role?role=guru") });
  const siswas = useQuery({ queryKey: ["directory-siswa"], queryFn: () => api.get<{ users: DirectoryUser[] }>("/users/by-role?role=siswa") });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newStudents, setNewStudents] = useState<Set<string>>(new Set());
  const [managingId, setManagingId] = useState<string | null>(null);

  const ClassForm = z.object({
    name: z.string().min(3, t("teacher.classMin")).max(120),
    grade: z.enum(["X", "XI", "XII"]),
    major: z.string().min(2).max(60),
    academicYearId: z.string().min(1, t("teacher.yearRequired")),
    homeroomTeacherId: z.string().max(64).optional(),
  });

  const form = useForm<z.infer<typeof ClassForm>>({
    resolver: zodResolver(ClassForm),
    defaultValues: { name: "", grade: "XI", major: "TKJ", academicYearId: "", homeroomTeacherId: "" },
  });

  // Default ke tahun ajaran aktif begitu dimuat.
  useEffect(() => {
    const active = years.data?.academicYears.find((y) => y.isActive);
    if (active && !form.getValues("academicYearId")) form.setValue("academicYearId", active.id);
  }, [years.data, form]);

  const create = useMutation({
    mutationFn: (v: z.infer<typeof ClassForm>) =>
      api.post<{ class: ClassRow }>("/classes", { ...v, studentIds: [...newStudents] }),
    onSuccess: (res) => {
      setError(null);
      setNotice(`${t("teacher.classCreatedA")} ${res.class.name} ${t("teacher.classCreatedB")} ${res.class.joinCode}.`);
      form.reset();
      setNewStudents(new Set());
      void qc.invalidateQueries({ queryKey: ["admin-classes"] });
    },
    onError: (e) => { setNotice(null); setError(e instanceof ApiError ? e.message : t("admin.classFail")); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/classes/${id}`),
    onSuccess: () => { setError(null); setNotice(t("admin.classDeleted")); void qc.invalidateQueries({ queryKey: ["admin-classes"] }); },
    onError: (e) => setError(e instanceof ApiError ? e.message : t("admin.classDelFail")),
  });

  const regenerate = useMutation({
    mutationFn: (id: string) => api.post<{ joinCode: string }>(`/classes/${id}/regenerate-code`, {}),
    onSuccess: (res) => {
      setError(null);
      setNotice(`${t("admin.newCodeMsgA")} ${res.joinCode}. ${t("admin.newCodeMsgB")}`);
      void qc.invalidateQueries({ queryKey: ["admin-classes"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : t("admin.codeRegenFail")),
  });

  function confirmRemove(name: string, run: () => void) {
    if (window.confirm(`${t("admin.deleteBtn")} — ${name}?`)) run();
  }

  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 4000); return () => clearTimeout(timer); }, [notice]);

  const yearName = useMemo(
    () => new Map((years.data?.academicYears ?? []).map((y) => [y.id, y.name])),
    [years.data],
  );
  const rows = classes.data?.classes ?? [];

  return (
    <div>
      <PageHeader no={t("admin.classesNo")} title={t("admin.classesTitle")} subtitle={t("admin.classesSub")} />

      <form className="card p-5 mb-6 space-y-4" onSubmit={form.handleSubmit((v) => create.mutate(v))} noValidate aria-label={t("admin.newClassForm")}>
        <div className="grid sm:grid-cols-4 gap-4 items-end">
          <div className="sm:col-span-2">
            <label htmlFor="k-name" className="text-sm font-medium">{t("teacher.classNameLabel")}</label>
            <input id="k-name" className="input mt-1" placeholder="XI TKJ 1" aria-invalid={!!form.formState.errors.name} {...form.register("name")} />
            <FieldError message={form.formState.errors.name?.message ?? undefined} />
          </div>
        <div>
          <label htmlFor="k-grade" className="text-sm font-medium">{t("teacher.gradeLabel")}</label>
          <select id="k-grade" className="input mt-1" {...form.register("grade")}>
            <option value="X">X</option>
            <option value="XI">XI</option>
            <option value="XII">XII</option>
          </select>
        </div>
        <div>
          <label htmlFor="k-year" className="text-sm font-medium">{t("teacher.yearLabel")}</label>
          <select id="k-year" className="input mt-1" aria-invalid={!!form.formState.errors.academicYearId} {...form.register("academicYearId")}>
            <option value="">{t("teacher.pickYear")}</option>
            {(years.data?.academicYears ?? []).map((y) => (
              <option key={y.id} value={y.id}>{y.name}{y.isActive ? ` (${t("teacher.activeTag")})` : ""}</option>
            ))}
          </select>
          <FieldError message={form.formState.errors.academicYearId?.message ?? undefined} />
        </div>
        <div>
          <label htmlFor="k-major" className="text-sm font-medium">{t("admin.majorLabel")}</label>
          <input id="k-major" className="input mt-1" {...form.register("major")} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="k-wali" className="text-sm font-medium">{t("admin.homeroomLabel")}</label>
          <select id="k-wali" className="input mt-1" {...form.register("homeroomTeacherId")}>
            <option value="">{t("admin.noHomeroom")}</option>
            {(gurus.data?.users ?? []).map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium mb-2">{t("admin.memberStudents")} ({newStudents.size} {t("admin.selected")})</legend>
          {(siswas.data?.users ?? []).length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>{t("admin.noSiswa")}</p>
          ) : (
            <ul className="grid sm:grid-cols-2 gap-1.5 max-h-55 overflow-y-auto pr-1">
              {(siswas.data?.users ?? []).map((s) => (
                <li key={s.id}>
                  <label className="flex items-center gap-2.5 text-sm card !rounded-lg px-3 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newStudents.has(s.id)}
                      onChange={() => setNewStudents((prev) => {
                        const next = new Set(prev);
                        if (next.has(s.id)) next.delete(s.id);
                        else next.add(s.id);
                        return next;
                      })}
                      className="w-4 h-4 accent-[#DE653F]"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.name}</span>
                      <span className="block truncate font-mono2 text-[11px]" style={{ color: "var(--muted)" }}>{s.email}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary text-sm" disabled={create.isPending}>{create.isPending ? t("admin.saving") : t("admin.addClass")}</button>
          {notice && <p role="status" className="text-sm" style={{ color: "var(--ok)" }}>{notice}</p>}
          {error && <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title={t("admin.noClasses")} body={t("admin.noClassesBody")} />
      ) : (
        <div className="space-y-3">
          {rows.map((c) => (
            <article key={c.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display font-semibold">{c.name}</h2>
                  <p className="tech-no mt-1">
                    {c.grade} · {c.major} · {c.academicYearId ? (yearName.get(c.academicYearId) ?? "—") : "—"} · {c.memberCount} siswa · {c.courseCount} kursus
                  </p>
                  {c.homeroomTeacherName && (
                    <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{t("teacher.homeroom")}: {c.homeroomTeacherName}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-ghost text-xs"
                    onClick={() => setManagingId((v) => (v === c.id ? null : c.id))}
                    aria-expanded={managingId === c.id}
                  >
                    {managingId === c.id ? t("teacher.close") : t("admin.manageMembers")}
                  </button>
                  <button className="btn-ghost text-xs" onClick={() => regenerate.mutate(c.id)} disabled={regenerate.isPending} title={t("admin.newCodeMsgB")}>
                    {t("admin.newCode")}
                  </button>
                  <button className="btn-ghost text-xs" onClick={() => confirmRemove(c.name, () => remove.mutate(c.id))} disabled={remove.isPending}>{t("admin.deleteBtn")}</button>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t rule-line flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-2">
                  <span className="tech-no">{t("admin.joinCodeTag")}</span>
                  <code className="font-mono2 text-sm font-semibold tracking-[0.2em] px-2 py-0.5 rounded border rule-line" style={{ background: "var(--paper)" }}>
                    {c.joinCode}
                  </code>
                  <CopyButton text={c.joinCode} label={`${t("teacher.copyCode")} ${c.name}`} />
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="tech-no">{t("admin.linkTag")}</span>
                  <code className="font-mono2 text-xs truncate max-w-55" style={{ color: "var(--muted)" }}>
                    {joinLink(c.joinCode)}
                  </code>
                  <CopyButton text={joinLink(c.joinCode)} label={`${t("teacher.copyLink")} ${c.name}`} />
                </div>
              </div>
              {managingId === c.id && (
                <ClassMemberEditor
                  classId={c.id}
                  currentWaliId={c.homeroomTeacherId}
                  gurus={gurus.data?.users ?? []}
                  siswas={siswas.data?.users ?? []}
                  onSaved={(message) => { setError(null); setNotice(message); }}
                />
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- mata pelajaran */

interface SubjectRow { id: string; code: string; name: string; description: string | null }

export function AdminSubjectsPage() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const subjects = useQuery({ queryKey: ["admin-subjects"], queryFn: () => api.get<{ subjects: SubjectRow[] }>("/subjects") });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const SubjectForm = z.object({
    code: z.string().min(2, t("admin.codeMin")).max(24),
    name: z.string().min(3, t("admin.subjectMin")).max(160),
    description: z.string().max(2000).optional(),
  });

  const form = useForm<z.infer<typeof SubjectForm>>({
    resolver: zodResolver(SubjectForm),
    defaultValues: { code: "", name: "", description: "" },
  });

  const create = useMutation({
    mutationFn: (v: z.infer<typeof SubjectForm>) => api.post<{ subject: SubjectRow }>("/subjects", v),
    onSuccess: () => {
      setError(null); setNotice(t("admin.subjectAdded")); form.reset();
      void qc.invalidateQueries({ queryKey: ["admin-subjects"] });
    },
    onError: (e) => { setNotice(null); setError(e instanceof ApiError ? e.message : t("admin.subjectFail")); },
  });

  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 4000); return () => clearTimeout(timer); }, [notice]);
  const rows = subjects.data?.subjects ?? [];

  return (
    <div>
      <PageHeader no={t("admin.subjectsNo")} title={t("admin.subjectsTitle")} subtitle={t("admin.subjectsSub")} />

      <form className="card p-5 mb-6 grid sm:grid-cols-3 gap-4 items-end" onSubmit={form.handleSubmit((v) => create.mutate(v))} noValidate aria-label={t("admin.newSubjectForm")}>
        <div>
          <label htmlFor="s-code" className="text-sm font-medium">{t("admin.codeLabel")}</label>
          <input id="s-code" className="input mt-1 font-mono2" placeholder={t("admin.codePh")} aria-invalid={!!form.formState.errors.code} {...form.register("code")} />
          <FieldError message={form.formState.errors.code?.message ?? undefined} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="s-name" className="text-sm font-medium">{t("admin.subjectNameLabel")}</label>
          <input id="s-name" className="input mt-1" placeholder={t("admin.subjectNamePh")} aria-invalid={!!form.formState.errors.name} {...form.register("name")} />
          <FieldError message={form.formState.errors.name?.message ?? undefined} />
        </div>
        <button type="submit" className="btn-primary text-sm sm:col-start-3" disabled={create.isPending}>{create.isPending ? t("admin.saving") : t("admin.addSubject")}</button>
      </form>

      {notice && <p role="status" className="text-sm mb-4" style={{ color: "var(--ok)" }}>{notice}</p>}
      {error && <p role="alert" className="text-sm mb-4" style={{ color: "var(--danger)" }}>{error}</p>}

      {rows.length === 0 ? (
        <EmptyState title={t("admin.noSubjects")} body={t("admin.noSubjectsBody")} />
      ) : (
        <ul className="grid sm:grid-cols-2 gap-3">
          {rows.map((s) => (
            <li key={s.id} className="card p-4">
              <p className="tech-no">{s.code}</p>
              <h2 className="font-display font-semibold mt-1">{s.name}</h2>
              {s.description && <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{s.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- tahun ajaran */

export function AdminAcademicYearsPage() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const years = useQuery({ queryKey: ["academic-years"], queryFn: () => api.get<{ academicYears: AcademicYear[] }>("/academic-years") });
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (n: string) => api.post<{ academicYear: AcademicYear }>("/academic-years", { name: n }),
    onSuccess: () => { setName(""); setError(null); setNotice(t("admin.yearAdded")); void qc.invalidateQueries({ queryKey: ["academic-years"] }); },
    onError: (e) => setError(e instanceof ApiError ? e.message : t("admin.yearFail")),
  });

  const setActive = useMutation({
    mutationFn: (id: string) => api.patch<{ ok: boolean }>(`/academic-years/${id}`, { isActive: true }),
    onSuccess: () => { setNotice(t("admin.activeSet")); void qc.invalidateQueries({ queryKey: ["academic-years"] }); },
    onError: (e) => setError(e instanceof ApiError ? e.message : t("admin.activeSetFail")),
  });

  function confirmActivate(n: string, run: () => void) {
    if (window.confirm(`${t("admin.makeActive")} — ${n}?`)) run();
  }

  const rows = years.data?.academicYears ?? [];

  return (
    <div>
      <PageHeader no={t("admin.yearsNo")} title={t("admin.yearsTitle")} subtitle={t("admin.yearsSub")} />
      <form
        className="card p-5 mb-6 flex gap-3 items-end"
        onSubmit={(e) => { e.preventDefault(); if (name.trim().length >= 4) create.mutate(name.trim()); else setError(t("admin.yearMin")); }}
        noValidate
      >
        <div className="flex-1">
          <label htmlFor="y-name" className="text-sm font-medium">{t("admin.yearNameLabel")}</label>
          <input id="y-name" className="input mt-1" placeholder={t("admin.yearNamePh")} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!error} />
        </div>
        <button type="submit" className="btn-primary text-sm" disabled={create.isPending}>{create.isPending ? t("admin.saving") : t("admin.addYear")}</button>
      </form>
      {notice && <p role="status" className="text-sm mb-4" style={{ color: "var(--ok)" }}>{notice}</p>}
      {error && <p role="alert" className="text-sm mb-4" style={{ color: "var(--danger)" }}>{error}</p>}

      {rows.length === 0 ? (
        <EmptyState title={t("admin.noYears")} body={t("admin.noYearsBody")} />
      ) : (
        <ul className="space-y-2">
          {rows.map((y) => (
            <li key={y.id} className="card p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-display font-semibold">{y.name}</p>
                <p className="tech-no mt-0.5">{y.isActive ? t("admin.activeTag") : t("admin.inactiveTag")}</p>
              </div>
              {!y.isActive && (
                <button className="btn-ghost text-xs" onClick={() => confirmActivate(y.name, () => setActive.mutate(y.id))}>{t("admin.makeActive")}</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- pengumuman */

export function AnnouncementsPage({ scope }: { scope: "admin" | "guru" }) {
  const { t } = useI18n();
  const list = useQuery({ queryKey: ["announcements"], queryFn: () => api.get<{ announcements: Array<{ id: string; title: string; body: string; scope: string; courseId: string | null; createdAt: string }> }>("/announcements") });
  const rows = list.data?.announcements ?? [];
  return (
    <div>
      <PageHeader
        no={scope === "admin" ? t("announcePage.adminNo") : t("announcePage.teacherNo")}
        title={t("admin.announceTitle")}
        subtitle={scope === "admin" ? t("admin.announceSchool") : t("admin.announceTeacher")}
      />

      <section className="mb-8" aria-label={t("admin.composerTitle")}>
        <AnnouncementComposer />
      </section>

      {list.isLoading ? (
        <p role="status">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <EmptyState title={t("admin.noAnnounce")} body={t("admin.noAnnounceBody")} />
      ) : (
        <ol className="space-y-3">
          {rows.map((a) => (
            <li key={a.id} className="card p-4">
              <div className="flex items-center gap-2">
                <StatusPill status={a.scope === "school" ? "school" : "course"} />
                <h2 className="font-display font-semibold">{a.title}</h2>
              </div>
              <p className="text-sm mt-1.5" style={{ color: "var(--muted)" }}>{a.body}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function AnnouncementComposer() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { t } = useI18n();
  const courses = useQuery({ queryKey: ["courses"], queryFn: () => api.get<{ courses: Array<{ id: string; title: string }> }>("/courses") });
  const mine = (courses.data?.courses ?? []).filter(() => user?.role === "guru" || user?.role === "admin");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<"school" | "course">("school");
  const [courseId, setCourseId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.post("/announcements", { title, body, scope, ...(scope === "course" ? { courseId } : {}) }),
    onSuccess: () => {
      setError(null); setNotice(t("admin.announceMade")); setTitle(""); setBody("");
      void qc.invalidateQueries({ queryKey: ["announcements"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : t("admin.announceFail")),
  });

  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 4000); return () => clearTimeout(timer); }, [notice]);

  return (
    <form
      className="card p-5 space-y-4"
      onSubmit={(e) => { e.preventDefault(); if (title.trim().length < 4 || body.trim().length < 1) { setError(t("admin.announceInvalid")); return; } create.mutate(); }}
      noValidate
      aria-label={t("admin.announceForm")}
    >
      <h2 className="font-display text-lg font-semibold">{t("admin.composerTitle")}</h2>
      {user?.role === "guru" && (
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={scope === "school"} onChange={() => setScope("school")} /> {t("admin.scopeSchool")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={scope === "course"} onChange={() => setScope("course")} /> {t("admin.scopeCourse")}
          </label>
        </div>
      )}
      {user?.role === "guru" && scope === "course" && (
        <div>
          <label htmlFor="an-course" className="text-sm font-medium">{t("admin.courseLabel")}</label>
          <select id="an-course" className="input mt-1" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">{t("admin.pickCourse")}</option>
            {mine.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
      )}
      <div>
        <label htmlFor="an-title" className="text-sm font-medium">{t("admin.titleLabel")}</label>
        <input id="an-title" className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!error} />
      </div>
      <div>
        <label htmlFor="an-body" className="text-sm font-medium">{t("admin.bodyLabel")}</label>
        <textarea id="an-body" className="input mt-1" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary text-sm" disabled={create.isPending}>{create.isPending ? t("admin.publishing") : t("admin.publishBtn")}</button>
        {notice && <p role="status" className="text-sm" style={{ color: "var(--ok)" }}>{notice}</p>}
        {error && <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
      </div>
    </form>
  );
}
