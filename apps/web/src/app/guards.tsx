import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Role } from "@simpul/shared";
import { AppShell } from "../components/design-system/AppShell";
import { useAuth } from "../features/auth/AuthContext";
import { useI18n } from "../lib/I18nContext";

function roleHome(role: Role): string {
  if (role === "admin") return "/admin/dashboard";
  if (role === "guru") return "/teacher/dashboard";
  return "/student/dashboard";
}

export function RequireAuth({ roles }: { roles: Role[] }) {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const loc = useLocation();
  if (loading) return <p className="p-8" role="status">{t("forbidden.loading")}</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (!roles.includes(user.role)) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center" role="alert">
        <p className="tech-no">{t("forbidden.tag")}</p>
        <h1 className="font-display text-2xl font-bold mt-2">{t("forbidden.title")}</h1>
        <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>
          {t("forbidden.bodyA")} {roles.join(", ")}. {t("forbidden.bodyB")} {user.role}.
        </p>
        <a href={roleHome(user.role)} className="btn-ghost inline-block mt-4 text-sm">{t("forbidden.back")}</a>
      </div>
    );
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

/** Autentikasi tanpa AppShell untuk halaman fokus seperti ujian. */
export function RequireBareAuth({ roles }: { roles: Role[] }) {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const loc = useLocation();
  if (loading) return <p className="p-8" role="status">{t("forbidden.loading")}</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (!roles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />;
  return <Outlet />;
}
