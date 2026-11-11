import { useEffect, useRef, useState } from "react";
import {
  Award,
  Bell,
  Binary,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FlaskConical,
  Globe,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sun,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { Role } from "@simpul/shared";
import { useTheme } from "../../app/theme";
import { useAuth } from "../../features/auth/AuthContext";
import { useI18n, type Lang } from "../../lib/I18nContext";
import { api } from "../../lib/api";

interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  soon?: boolean;
  demo?: boolean;
}

interface NavGroup {
  groupKey: string;
  items: NavItem[];
}

const NAV: Record<Role, NavGroup[]> = {
  siswa: [
    {
      groupKey: "nav.main",
      items: [
        { to: "/student/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
        { to: "/student/courses", labelKey: "nav.myCourses", icon: BookOpen },
        { to: "/notifications", labelKey: "nav.notifications", icon: Bell },
      ],
    },
    {
      groupKey: "nav.practiceGroup",
      items: [
        { to: "/student/labs", labelKey: "nav.labs", icon: FlaskConical, demo: true },
        { to: "/student/assignments", labelKey: "nav.assignments", icon: ClipboardList, demo: true },
        { to: "/student/quizzes", labelKey: "nav.quizzes", icon: ListChecks, demo: true },
        { to: "/student/subnetting", labelKey: "nav.practice", icon: Binary, demo: true },
        { to: "/student/progress", labelKey: "nav.progress", icon: Award },
      ],
    },
  ],
  guru: [
    {
      groupKey: "nav.main",
      items: [
        { to: "/teacher/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
        { to: "/teacher/courses", labelKey: "nav.courses", icon: BookOpen },
        { to: "/teacher/classes", labelKey: "nav.classes", icon: Users },
        { to: "/teacher/announcements", labelKey: "nav.announcements", icon: Megaphone },
        { to: "/notifications", labelKey: "nav.notifications", icon: Bell },
      ],
    },
    {
      groupKey: "nav.upcoming",
      items: [
        { to: "/teacher/labs", labelKey: "nav.labs", icon: FlaskConical, soon: true },
        { to: "/teacher/assignments", labelKey: "nav.assignments", icon: ClipboardList, soon: true },
        { to: "/teacher/submissions", labelKey: "teacher.reviewSubmissions", icon: Inbox, soon: true },
        { to: "/teacher/assessments", labelKey: "nav.quizzes", icon: ClipboardCheck, soon: true },
      ],
    },
  ],
  admin: [
    {
      groupKey: "nav.main",
      items: [
        { to: "/admin/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
        { to: "/admin/users", labelKey: "nav.users", icon: Users },
        { to: "/admin/classes", labelKey: "nav.classes", icon: GraduationCap },
        { to: "/admin/subjects", labelKey: "nav.subjects", icon: BookOpen },
        { to: "/admin/academic-years", labelKey: "nav.academicYears", icon: CalendarDays },
        { to: "/admin/courses", labelKey: "nav.courses", icon: BookOpen },
        { to: "/admin/announcements", labelKey: "nav.announcements", icon: Megaphone },
        { to: "/notifications", labelKey: "nav.notifications", icon: Bell },
      ],
    },
  ],
};

/** Judul kontekstual bilah atas dari awalan path (terpanjang dulu). */
const TITLE_MAP: Array<[string, string]> = [
  ["/student/lessons", "nav.myCourses"],
  ["/student/courses", "nav.myCourses"],
  ["/student/labs", "nav.labs"],
  ["/student/assignments", "nav.assignments"],
  ["/student/quizzes", "nav.quizzes"],
  ["/student/subnetting", "nav.practice"],
  ["/student/progress", "nav.progress"],
  ["/student/dashboard", "nav.dashboard"],
  ["/teacher/courses", "nav.courses"],
  ["/teacher/classes", "nav.classes"],
  ["/teacher/labs", "nav.labs"],
  ["/teacher/assignments", "nav.assignments"],
  ["/teacher/submissions", "teacher.reviewSubmissions"],
  ["/teacher/assessments", "nav.quizzes"],
  ["/teacher/announcements", "nav.announcements"],
  ["/teacher/dashboard", "nav.dashboard"],
  ["/admin/users", "nav.users"],
  ["/admin/classes", "nav.classes"],
  ["/admin/subjects", "nav.subjects"],
  ["/admin/academic-years", "nav.academicYears"],
  ["/admin/courses", "nav.courses"],
  ["/admin/announcements", "nav.announcements"],
  ["/admin/dashboard", "nav.dashboard"],
  ["/notifications", "nav.notifications"],
  ["/settings", "nav.settings"],
  ["/profile", "nav.profile"],
  ["/join", "join.previewTitle"],
];

const COURSES_HOME: Record<Role, string> = {
  siswa: "/student/dashboard",
  guru: "/teacher/dashboard",
  admin: "/admin/dashboard",
};

const SEARCH_TARGET: Record<Role, string> = {
  siswa: "/student/courses",
  guru: "/teacher/courses",
  admin: "/admin/courses",
};

function titleKeyFor(pathname: string): string {
  for (const [prefix, key] of TITLE_MAP) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return key;
  }
  return "nav.dashboard";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { t, lang, setLang } = useI18n();
  const loc = useLocation();
  const nav = useNavigate();
  const role: Role = user?.role ?? "siswa";
  const groups = NAV[role];

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("simpul-nav-collapsed") === "1",
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<null | "lang" | "profile">(null);
  const [query, setQuery] = useState("");
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Tutup laci seluler setiap kali rute berubah.
  useEffect(() => setMobileOpen(false), [loc.pathname]);
  useEffect(() => {
    localStorage.setItem("simpul-nav-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);
  // Fokus ke tombol tutup saat laci dibuka (aksesibilitas keyboard).
  useEffect(() => {
    if (mobileOpen) closeBtnRef.current?.focus();
  }, [mobileOpen]);
  // Escape menutup menu/laci.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const notifQ = useQuery({
    queryKey: ["announcements"],
    queryFn: () =>
      api.get<{ announcements: Array<{ id: string; createdAt: string }> }>(
        "/announcements",
      ),
    staleTime: 60_000,
  });
  const [seen, setSeen] = useState(
    () => localStorage.getItem("simpul-notif-seen") ?? "",
  );
  useEffect(() => {
    function refresh() {
      setSeen(localStorage.getItem("simpul-notif-seen") ?? "");
    }
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const unread = (notifQ.data?.announcements ?? []).filter(
    (a) => seen.length === 0 || a.createdAt > seen,
  ).length;

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    void nav(
      q.length > 0
        ? `${SEARCH_TARGET[role]}?q=${encodeURIComponent(q)}`
        : SEARCH_TARGET[role],
    );
  }

  function pickLang(l: Lang) {
    setLang(l);
    setOpenMenu(null);
  }

  async function doLogout() {
    await logout();
    window.location.href = "/login";
  }

  const initial = (user?.name.trim()[0] ?? "?").toUpperCase();
  const pageTitle = t(titleKeyFor(loc.pathname));

  const navList = (onNavigate?: () => void, showGroups = true) => (
    <>
      {groups.map((g, gi) => (
        <div key={g.groupKey} className={gi > 0 ? "mt-5" : ""}>
          {showGroups && !collapsed && (
            <p className="tech-no px-3 mb-1.5">{t(g.groupKey)}</p>
          )}
          <ul className="space-y-1">
            {g.items.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  onClick={onNavigate}
                  title={n.soon ? `${t(n.labelKey)} — ${t("common.comingSoon")}` : n.demo ? `${t(n.labelKey)} — ${t("demo.navBadge")}` : t(n.labelKey)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-quiet ${isActive ? "font-semibold nav-active-indicator" : ""}`
                  }
                  style={({ isActive }) =>
                    ({
                      background: isActive ? "var(--paper)" : "transparent",
                      color: isActive ? "var(--ink)" : "var(--muted)",
                      border: "1px solid transparent",
                      paddingLeft: isActive ? "9px" : undefined,
                      opacity: n.soon && !isActive ? 0.8 : undefined,
                    }) as React.CSSProperties
                  }
                >
                  <n.icon size={17} aria-hidden />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{t(n.labelKey)}</span>
                      {n.soon && <span className="soon-badge">{t("common.comingSoon")}</span>}
                      {n.demo && <span className="demo-badge">{t("demo.navBadge")}</span>}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );

  return (
    <div className="min-h-dvh flex" style={{ background: "var(--paper)", color: "var(--ink)" }}>
      {/* Sidebar desktop */}
      <aside
        className={`hidden md:flex shrink-0 flex-col border-r rule-line transition-all ${collapsed ? "w-16" : "w-60"}`}
        style={{ background: "var(--surface)" }}
        aria-label={t("header.menu")}
      >
        <div className={`pt-6 pb-4 border-b rule-line ${collapsed ? "px-0 text-center" : "px-5"}`}>
          <Link
            to={COURSES_HOME[role]}
            className="font-display text-xl font-bold tracking-tight"
            title={t("common.appTagline")}
          >
            {collapsed ? "S" : (<>SIMPUL<span style={{ color: "var(--accent)" }}>.</span></>)}
          </Link>
          {!collapsed && <p className="tech-no mt-1">TKJ · SMK LMS</p>}
        </div>
        <nav className="flex-1 px-3 py-4 overflow-y-auto" aria-label={t("header.menu")}>
          {navList()}
        </nav>
        <div className="p-3 border-t rule-line">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="btn-ghost text-sm w-full flex items-center justify-center gap-2"
            aria-expanded={!collapsed}
            aria-label={collapsed ? t("header.menu") : t("header.closeMenu")}
            title={collapsed ? t("header.menu") : t("header.closeMenu")}
          >
            {collapsed ? <PanelLeftOpen size={16} aria-hidden /> : <PanelLeftClose size={16} aria-hidden />}
            {!collapsed && <span className="text-xs">{t("header.closeMenu")}</span>}
          </button>
          {!collapsed && (
            <p className="font-mono2 text-[11px] mt-2 truncate px-1" style={{ color: "var(--muted)" }}>
              {user?.role} · {user?.email}
            </p>
          )}
        </div>
      </aside>

      {/* Kolom konten */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="topbar px-4 md:px-6 py-2.5 flex items-center gap-2 md:gap-3">
          <button
            className="icon-btn md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label={t("header.menu")}
          >
            <Menu size={19} aria-hidden />
          </button>
          <div className="min-w-0 mr-auto">
            <p className="tech-no hidden sm:block">{t("common.appName")} · TKJ</p>
            <h1 className="font-display font-bold text-base md:text-lg leading-tight truncate">
              {pageTitle}
            </h1>
          </div>

          <form onSubmit={submitSearch} role="search" className="relative hidden sm:block w-52 lg:w-72" aria-label={t("header.searchLabel")}>
            <Search size={15} aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--muted)" }} />
            <label htmlFor="global-search" className="sr-only">{t("header.searchLabel")}</label>
            <input
              id="global-search"
              className="topbar-search"
              placeholder={t("header.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </form>

          <Link
            to="/notifications"
            className="icon-btn"
            aria-label={`${t("header.notifications")}${unread > 0 ? ` — ${unread} ${t("notifications.unread")}` : ""}`}
            title={t("header.notifications")}
          >
            <Bell size={18} aria-hidden />
            {unread > 0 && (
              <span className="unread-dot" aria-hidden>{unread > 9 ? "9+" : unread}</span>
            )}
          </Link>

          <div className="relative">
            <button
              className="icon-btn"
              onClick={() => setOpenMenu((m) => (m === "lang" ? null : "lang"))}
              aria-expanded={openMenu === "lang"}
              aria-haspopup="menu"
              aria-label={t("header.language")}
              title={t("header.language")}
            >
              <Globe size={18} aria-hidden />
            </button>
            {openMenu === "lang" && (
              <>
                <button aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpenMenu(null)} />
                <div className="dropdown-panel z-20" role="menu" aria-label={t("header.language")}>
                  {(["id", "en"] as Lang[]).map((l) => (
                    <button
                      key={l}
                      role="menuitemradio"
                      aria-checked={lang === l}
                      className="dropdown-item"
                      onClick={() => pickLang(l)}
                    >
                      <span className="font-mono2 text-xs w-7" style={{ color: "var(--muted)" }}>
                        {l.toUpperCase()}
                      </span>
                      {l === "id" ? t("settings.indonesian") : t("settings.english")}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={toggle}
            className="icon-btn"
            aria-label={theme === "light" ? t("header.themeDark") : t("header.themeLight")}
            title={theme === "light" ? t("header.themeDark") : t("header.themeLight")}
          >
            {theme === "light" ? <Moon size={18} aria-hidden /> : <Sun size={18} aria-hidden />}
          </button>

          <div className="relative">
            <button
              className="flex items-center gap-2 rounded-lg pl-1 pr-1.5 py-1 border rule-line"
              style={{ background: "var(--paper)" }}
              onClick={() => setOpenMenu((m) => (m === "profile" ? null : "profile"))}
              aria-expanded={openMenu === "profile"}
              aria-haspopup="menu"
              aria-label={t("header.account")}
            >
              <span className="avatar-circle" aria-hidden>{initial}</span>
              <span className="hidden lg:block text-sm font-medium max-w-28 truncate">{user?.name}</span>
            </button>
            {openMenu === "profile" && (
              <>
                <button aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpenMenu(null)} />
                <div className="dropdown-panel z-20 min-w-60" role="menu" aria-label={t("header.account")}>
                  <div className="px-2.5 py-2 border-b rule-line mb-1">
                    <p className="text-sm font-semibold truncate">{user?.name}</p>
                    <p className="font-mono2 text-[11px] truncate" style={{ color: "var(--muted)" }}>
                      {user?.role} · {user?.email}
                    </p>
                  </div>
                  <Link to="/profile" className="dropdown-item" role="menuitem" onClick={() => setOpenMenu(null)}>
                    <UserRound size={15} aria-hidden /> {t("nav.profile")}
                  </Link>
                  <Link to="/settings" className="dropdown-item" role="menuitem" onClick={() => setOpenMenu(null)}>
                    <Settings size={15} aria-hidden /> {t("nav.settings")}
                  </Link>
                  <button className="dropdown-item" role="menuitem" onClick={() => void doLogout()}>
                    <LogOut size={15} aria-hidden /> {t("nav.logout")}
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Pencarian seluler */}
        <div className="sm:hidden px-4 pt-3">
          <form onSubmit={submitSearch} role="search" className="relative" aria-label={t("header.searchLabel")}>
            <Search size={15} aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--muted)" }} />
            <label htmlFor="global-search-m" className="sr-only">{t("header.searchLabel")}</label>
            <input
              id="global-search-m"
              className="topbar-search"
              placeholder={t("header.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </form>
        </div>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-10">
          {children}
        </main>

        {/* Bottom nav mobile — hanya rute fungsional */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-10 border-t rule-line flex"
          style={{ background: "var(--surface)" }}
          aria-label={t("header.menu")}
        >
          {groups[0]?.items.filter((n) => !n.soon && !n.demo).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to.endsWith("/dashboard") || n.to === "/notifications"}
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium relative"
              style={{ color: "var(--muted)" }}
            >
              <n.icon size={19} aria-hidden />
              {t(n.labelKey)}
              {n.to === "/notifications" && unread > 0 && (
                <span className="unread-dot" style={{ top: "2px", right: "calc(50% - 22px)" }} aria-hidden>
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Laci navigasi seluler */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={t("header.menu")}>
          <button aria-hidden tabIndex={-1} className="absolute inset-0" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] flex flex-col border-r rule-line" style={{ background: "var(--surface)" }}>
            <div className="px-5 pt-5 pb-4 border-b rule-line flex items-start justify-between">
              <div>
                <p className="font-display font-bold text-xl">SIMPUL<span style={{ color: "var(--accent)" }}>.</span></p>
                <p className="tech-no mt-1">TKJ · SMK LMS</p>
              </div>
              <button ref={closeBtnRef} className="icon-btn" onClick={() => setMobileOpen(false)} aria-label={t("header.closeMenu")}>
                <X size={18} aria-hidden />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 overflow-y-auto" aria-label={t("header.menu")}>
              {navList(() => setMobileOpen(false))}
            </nav>
            <div className="p-4 border-t rule-line">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="font-mono2 text-[11px]" style={{ color: "var(--muted)" }}>{user?.role} · {user?.email}</p>
              <button onClick={() => void doLogout()} className="btn-ghost text-sm mt-3 w-full">
                {t("nav.logout")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
