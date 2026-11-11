import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { useI18n } from "../../lib/I18nContext";

/** Header halaman editorial: nomor teknis + judul display + aksi kontekstual. */
export function PageHeader({ no, title, subtitle, action }: { no: string; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="tech-no">{no}</p>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mt-1">{title}</h1>
        {subtitle && <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card p-8 text-center" role="status">
      <p className="tech-no mb-2">— kosong —</p>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="text-sm mt-1 mx-auto max-w-md" style={{ color: "var(--muted)" }}>{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return <p role="alert" className="text-sm mt-1" style={{ color: "var(--danger)" }}>{message}</p>;
}

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  id: string;
}

/**
 * Kolom kata sandi dengan tombol mata (tampilkan/sembunyikan).
 * Meneruskan ref agar kompatibel dengan React Hook Form.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { id, className, ...rest }: PasswordInputProps,
  ref,
) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        ref={ref}
        type={show ? "text" : "password"}
        className={`input mt-1 pr-11 ${className ?? ""}`}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
        aria-pressed={show}
        title={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
        className="btn-ghost !px-2 !py-1.5 absolute right-1.5 top-1/2 -translate-y-[calc(50%-2px)]"
      >
        {show ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
      </button>
    </div>
  );
});

/** Tombol salin teks (kode/tautan) dengan umpan balik "Disalin!". */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback untuk browser lama tanpa Clipboard API.
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="btn-ghost !px-2 !py-1 text-xs inline-flex items-center gap-1.5 shrink-0"
      aria-label={label}
      title={label}
    >
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      {copied ? "Disalin!" : "Salin"}
    </button>
  );
}

/** Blok perintah CLI — monospace dengan tombol salin. */
export function CommandBlock({ command, label }: { command: string; label?: string }) {
  return (
    <figure className="card overflow-hidden">
      {label && <figcaption className="tech-no px-3 pt-2.5">{label}</figcaption>}
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <code className="font-mono2 text-[13px] overflow-x-auto whitespace-pre">{command}</code>
        <button
          className="btn-ghost !px-2 !py-1 text-xs shrink-0"
          onClick={() => void navigator.clipboard?.writeText(command)}
          aria-label="Salin perintah"
        >
          Salin
        </button>
      </div>
    </figure>
  );
}

/** Badge CIDR — makna teknis, bukan dekorasi. */
export function CIDRBadge({ prefix }: { prefix: number }) {
  return (
    <span className="font-mono2 text-xs px-2 py-0.5 rounded-md border rule-line" style={{ background: "var(--paper)" }} title={`Notasi CIDR /${prefix}`}>
      /{prefix}
    </span>
  );
}

export function IPAddressDisplay({ ip }: { ip: string }) {
  return <code className="font-mono2 text-[13px] px-1.5 py-0.5 rounded border rule-line" style={{ background: "var(--paper)" }}>{ip}</code>;
}

export function StatusPill({ status }: { status: string }) {
  const { t } = useI18n();
  const map: Record<string, string> = {
    published: t("status.published"),
    draft: t("status.draft"),
    archived: t("status.archived"),
    completed: t("status.completed"),
    started: t("status.started"),
    school: t("status.school"),
    course: t("status.course"),
  };
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full border rule-line">
      {map[status] ?? status}
    </span>
  );
}

/** Kerangka muat — blok berdenyut dengan label aksesibel. */
export function Skeleton({ className, label }: { className?: string; label?: string }) {
  return (
    <div
      className={`skeleton ${className ?? ""}`}
      role="status"
      aria-label={label ?? "Memuat konten"}
    />
  );
}

/** Remah roti kontekstual untuk navigasi hierarkis. */
export function Breadcrumbs({ items }: { items: Array<{ label: string; to?: string }> }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1.5 text-[13px]">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && (
                <span aria-hidden style={{ color: "var(--muted)" }}>/</span>
              )}
              {item.to && !last ? (
                <Link to={item.to} className="hover:underline truncate" style={{ color: "var(--muted)" }}>
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "font-medium" : ""} style={last ? undefined : { color: "var(--muted)" }}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Judul seksi kecil dengan aksi opsional di kanan. */
export function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="tech-no">{title}</h2>
      {action}
    </div>
  );
}
