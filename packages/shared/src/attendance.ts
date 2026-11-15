/**
 * Domain absensi kehadiran: status, kode sesi per mata pelajaran, dan
 * penormaan tautan/kode yang dipindai siswa. Dipakai bersama oleh API
 * (validasi/pencocokan kode) dan web (render QR sesi, input kode) agar
 * keduanya tidak pernah menyimpang.
 */

/** Status kehadiran yang dapat dicatat guru. */
export const ATTENDANCE_STATUSES = ["hadir", "terlambat", "izin", "sakit", "alpa"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === "string" && (ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

/** Alfabet tanpa karakter ambigu (0/O, 1/I) supaya kode aman diketik manual. */
export const ATTENDANCE_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
/** Panjang kode sesi — satu kode per sesi (kelas + mata pelajaran + tanggal). */
export const ATTENDANCE_SESSION_CODE_LENGTH = 8;

/** Halaman check-in siswa yang dibuka dari hasil pindai QR. */
export const ATTENDANCE_CHECKIN_PATH = "/absen";

/**
 * Bersihkan masukan: buang spasi dan tanda hubung, lalu samakan ke huruf besar.
 * Tidak memvalidasi panjang — pemanggil yang menentukan.
 */
export function normalizeAttendanceCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s\-_]/g, "");
}

/**
 * Ambil kode sesi dari tautan QR (`https://host/absen/KODE`), isi QR, maupun
 * ketikan biasa (boleh dengan spasi/tanda hubung). null bila bentuknya bukan
 * kode yang mungkin valid.
 */
export function parseAttendanceSessionInput(input: string): string | null {
  const raw = input.trim();
  const fromLink = raw.match(/\/absen\/([A-Za-z0-9\-_]+)(?:[?#].*)?$/i);
  const code = normalizeAttendanceCode(fromLink?.[1] ?? raw);
  if (code.length !== ATTENDANCE_SESSION_CODE_LENGTH) return null;
  return /^[A-Z0-9]+$/.test(code) ? code : null;
}

/** Path check-in relatif untuk sebuah kode sesi. */
export function attendanceCheckInPath(code: string): string {
  return `${ATTENDANCE_CHECKIN_PATH}/${normalizeAttendanceCode(code)}`;
}

/** URL absolut yang ditanam di QR sesi (dibuka kamera bawaan ponsel siswa). */
export function attendanceCheckInUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}${attendanceCheckInPath(code)}`;
}

/** Bangkitkan kode sesi baru (8 karakter, alfabet tanpa ambigu). */
export function generateAttendanceSessionCode(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < ATTENDANCE_SESSION_CODE_LENGTH; i++) {
    const idx = Math.floor(random() * ATTENDANCE_CODE_ALPHABET.length);
    const safe = Math.min(Math.max(idx, 0), ATTENDANCE_CODE_ALPHABET.length - 1);
    out += ATTENDANCE_CODE_ALPHABET[safe]!;
  }
  return out;
}
