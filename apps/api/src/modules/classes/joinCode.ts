import { randomInt } from "node:crypto";

/**
 * Kode gabung kelas: 6 karakter tanpa huruf/angka ambigu (0/O, 1/I/L).
 * Contoh: "XK7P2Q". Murni & deterministik-aman untuk diuji.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

/** Normalisasi input siswa: huruf besar, tanpa spasi/tanda hubung. */
export function normalizeJoinCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]/g, "");
}
