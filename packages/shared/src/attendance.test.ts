import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_CODE_ALPHABET,
  ATTENDANCE_SESSION_CODE_LENGTH,
  ATTENDANCE_STATUSES,
  attendanceCheckInPath,
  attendanceCheckInUrl,
  generateAttendanceSessionCode,
  isAttendanceStatus,
  normalizeAttendanceCode,
  parseAttendanceSessionInput,
} from "./attendance.js";

describe("domain absensi", () => {
  it("hanya menerima status kehadiran yang dikenal", () => {
    for (const s of ATTENDANCE_STATUSES) expect(isAttendanceStatus(s)).toBe(true);
    expect(isAttendanceStatus("bolos")).toBe(false);
    expect(isAttendanceStatus(null)).toBe(false);
  });

  it("menormalkan kode sesi dari hasil pindai maupun ketikan", () => {
    expect(normalizeAttendanceCode(" 7kx2-m9pq ")).toBe("7KX2M9PQ");
    expect(parseAttendanceSessionInput("7kx2 m9pq")).toBe("7KX2M9PQ");
    expect(parseAttendanceSessionInput("7KX2-M9PQ")).toBe("7KX2M9PQ");
  });

  it("mengambil kode sesi dari tautan QR yang dibuka kamera ponsel", () => {
    expect(parseAttendanceSessionInput("https://simpul.sch.id/absen/7KX2M9PQ")).toBe("7KX2M9PQ");
    expect(parseAttendanceSessionInput("http://localhost:5173/absen/7KX2M9PQ?ref=qr")).toBe("7KX2M9PQ");
    expect(attendanceCheckInPath("7kx2m9pq")).toBe("/absen/7KX2M9PQ");
    expect(attendanceCheckInUrl("https://simpul.sch.id/", "7kx2m9pq")).toBe(
      "https://simpul.sch.id/absen/7KX2M9PQ",
    );
  });

  it("menolak bentuk yang bukan kode sesi", () => {
    expect(parseAttendanceSessionInput("bukan kode!")).toBeNull();
    expect(parseAttendanceSessionInput("123")).toBeNull();
    expect(parseAttendanceSessionInput("https://simpul.sch.id/absen/")).toBeNull();
  });

  it("membangkitkan kode sesuai alfabet dan panjang tetap, unik per panggilan", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const code = generateAttendanceSessionCode();
      expect(code).toHaveLength(ATTENDANCE_SESSION_CODE_LENGTH);
      for (const ch of code) expect(ATTENDANCE_CODE_ALPHABET).toContain(ch);
      codes.add(code);
    }
    expect(codes.size).toBe(500);
  });
});
