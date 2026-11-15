import { useEffect, useState } from "react";
import { toDataURL } from "qrcode";
import { attendanceCheckInUrl } from "@simpul/shared";
import { CopyButton, Skeleton } from "../../components/design-system/primitives";
import { useI18n } from "../../lib/I18nContext";

/**
 * QR dirender sebagai data URL agar tetap tampil (dan tercetak) tanpa
 * bergantung pada jaringan setelah sesi dimuat.
 */
export function QrImage({ payload, size, label }: { payload: string; size: number; label?: string }) {
  const { t } = useI18n();
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setSrc(null);
    setFailed(false);
    toDataURL(payload, { margin: 1, width: size * 2, errorCorrectionLevel: "M" })
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [payload, size]);

  if (failed) {
    return (
      <p className="font-mono2 text-xs p-4 break-all" role="alert">
        {payload}
      </p>
    );
  }
  if (!src) return <Skeleton className="mx-auto" label={t("common.loading")} />;
  return (
    <img
      src={src}
      alt={label ?? t("attendance.qrAlt")}
      width={size}
      height={size}
      className="mx-auto block max-w-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

/** URL absolut check-in siswa untuk sebuah kode sesi. */
export function checkInUrl(code: string): string {
  return attendanceCheckInUrl(window.location.origin, code);
}

/**
 * Panel QR sesi yang ditampilkan guru di depan kelas: siswa memindai dengan
 * kamera ponselnya sendiri, lalu menekan tombol kehadiran di halaman /absen.
 */
export function SessionQrCard({ code, hint }: { code: string; hint?: string | undefined }) {
  const { t } = useI18n();
  const url = checkInUrl(code);

  return (
    <div className="text-center">
      {/* Latar putih tetap agar QR kontras dan mudah dipindai di tema gelap. */}
      <div className="rounded-xl border rule-line p-3 mx-auto w-fit" style={{ background: "#ffffff" }}>
        <QrImage payload={url} size={236} label={`${t("attendance.qrAlt")} ${code}`} />
      </div>
      <div className="mt-3 flex items-center justify-center gap-2">
        <span className="tech-no">{t("attendance.codeLabel")}</span>
        <code className="font-mono2 text-lg font-semibold tracking-[0.22em]">{code}</code>
        <CopyButton text={code} label={t("attendance.copyCode")} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <CopyButton text={url} label={t("attendance.copyLink")} idleText={t("attendance.copyLink")} />
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-xs underline underline-offset-2"
          style={{ color: "var(--muted)" }}
        >
          {t("attendance.openLink")}
        </a>
      </div>
      <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
        {hint ?? t("attendance.qrHint")}
      </p>
    </div>
  );
}
