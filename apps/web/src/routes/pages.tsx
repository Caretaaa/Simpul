import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bell, CheckCheck, Globe, Moon, Sun } from "lucide-react";
import { api } from "../lib/api";
import { useI18n, type Lang } from "../lib/I18nContext";
import { useTheme } from "../app/theme";
import { useAuth } from "../features/auth/AuthContext";
import {
  EmptyState,
  PageHeader,
  StatusPill,
} from "../components/design-system/primitives";

interface Announcement {
  id: string;
  title: string;
  body: string;
  scope: string;
  courseId: string | null;
  createdAt: string;
}

export function PlaceholderPage({
  no,
  title,
  body,
  titleKey,
  bodyKey,
  dashboardTo,
  links,
}: {
  no: string;
  title?: string;
  body?: string;
  titleKey?: string;
  bodyKey?: string;
  dashboardTo?: string;
  links?: Array<{ to: string; labelKey: string; primary?: boolean }>;
}) {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader no={no} title={titleKey ? t(titleKey) : (title ?? no)} />
      <EmptyState
        title={t("placeholders.phaseTag")}
        body={bodyKey ? t(bodyKey) : (body ?? "")}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {(links ?? []).map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={l.primary ? "btn-primary text-sm inline-block" : "btn-ghost text-sm inline-block"}
              >
                {t(l.labelKey)}
              </Link>
            ))}
            {dashboardTo ? (
              <Link to={dashboardTo} className="btn-ghost text-sm inline-block">
                {t("placeholders.backToDashboard")}
              </Link>
            ) : undefined}
          </div>
        }
      />
    </div>
  );
}

export function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { theme } = useTheme();
  // Theme toggle lives in the header; this page reflects + explains state.
  // Direct set requires ThemeContext setter — reuse toggle conservatively.
  const { toggle } = useTheme();
  const { user } = useAuth();

  return (
    <div className="max-w-2xl">
      <PageHeader no={t("settings.pageNo")} title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <section className="card p-5 mb-4" aria-label={t("settings.language")}>
        <div className="flex items-start gap-3">
          <Globe size={18} aria-hidden className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
          <div className="flex-1">
            <h2 className="font-display font-semibold">{t("settings.language")}</h2>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              {t("settings.languageBody")}
            </p>
            <div className="flex gap-2 mt-3" role="group" aria-label={t("settings.language")}>
              {(["id", "en"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={lang === l ? "btn-primary text-sm" : "btn-ghost text-sm"}
                >
                  {l === "id" ? t("settings.indonesian") : t("settings.english")}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card p-5 mb-4" aria-label={t("settings.appearance")}>
        <div className="flex items-start gap-3">
          {theme === "light" ? (
            <Sun size={18} aria-hidden className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
          ) : (
            <Moon size={18} aria-hidden className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
          )}
          <div className="flex-1">
            <h2 className="font-display font-semibold">{t("settings.appearance")}</h2>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              {t("settings.appearanceBody")}
            </p>
            <div className="flex gap-2 mt-3" role="group" aria-label={t("settings.appearance")}>
              <button
                onClick={() => theme !== "light" && toggle()}
                aria-pressed={theme === "light"}
                className={theme === "light" ? "btn-primary text-sm" : "btn-ghost text-sm"}
              >
                {t("settings.light")}
              </button>
              <button
                onClick={() => theme !== "dark" && toggle()}
                aria-pressed={theme === "dark"}
                className={theme === "dark" ? "btn-primary text-sm" : "btn-ghost text-sm"}
              >
                {t("settings.dark")}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="card p-5" aria-label={t("settings.account")}>
        <h2 className="tech-no">{t("settings.account")}</h2>
        <p className="text-sm font-medium mt-1">{user?.name}</p>
        <p className="font-mono2 text-xs" style={{ color: "var(--muted)" }}>
          {user?.role} · {user?.email}
        </p>
        <h3 className="font-display font-semibold mt-4">{t("settings.schoolNoteTitle")}</h3>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          {t("settings.schoolNoteBody")}
        </p>
      </section>
    </div>
  );
}

export function ProfilePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const initial = (user?.name.trim()[0] ?? "?").toUpperCase();
  const roleLabel =
    user?.role === "admin"
      ? t("profile.roles.admin")
      : user?.role === "guru"
        ? t("profile.roles.guru")
        : t("profile.roles.siswa");

  return (
    <div className="max-w-2xl">
      <PageHeader no={t("profile.pageNo")} title={t("profile.title")} />
      <section className="card p-5 md:p-6" aria-label={t("profile.title")}>
        <div className="flex items-center gap-4">
          <span className="avatar-circle !w-14 !h-14 !text-xl" aria-hidden>
            {initial}
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold truncate">{user?.name}</h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {roleLabel} · {user?.email}
            </p>
          </div>
        </div>
        <dl className="grid sm:grid-cols-2 gap-4 mt-6">
          <div className="border-t rule-line pt-3">
            <dt className="tech-no">{t("profile.name")}</dt>
            <dd className="text-sm font-medium mt-1">{user?.name}</dd>
          </div>
          <div className="border-t rule-line pt-3">
            <dt className="tech-no">{t("profile.email")}</dt>
            <dd className="text-sm font-medium mt-1 break-all">{user?.email}</dd>
          </div>
          <div className="border-t rule-line pt-3">
            <dt className="tech-no">{t("profile.role")}</dt>
            <dd className="text-sm font-medium mt-1">{roleLabel}</dd>
          </div>
        </dl>
        <p className="text-sm mt-6" style={{ color: "var(--muted)" }}>
          {t("profile.body")}
        </p>
      </section>
    </div>
  );
}

export function NotificationsPage() {
  const { t, formatDate } = useI18n();
  const list = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api.get<{ announcements: Announcement[] }>("/announcements"),
  });
  const rows = list.data?.announcements ?? [];
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem("simpul-notif-seen") ?? "";
    } catch {
      return "";
    }
  });
  const unreadIds = new Set(
    rows.filter((a) => seen.length === 0 || a.createdAt > seen).map((a) => a.id),
  );

  function markAllRead() {
    const now = new Date().toISOString();
    try {
      localStorage.setItem("simpul-notif-seen", now);
    } catch {
      /* abaikan */
    }
    setSeen(now);
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        no={t("notifications.pageNo")}
        title={t("notifications.title")}
        subtitle={t("notifications.subtitle")}
        action={
          rows.length > 0 && unreadIds.size > 0 ? (
            <button onClick={markAllRead} className="btn-ghost text-sm inline-flex items-center gap-1.5">
              <CheckCheck size={15} aria-hidden /> {t("notifications.markAllRead")}
            </button>
          ) : undefined
        }
      />
      {list.isLoading ? (
        <p role="status">{t("common.loading")}</p>
      ) : list.isError ? (
        <p role="alert" style={{ color: "var(--danger)" }}>{t("common.loadFail")}</p>
      ) : rows.length === 0 ? (
        <EmptyState title={t("notifications.emptyTitle")} body={t("notifications.emptyBody")} />
      ) : (
        <ol className="space-y-3">
          {rows.map((a) => {
            const fresh = unreadIds.has(a.id);
            return (
              <li key={a.id} className="card p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {fresh && (
                    <span className="unread-dot !static" aria-label={t("notifications.unread")}>
                      •
                    </span>
                  )}
                  <StatusPill status={a.scope === "school" ? "school" : "course"} />
                  <span className="tech-no">{formatDate(a.createdAt, true)}</span>
                </div>
                <h2 className="font-display font-semibold mt-1.5">{a.title}</h2>
                <p className="text-sm mt-1.5" style={{ color: "var(--muted)" }}>{a.body}</p>
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-xs mt-6 flex items-start gap-1.5" style={{ color: "var(--muted)" }}>
        <Bell size={13} aria-hidden className="mt-0.5 shrink-0" />
        {t("notifications.footnote")}
      </p>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="p-10 text-center">
      <p className="tech-no">404 — TIDAK DITEMUKAN</p>
      <h1 className="font-display text-2xl font-bold mt-2">Halaman tidak ada</h1>
      <Link to="/" className="btn-ghost inline-block mt-4 text-sm">Kembali ke beranda peran Anda</Link>
    </div>
  );
}
