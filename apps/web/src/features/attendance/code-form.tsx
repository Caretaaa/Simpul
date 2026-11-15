import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { ATTENDANCE_SESSION_CODE_LENGTH, attendanceCheckInPath, parseAttendanceSessionInput } from "@simpul/shared";
import { useI18n } from "../../lib/I18nContext";

/**
 * Formulir kode sesi untuk siswa yang tidak memindai QR (kamera rusak, izin
 * kamera ditolak, atau membuka aplikasi langsung).
 */
export function SessionCodeForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const code = parseAttendanceSessionInput(value);
        if (!code) {
          setError(t("attendance.codeInvalid"));
          return;
        }
        setError(null);
        navigate(attendanceCheckInPath(code));
      }}
      aria-label={t("attendance.codeFormTitle")}
    >
      <label htmlFor="attendance-code" className="text-sm font-medium">
        {t("attendance.codeInputLabel")}
      </label>
      <div className="flex flex-col sm:flex-row gap-2 mt-1">
        <input
          id="attendance-code"
          className="input font-mono2 tracking-[0.18em] uppercase"
          placeholder={t("attendance.codePlaceholder")}
          value={value}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={ATTENDANCE_SESSION_CODE_LENGTH + 4}
          autoFocus={autoFocus}
          aria-invalid={error !== null}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
        />
        <button
          type="submit"
          className="btn-primary text-sm shrink-0 min-h-11 px-4 inline-flex items-center justify-center gap-2"
          disabled={value.trim().length === 0}
        >
          <KeyRound size={15} aria-hidden /> {t("attendance.codeSubmit")}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs mt-1.5" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </form>
  );
}
