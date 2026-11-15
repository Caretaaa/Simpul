import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff } from "lucide-react";
import { useI18n } from "../../lib/I18nContext";

/**
 * Pemindai QR berbasis kamera (jsQR). Kolom kode manual tetap tersedia di
 * halaman induk sehingga perangkat tanpa kamera / konteks non-HTTPS tetap
 * dapat memakai pemindai barcode USB.
 */
export function CameraScanner({
  onCode,
  disabled = false,
}: {
  onCode: (code: string) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  useEffect(() => stop, [stop]);

  async function start() {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(t("attendance.scanUnsupported"));
      return;
    }
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        setStarting(false);
        return;
      }
      video.srcObject = stream;
      await video.play();
      setActive(true);
      setStarting(false);

      timerRef.current = window.setInterval(() => {
        const canvas = canvasRef.current;
        const el = videoRef.current;
        if (!canvas || !el || el.readyState < 2 || el.videoWidth === 0) return;
        const scale = Math.min(1, 480 / el.videoWidth);
        canvas.width = Math.round(el.videoWidth * scale);
        canvas.height = Math.round(el.videoHeight * scale);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
        if (!found?.data) return;
        const now = Date.now();
        if (lastRef.current.code === found.data && now - lastRef.current.at < 3000) return;
        lastRef.current = { code: found.data, at: now };
        onCode(found.data);
      }, 150);
    } catch {
      setStarting(false);
      setError(t("attendance.scanCameraFail"));
      stop();
    }
  }

  return (
    <div className="space-y-2">
      <div
        className="relative rounded-lg overflow-hidden border rule-line"
        style={{ background: "var(--paper)", aspectRatio: active ? "4 / 3" : undefined }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          aria-label={t("attendance.scanTitle")}
          className={active ? "w-full h-full object-cover" : "hidden"}
        />
        {!active && (
          <div className="p-6 text-center">
            <p className="tech-no mb-1">{t("attendance.scanTitle")}</p>
            <p className="text-sm mx-auto max-w-sm" style={{ color: "var(--muted)" }}>
              {t("attendance.scanHint")}
            </p>
          </div>
        )}
        {active && (
          <span
            aria-hidden
            className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5"
            style={{ background: "var(--accent)", opacity: 0.55 }}
          />
        )}
        <canvas ref={canvasRef} className="hidden" aria-hidden />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={active ? "btn-ghost text-sm inline-flex items-center gap-2 min-h-11" : "btn-primary text-sm inline-flex items-center gap-2 min-h-11"}
          onClick={active ? stop : () => void start()}
          disabled={disabled || starting}
          aria-pressed={active}
        >
          {active ? <CameraOff size={16} aria-hidden /> : <Camera size={16} aria-hidden />}
          {starting ? t("attendance.scanStarting") : active ? t("attendance.scanStop") : t("attendance.scanStart")}
        </button>
        {disabled && (
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {t("attendance.closedNotice")}
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
