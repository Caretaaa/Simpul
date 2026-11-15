import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_CODE_ALPHABET,
  ATTENDANCE_CODE_LENGTH,
  ATTENDANCE_STATUSES,
  attendanceQrPayload,
  generateAttendanceCode,
  isAttendanceStatus,
  normalizeAttendanceCode,
  parseAttendancePayload,
} from "./attendance.js";

describe("domain absensi", () => {
  it("hanya menerima status kehadiran yang dikenal", () => {
    for (const s of ATTENDANCE_STATUSES) expect(isAttendanceStatus(s)).toBe(true);
    expect(isAttendanceStatus("bolos")).toBe(false);
    expect(isAttendanceStatus(null)).toBe(false);
  });

  it("menormalkan kode dari hasil pindai maupun ketikan", () => {
    expect(normalizeAttendanceCode("  simpul:att:7kx2-m9pq4t ")).toBe("7KX2M9PQ4T");
    expect(normalizeAttendanceCode("7kx2 m9pq4t")).toBe("7KX2M9PQ4T");
    expect(attendanceQrPayload("7kx2m9pq4t")).toBe("SIMPUL:ATT:7KX2M9PQ4T");
  });

  it("mem-parse isi QR lengkap dan tautan kartu tanpa kebingungan", () => {
    expect(parseAttendancePayload("SIMPUL:ATT:7KX2M9PQ4T")).toBe("7KX2M9PQ4T");
    expect(parseAttendancePayload("https://simpul.sch.id/card/7KX2M9PQ4T")).toBe("7KX2M9PQ4T");
    expect(parseAttendancePayload("bukan kode!")).toBeNull();
    expect(parseAttendancePayload("123")).toBeNull();
  });

  it("membangkitkan kode sesuai alfabet dan panjang tetap, unik per panggilan", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const code = generateAttendanceCode();
      expect(code).toHaveLength(ATTENDANCE_CODE_LENGTH);
      for (const ch of code) expect(ATTENDANCE_CODE_ALPHABET).toContain(ch);
      codes.add(code);
    }
    expect(codes.size).toBe(500);
  });
});
