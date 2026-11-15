/**
 * Domain absensi kehadiran: status, format kode kartu siswa, dan pembersihan
 * hasil pindai. Dipakai bersama oleh API (validasi/pencocokan kode) dan web
 * (render QR, input pemindai) agar keduanya tidak pernah menyimpang.
 */

/** Status kehadiran yang dapat dicatat guru. */
export const ATTENDANCE_STATUSES = ["hadir", "terlambat", "izin", "sakit", "alpa"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === "string" && (ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

/** Awalan isi QR agar kode yang dipindai mudah dikenali sebagai kartu SIMPUL. */
export const ATTENDANCE_QR_PREFIX = "SIMPUL:ATT:";

/** Alfabet tanpa karakter ambigu (0/O, 1/I) supaya kode aman diketik manual. */
export const ATTENDANCE_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const ATTENDANCE_CODE_LENGTH = 10;

/**
 * Bersihkan masukan pemindai/manusia: buang awalan QR, spasi, dan tanda hubung,
 * lalu samakan ke huruf besar. Tidak memvalidasi panjang — pemanggil yang
 * menentukan (pencarian kode boleh toleran, penerbitan kode tidak).
 */
export function normalizeAttendanceCode(input: string): string {
  const upper = input.trim().toUpperCase();
  const bare = upper.startsWith(ATTENDANCE_QR_PREFIX) ? upper.slice(ATTENDANCE_QR_PREFIX.length) : upper;
  return bare.replace(/[\s\-_]/g, "");
}

/** Format isi QR untuk sebuah kode kartu siswa. */
export function attendanceQrPayload(code: string): string {
  return `${ATTENDANCE_QR_PREFIX}${normalizeAttendanceCode(code)}`;
}

/**
 * Terima kode telanjang maupun isi QR lengkap (termasuk tautan sederhana
 * `.../card/CODE` yang mungkin tertulis di kartu cetak).
 */
export function parseAttendancePayload(input: string): string | null {
  const code = normalizeAttendanceCode(input.replace(/^.*[\/=]/, ""));
  return /^[A-Z0-9]{6,20}$/.test(code) ? code : null;
}

/** Bangkitkan kode kartu baru (10 karakter, alfabet tanpa ambigu). */
export function generateAttendanceCode(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < ATTENDANCE_CODE_LENGTH; i++) {
    const idx = Math.floor(random() * ATTENDANCE_CODE_ALPHABET.length);
    const safe = Math.min(Math.max(idx, 0), ATTENDANCE_CODE_ALPHABET.length - 1);
    out += ATTENDANCE_CODE_ALPHABET[safe]!;
  }
  return out;
}
