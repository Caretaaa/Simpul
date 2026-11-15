import type { AttendanceStatus } from "@simpul/shared";

/** Bentuk respons API absensi (QR sesi per mata pelajaran). */
export interface AttendanceClass {
  id: string;
  name: string;
  grade: string;
  major: string;
  memberCount: number;
  homeroomTeacherName: string | null;
  isHomeroom: boolean;
  courses: Array<{ id: string; title: string }>;
  today: null | {
    sessionId: string;
    courseTitle: string | null;
    status: "open" | "closed";
    markedCount: number;
    memberCount: number;
  };
}

export interface AttendanceSessionSummary {
  id: string;
  classId: string;
  className: string;
  courseId: string | null;
  courseTitle: string | null;
  title: string;
  date: string;
  status: "open" | "closed";
  /** Kode sesi yang ditanam di QR — unik per kelas + mapel + tanggal. */
  code: string;
  memberCount: number;
  markedCount: number;
  presentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceStudentRow {
  id: string;
  name: string;
  email: string;
  status: AttendanceStatus | null;
  method: "scan" | "manual" | null;
  note: string | null;
  markedAt: string | null;
}

export interface AttendanceSummary {
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alpa: number;
  unmarked: number;
  total: number;
}

export interface AttendanceSessionDetail {
  id: string;
  classId: string;
  className: string;
  grade: string;
  courseId: string | null;
  courseTitle: string | null;
  title: string;
  date: string;
  status: "open" | "closed";
  code: string;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
  summary: AttendanceSummary;
  students: AttendanceStudentRow[];
}

/** Pratinjau sesi dari kode QR seperti yang dilihat siswa. */
export interface StudentSessionPreview {
  id: string;
  className: string;
  title: string;
  courseTitle: string | null;
  date: string;
  status: "open" | "closed";
  code: string;
  memberCount: number;
  presentCount: number;
  myStatus: AttendanceStatus | null;
  myMethod: "scan" | "manual" | null;
  myNote: string | null;
  myMarkedAt: string | null;
}

export interface StudentAttendanceHistoryRow {
  sessionId: string;
  date: string;
  title: string;
  courseTitle: string | null;
  className: string;
  status: AttendanceStatus;
  method: "scan" | "manual";
  note: string | null;
  markedAt: string;
}

/** Tanggal lokal perangkat dalam format YYYY-MM-DD (untuk input tanggal). */
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Tanggal sesi "YYYY-MM-DD" → ISO untuk formatDate i18n. */
export function sessionDateIso(date: string): string {
  return `${date}T00:00:00`;
}

export function statusColor(status: AttendanceStatus): string {
  switch (status) {
    case "hadir":
      return "var(--ok)";
    case "terlambat":
      return "var(--warn)";
    case "izin":
      return "var(--teal)";
    case "sakit":
      return "var(--accent)";
    case "alpa":
      return "var(--danger)";
  }
}

export function statusKey(status: AttendanceStatus): string {
  return `attendance.status.${status}`;
}
