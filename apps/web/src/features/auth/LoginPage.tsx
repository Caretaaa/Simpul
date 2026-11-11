import { zodResolver } from "@hookform/resolvers/zod";
import { LoginSchema } from "@simpul/shared";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Globe } from "lucide-react";
import { ApiError } from "../../lib/api";
import { useI18n, type Lang } from "../../lib/I18nContext";
import { useAuth } from "./AuthContext";
import { FieldError, PasswordInput } from "../../components/design-system/primitives";

export function LoginPage() {
  const { login } = useAuth();
  const { t, lang, setLang } = useI18n();
  const nav = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<{ email: string; password: string }>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: { email: string; password: string }) {
    setServerError(null);
    try {
      const user = await login(values.email, values.password);
      nav(user.role === "admin" ? "/admin/dashboard" : user.role === "guru" ? "/teacher/dashboard" : "/student/dashboard", { replace: true });
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : t("login.genericFail"));
    }
  }

  return (
    <div className="min-h-dvh grid md:grid-cols-[1.1fr_1fr]">
      {/* Panel editorial kiri */}
      <div className="hidden md:flex flex-col justify-between p-10 border-r rule-line" style={{ background: "var(--surface)" }}>
        <div className="flex items-start justify-between">
          <p className="font-display font-bold text-2xl">SIMPUL<span style={{ color: "var(--accent)" }}>.</span></p>
          <div className="flex gap-1.5" role="group" aria-label={t("header.language")}>
            {(["id", "en"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                title={l === "id" ? t("settings.indonesian") : t("settings.english")}
                className="font-mono2 text-xs px-2 py-1 rounded-md border rule-line"
                style={{
                  background: lang === l ? "var(--paper)" : "transparent",
                  color: lang === l ? "var(--ink)" : "var(--muted)",
                  fontWeight: lang === l ? 700 : 400,
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="tech-no mb-3">{t("login.panelNo")}</p>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight">
            {t("login.headlineA")}<br />{t("login.headlineB")}<br />
            <span style={{ color: "var(--accent)" }}>{t("login.headlineC")}</span>
          </h1>
          <p className="mt-4 max-w-md text-[15px]" style={{ color: "var(--muted)" }}>
            {t("login.panelBody")}
          </p>
          <dl className="mt-8 grid grid-cols-3 gap-4 font-mono2 text-xs" style={{ color: "var(--muted)" }}>
            <div><dt className="tech-no">{t("login.focus")}</dt><dd className="mt-1 text-sm" style={{ color: "var(--ink)" }}>{t("login.focusValue")}</dd></div>
            <div><dt className="tech-no">{t("login.method")}</dt><dd className="mt-1 text-sm" style={{ color: "var(--ink)" }}>{t("login.methodValue")}</dd></div>
            <div><dt className="tech-no">{t("login.mode")}</dt><dd className="mt-1 text-sm" style={{ color: "var(--ink)" }}>{t("login.modeValue")}</dd></div>
          </dl>
          <p className="mt-4 text-xs" style={{ color: "var(--muted)" }}>
            {t("login.offlineNote")}
          </p>
        </div>
        <p className="font-mono2 text-xs" style={{ color: "var(--muted)" }}>192.168.100.0/24 · VLAN 10–30 · lab-workspace/01</p>
      </div>

      {/* Form kanan */}
      <div className="flex items-center justify-center p-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full max-w-sm card p-6 md:p-8" noValidate aria-label={t("login.welcome")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="tech-no">{t("login.formNo")}</p>
              <h2 className="font-display text-xl font-bold mt-1">{t("login.welcome")}</h2>
              <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{t("login.welcomeSub")}</p>
            </div>
            <button
              type="button"
              onClick={() => setLang(lang === "id" ? "en" : "id")}
              className="btn-ghost !px-2 !py-1.5 md:hidden"
              aria-label={t("header.language")}
              title={lang === "id" ? t("settings.english") : t("settings.indonesian")}
            >
              <span className="flex items-center gap-1 text-xs font-mono2">
                <Globe size={14} aria-hidden /> {lang.toUpperCase()}
              </span>
            </button>
          </div>
          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-medium">{t("login.email")}</label>
              <input id="email" type="email" autoComplete="username" className="input mt-1" placeholder="nama@simpul.sch.id"
                aria-invalid={!!form.formState.errors.email} {...form.register("email")} />
              <FieldError message={form.formState.errors.email?.message ?? undefined} />
            </div>
            <div>
              <label htmlFor="password" className="text-sm font-medium">{t("login.password")}</label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={!!form.formState.errors.password}
                {...form.register("password")}
              />
              <FieldError message={form.formState.errors.password?.message ?? undefined} />
            </div>
          </div>
          {serverError && <p role="alert" className="text-sm mt-3" style={{ color: "var(--danger)" }}>{serverError}</p>}
          <button type="submit" className="btn-primary w-full mt-5" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? t("login.checking") : t("login.submit")}
          </button>
          <p className="text-xs mt-4" style={{ color: "var(--muted)" }}>
            {t("login.demo")}
          </p>
        </form>
      </div>
    </div>
  );
}
