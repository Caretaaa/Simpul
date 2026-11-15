import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ATTENDANCE_STATUSES,
  generateAttendanceSessionCode,
  parseAttendanceSessionInput,
} from "@simpul/shared";
import { getDb, type Db } from "../../db/connection.js";
import {
  attendanceRecords,
  attendanceSessions,
  auditLogs,
  classMemberships,
  classes,
  courses,
  users,
} from "../../db/schema.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

/**
 * Absensi dengan QR per sesi: guru menampilkan QR sesi (satu per kelas +
 * mata pelajaran + tanggal), siswa memindai dengan ponselnya sendiri lalu
 * menandai kehadiran. Guru tetap dapat menandai daftar secara manual.
 */

/** Tanggal sekolah (YYYY-MM-DD) menurut zona waktu Indonesia Barat. */
function schoolToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

const DateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD.")
  .refine((value) => {
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }, "Tanggal tidak valid.");

const CreateSessionSchema = z.object({
  classId: z.string().min(1, "Kelas wajib dipilih."),
  courseId: z.string().min(1).nullable().optional(),
  date: DateOnlySchema.optional(),
  title: z.string().trim().min(3, "Judul sesi minimal 3 karakter.").max(120).optional(),
});

const RecordSchema = z.object({
  studentId: z.string().min(1, "Siswa wajib dipilih."),
  status: z.enum(ATTENDANCE_STATUSES).nullable(),
  note: z.string().trim().max(300, "Catatan maksimal 300 karakter.").nullable().optional(),
});

const PatchSessionSchema = z.object({
  status: z.enum(["open", "closed"]).optional(),
  title: z.string().trim().min(3, "Judul sesi minimal 3 karakter.").max(120).optional(),
});

type Role = "admin" | "guru" | "siswa";

/** ISO string aman dari Date/number/string apa pun (null bila tak terbaca). */
function iso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Kelas yang boleh diakses: admin semua, guru yang mengajar/menjadi wali. */
async function classScope(db: Db, user: { id: string; role: Role }): Promise<{ all: boolean; ids: Set<string> }> {
  if (user.role === "admin") return { all: true, ids: new Set<string>() };
  const myCourses = await db.select().from(courses).where(eq(courses.teacherId, user.id));
  const taught = new Set(myCourses.map((c) => c.classId).filter((id): id is string => Boolean(id)));
  const all = await db.select().from(classes);
  const ids = new Set(all.filter((k) => k.homeroomTeacherId === user.id || taught.has(k.id)).map((k) => k.id));
  return { all: false, ids };
}

async function canAccessClass(db: Db, user: { id: string; role: Role }, classId: string): Promise<boolean> {
  const scope = await classScope(db, user);
  return scope.all || scope.ids.has(classId);
}

async function isClassMember(db: Db, classId: string, studentId: string): Promise<boolean> {
  const members = await db.select().from(classMemberships).where(eq(classMemberships.classId, classId));
  return members.some((m) => m.studentId === studentId);
}

/**
 * Pastikan sesi punya kode unik. Sesi lama (sebelum fitur QR sesi) belum punya
 * kode sehingga diisi malas saat pertama dibaca; kode tidak pernah berubah,
 * jadi QR yang sudah dicetak tetap berlaku.
 */
async function ensureSessionCode(
  db: Db,
  session: typeof attendanceSessions.$inferSelect,
): Promise<string> {
  if (session.code) return session.code;
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateAttendanceSessionCode();
    const clash = await db.select().from(attendanceSessions).where(eq(attendanceSessions.code, code));
    if (clash[0]) continue;
    await db.update(attendanceSessions).set({ code }).where(eq(attendanceSessions.id, session.id));
    session.code = code;
    return code;
  }
  // Praktis tidak tercapai (32^8 kombinasi) — pakai cap waktu sebagai jalan terakhir.
  const fallback = `${generateAttendanceSessionCode().slice(0, 5)}${Date.now().toString(36).toUpperCase().slice(-3)}`;
  await db.update(attendanceSessions).set({ code: fallback }).where(eq(attendanceSessions.id, session.id));
  session.code = fallback;
  return fallback;
}

interface Roster {
  students: Array<typeof users.$inferSelect>;
}

async function loadRoster(db: Db, classId: string): Promise<Roster> {
  const memberships = await db.select().from(classMemberships).where(eq(classMemberships.classId, classId));
  const allUsers = await db.select().from(users);
  const byId = new Map(allUsers.map((u) => [u.id, u]));
  const students = memberships
    .map((m) => byId.get(m.studentId))
    .filter((u): u is typeof users.$inferSelect => Boolean(u))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
  return { students };
}

function summarize(
  statuses: Array<"hadir" | "terlambat" | "izin" | "sakit" | "alpa">,
  total: number,
): { hadir: number; terlambat: number; izin: number; sakit: number; alpa: number; unmarked: number; total: number } {
  const count = (s: string) => statuses.filter((v) => v === s).length;
  return {
    hadir: count("hadir"),
    terlambat: count("terlambat"),
    izin: count("izin"),
    sakit: count("sakit"),
    alpa: count("alpa"),
    unmarked: Math.max(total - statuses.length, 0),
    total,
  };
}

async function sessionSummary(db: Db, sessionId: string, total: number) {
  const records = await db.select().from(attendanceRecords).where(eq(attendanceRecords.sessionId, sessionId));
  return summarize(records.map((r) => r.status), total);
}

async function loadSession(db: Db, sessionId: string) {
  const rows = await db.select().from(attendanceSessions).where(eq(attendanceSessions.id, sessionId));
  return rows[0] ?? null;
}

async function loadSessionByCode(db: Db, code: string) {
  const rows = await db.select().from(attendanceSessions).where(eq(attendanceSessions.code, code));
  return rows[0] ?? null;
}

async function buildSessionDetail(db: Db, session: typeof attendanceSessions.$inferSelect) {
  const klass = (await db.select().from(classes).where(eq(classes.id, session.classId)))[0] ?? null;
  const course = session.courseId
    ? ((await db.select().from(courses).where(eq(courses.id, session.courseId)))[0] ?? null)
    : null;
  const creator = session.createdBy
    ? ((await db.select().from(users).where(eq(users.id, session.createdBy)))[0] ?? null)
    : null;
  const { students } = await loadRoster(db, session.classId);
  const records = await db.select().from(attendanceRecords).where(eq(attendanceRecords.sessionId, session.id));
  const byStudent = new Map(records.map((r) => [r.studentId, r]));
  const code = await ensureSessionCode(db, session);

  const roster = students.map((student) => {
    const record = byStudent.get(student.id);
    return {
      id: student.id,
      name: student.name,
      email: student.email,
      status: record?.status ?? null,
      method: record?.method ?? null,
      note: record?.note ?? null,
      markedAt: iso(record?.markedAt),
    };
  });

  return {
    id: session.id,
    classId: session.classId,
    className: klass?.name ?? "—",
    grade: klass?.grade ?? "—",
    courseId: session.courseId,
    courseTitle: course?.title ?? null,
    title: session.title,
    date: session.date,
    status: session.status,
    code,
    createdAt: iso(session.createdAt) ?? "",
    updatedAt: iso(session.updatedAt) ?? "",
    createdByName: creator?.name ?? null,
    summary: summarize(records.map((r) => r.status), roster.length),
    students: roster,
  };
}

export async function attendanceRoutes(app: FastifyInstance): Promise<void> {
  const teacherOnly = requireRole(["guru", "admin"]);
  const studentOnly = requireRole(["siswa"]);

  // Kelas yang dapat diabsen guru beserta sesi hari ini.
  app.get("/classes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!teacherOnly(req, reply)) return;
    const db = getDb();
    const scope = await classScope(db, req.user!);
    const allClasses = await db.select().from(classes).orderBy(classes.name);
    const mine = scope.all ? allClasses : allClasses.filter((k) => scope.ids.has(k.id));
    const courseRows = await db.select().from(courses);
    const memberships = await db.select().from(classMemberships);
    const staff = await db.select().from(users);
    const staffName = new Map(staff.map((u) => [u.id, u.name]));
    const today = schoolToday();
    const todaySessions = (await db.select().from(attendanceSessions).where(eq(attendanceSessions.date, today))).sort(
      (a, b) => (iso(b.createdAt) ?? "").localeCompare(iso(a.createdAt) ?? ""),
    );
    const allRecords = await db.select().from(attendanceRecords);

    const result = mine.map((klass) => {
      const members = memberships.filter((m) => m.classId === klass.id);
      const classCourses = courseRows.filter(
        (c) => c.classId === klass.id && (scope.all || c.teacherId === req.user!.id),
      );
      const candidates = todaySessions.filter((s) => s.classId === klass.id);
      const chosen = candidates.find((s) => s.createdBy === req.user!.id) ?? candidates[0] ?? null;
      const markedCount = chosen ? allRecords.filter((r) => r.sessionId === chosen.id).length : 0;
      return {
        id: klass.id,
        name: klass.name,
        grade: klass.grade,
        major: klass.major,
        memberCount: members.length,
        homeroomTeacherName: klass.homeroomTeacherId ? (staffName.get(klass.homeroomTeacherId) ?? null) : null,
        isHomeroom: klass.homeroomTeacherId === req.user!.id,
        courses: classCourses.map((c) => ({ id: c.id, title: c.title })),
        today: chosen
          ? {
              sessionId: chosen.id,
              courseTitle: (() => {
                const course = courseRows.find((c) => c.id === chosen.courseId);
                return course?.title ?? null;
              })(),
              status: chosen.status,
              markedCount,
              memberCount: members.length,
            }
          : null,
      };
    });

    return reply.send({ classes: result });
  });

  // Daftar sesi terbaru pada kelas yang boleh diakses.
  app.get("/sessions", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!teacherOnly(req, reply)) return;
    const query = req.query as { classId?: string; limit?: string };
    const db = getDb();
    const scope = await classScope(db, req.user!);
    if (query.classId && !(scope.all || scope.ids.has(query.classId))) {
      return reply.code(403).send({ message: "Anda tidak mengajar pada kelas ini." });
    }
    const limitRaw = Number(query.limit ?? 20);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 100) : 20;

    const rows = await db.select().from(attendanceSessions).orderBy(desc(attendanceSessions.createdAt)).limit(200);
    const visible = rows
      .filter((s) => (scope.all || scope.ids.has(s.classId)) && (!query.classId || s.classId === query.classId))
      .slice(0, limit);

    const allClasses = await db.select().from(classes);
    const classById = new Map(allClasses.map((k) => [k.id, k]));
    const allCourses = await db.select().from(courses);
    const courseById = new Map(allCourses.map((c) => [c.id, c]));
    const memberships = await db.select().from(classMemberships);
    const records = await db.select().from(attendanceRecords);

    const sessions = [];
    for (const s of visible) {
      const memberCount = memberships.filter((m) => m.classId === s.classId).length;
      const own = records.filter((r) => r.sessionId === s.id);
      sessions.push({
        id: s.id,
        classId: s.classId,
        className: classById.get(s.classId)?.name ?? "—",
        courseId: s.courseId,
        courseTitle: s.courseId ? (courseById.get(s.courseId)?.title ?? null) : null,
        title: s.title,
        date: s.date,
        status: s.status,
        code: await ensureSessionCode(db, s),
        memberCount,
        markedCount: own.length,
        presentCount: own.filter((r) => r.status === "hadir").length,
        createdAt: iso(s.createdAt) ?? "",
        updatedAt: iso(s.updatedAt) ?? "",
      });
    }

    return reply.send({ sessions });
  });

  // Buka sesi absensi; idempoten untuk sesi terbuka yang sama.
  app.post("/sessions", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!teacherOnly(req, reply)) return;
    const parsed = CreateSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Data sesi absensi tidak valid.", details: parsed.error.flatten().fieldErrors });
    }
    const db = getDb();
    if (!(await canAccessClass(db, req.user!, parsed.data.classId))) {
      return reply.code(403).send({ message: "Anda tidak mengajar pada kelas ini." });
    }
    const klass = (await db.select().from(classes).where(eq(classes.id, parsed.data.classId)))[0];
    if (!klass) return reply.code(404).send({ message: "Kelas tidak ditemukan." });

    const courseId = parsed.data.courseId && parsed.data.courseId.length > 0 ? parsed.data.courseId : null;
    let courseTitle: string | null = null;
    if (courseId) {
      const course = (await db.select().from(courses).where(eq(courses.id, courseId)))[0];
      if (!course || course.classId !== klass.id) {
        return reply.code(400).send({ message: "Mata pelajaran tidak terdaftar pada kelas ini." });
      }
      if (req.user!.role === "guru" && course.teacherId !== req.user!.id) {
        return reply.code(403).send({ message: "Anda tidak mengajar mata pelajaran ini." });
      }
      courseTitle = course.title;
    }

    const date = parsed.data.date ?? schoolToday();
    const existing = (
      await db.select().from(attendanceSessions).where(eq(attendanceSessions.classId, klass.id))
    ).find((s) => s.date === date && s.status === "open" && (s.courseId ?? null) === courseId);
    if (existing) {
      return reply.send({ session: await buildSessionDetail(db, existing), created: false });
    }

    const now = new Date();
    const row = {
      id: randomUUID(),
      classId: klass.id,
      courseId,
      title: parsed.data.title ?? courseTitle ?? "Absensi harian",
      date,
      code: generateAttendanceSessionCode(),
      status: "open" as const,
      createdBy: req.user!.id,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(attendanceSessions).values(row);
    await db.insert(auditLogs).values({
      id: randomUUID(),
      actorId: req.user!.id,
      action: "attendance.open",
      entity: "attendance_session",
      entityId: row.id,
      metadata: JSON.stringify({ classId: klass.id, courseId, date }),
      createdAt: now,
    });
    return reply.code(201).send({ session: await buildSessionDetail(db, row), created: true });
  });

  /**
   * Pratinjau sesi dari kode QR untuk siswa: memastikan kode valid dan siswa
   * benar anggota kelas, sekaligus memberi tahu status kehadirannya saat ini.
   */
  app.get("/sessions/by-code/:code", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!studentOnly(req, reply)) return;
    const { code } = req.params as { code: string };
    const normalized = parseAttendanceSessionInput(code);
    if (!normalized) return reply.code(404).send({ message: "Kode absensi tidak dikenali." });

    const db = getDb();
    const session = await loadSessionByCode(db, normalized);
    if (!session) return reply.code(404).send({ message: "Kode absensi tidak dikenali." });
    if (!(await isClassMember(db, session.classId, req.user!.id))) {
      return reply.code(403).send({ message: "Anda bukan anggota kelas sesi absensi ini." });
    }
    const klass = (await db.select().from(classes).where(eq(classes.id, session.classId)))[0] ?? null;
    const course = session.courseId
      ? ((await db.select().from(courses).where(eq(courses.id, session.courseId)))[0] ?? null)
      : null;
    const members = await db.select().from(classMemberships).where(eq(classMemberships.classId, session.classId));
    const records = await db.select().from(attendanceRecords).where(eq(attendanceRecords.sessionId, session.id));
    const mine = records.find((r) => r.studentId === req.user!.id);

    return reply.send({
      session: {
        id: session.id,
        className: klass?.name ?? "—",
        title: session.title,
        courseTitle: course?.title ?? null,
        date: session.date,
        status: session.status,
        code: await ensureSessionCode(db, session),
        memberCount: members.length,
        presentCount: records.filter((r) => r.status === "hadir").length,
        myStatus: mine?.status ?? null,
        myMethod: mine?.method ?? null,
        myNote: mine?.note ?? null,
        myMarkedAt: iso(mine?.markedAt),
      },
    });
  });

  /** Siswa menandai kehadirannya sendiri dari QR sesi. */
  app.post("/sessions/by-code/:code/check-in", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!studentOnly(req, reply)) return;
    const { code } = req.params as { code: string };
    const normalized = parseAttendanceSessionInput(code);
    if (!normalized) return reply.code(404).send({ message: "Kode absensi tidak dikenali." });

    const db = getDb();
    const session = await loadSessionByCode(db, normalized);
    if (!session) return reply.code(404).send({ message: "Kode absensi tidak dikenali." });
    if (!(await isClassMember(db, session.classId, req.user!.id))) {
      return reply.code(403).send({ message: "Anda bukan anggota kelas sesi absensi ini." });
    }
    if (session.status !== "open") {
      return reply.code(409).send({ message: "Sesi absensi sudah ditutup oleh guru." });
    }

    const members = await db.select().from(classMemberships).where(eq(classMemberships.classId, session.classId));
    const existing = (
      await db.select().from(attendanceRecords).where(eq(attendanceRecords.sessionId, session.id))
    ).find((r) => r.studentId === req.user!.id);

    // Jangan menimpa catatan guru (izin/sakit/terlambat/alpa) maupun check-in
    // sebelumnya: kehadiran hanya bisa diubah guru lewat daftar manual.
    if (existing) {
      return reply.send({
        record: {
          studentId: existing.studentId,
          status: existing.status,
          method: existing.method,
          note: existing.note ?? null,
          markedAt: iso(existing.markedAt) ?? "",
        },
        summary: await sessionSummary(db, session.id, members.length),
        duplicate: true,
      });
    }

    const now = new Date();
    await db.insert(attendanceRecords).values({
      id: randomUUID(),
      sessionId: session.id,
      studentId: req.user!.id,
      status: "hadir",
      method: "scan",
      note: null,
      markedBy: req.user!.id,
      markedAt: now,
    });
    await db.update(attendanceSessions).set({ updatedAt: now }).where(eq(attendanceSessions.id, session.id));
    await db.insert(auditLogs).values({
      id: randomUUID(),
      actorId: req.user!.id,
      action: "attendance.checkin",
      entity: "attendance_session",
      entityId: session.id,
      metadata: JSON.stringify({ method: "scan" }),
      createdAt: now,
    });

    return reply.code(201).send({
      record: {
        studentId: req.user!.id,
        status: "hadir" as const,
        method: "scan" as const,
        note: null,
        markedAt: iso(now) ?? "",
      },
      summary: await sessionSummary(db, session.id, members.length),
      duplicate: false,
    });
  });

  app.get("/sessions/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!teacherOnly(req, reply)) return;
    const { id } = req.params as { id: string };
    const db = getDb();
    const session = await loadSession(db, id);
    if (!session) return reply.code(404).send({ message: "Sesi absensi tidak ditemukan." });
    if (!(await canAccessClass(db, req.user!, session.classId))) {
      return reply.code(403).send({ message: "Anda tidak mengajar pada kelas ini." });
    }
    return reply.send({ session: await buildSessionDetail(db, session) });
  });

  // Tandai manual per siswa (status null = hapus tanda).
  app.post("/sessions/:id/records", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!teacherOnly(req, reply)) return;
    const { id } = req.params as { id: string };
    const parsed = RecordSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Status kehadiran tidak valid.", details: parsed.error.flatten().fieldErrors });
    }
    const db = getDb();
    const session = await loadSession(db, id);
    if (!session) return reply.code(404).send({ message: "Sesi absensi tidak ditemukan." });
    if (!(await canAccessClass(db, req.user!, session.classId))) {
      return reply.code(403).send({ message: "Anda tidak mengajar pada kelas ini." });
    }
    if (session.status !== "open") {
      return reply.code(409).send({ message: "Sesi absensi sudah ditutup. Buka kembali untuk mengubah kehadiran." });
    }
    if (!(await isClassMember(db, session.classId, parsed.data.studentId))) {
      return reply.code(404).send({ message: "Siswa bukan anggota kelas ini." });
    }

    const members = await db.select().from(classMemberships).where(eq(classMemberships.classId, session.classId));
    const now = new Date();
    const existing = (
      await db.select().from(attendanceRecords).where(eq(attendanceRecords.sessionId, id))
    ).find((r) => r.studentId === parsed.data.studentId);

    if (parsed.data.status === null) {
      if (existing) await db.delete(attendanceRecords).where(eq(attendanceRecords.id, existing.id));
      await db.update(attendanceSessions).set({ updatedAt: now }).where(eq(attendanceSessions.id, id));
      return reply.send({ record: null, summary: await sessionSummary(db, id, members.length) });
    }

    const record = {
      status: parsed.data.status,
      method: "manual" as const,
      note: parsed.data.note ?? null,
      markedBy: req.user!.id,
      markedAt: now,
    };
    if (existing) {
      await db.update(attendanceRecords).set(record).where(eq(attendanceRecords.id, existing.id));
    } else {
      await db.insert(attendanceRecords).values({
        id: randomUUID(),
        sessionId: id,
        studentId: parsed.data.studentId,
        ...record,
      });
    }
    await db.update(attendanceSessions).set({ updatedAt: now }).where(eq(attendanceSessions.id, id));

    const saved = (
      await db.select().from(attendanceRecords).where(eq(attendanceRecords.sessionId, id))
    ).find((r) => r.studentId === parsed.data.studentId);
    return reply.send({
      record: saved
        ? {
            studentId: saved.studentId,
            status: saved.status,
            method: saved.method,
            note: saved.note ?? null,
            markedAt: iso(saved.markedAt) ?? "",
          }
        : null,
      summary: await sessionSummary(db, id, members.length),
    });
  });

  app.patch("/sessions/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!teacherOnly(req, reply)) return;
    const { id } = req.params as { id: string };
    const parsed = PatchSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Perubahan sesi tidak valid.", details: parsed.error.flatten().fieldErrors });
    }
    if (parsed.data.status === undefined && parsed.data.title === undefined) {
      return reply.code(400).send({ message: "Tidak ada perubahan yang dikirim." });
    }
    const db = getDb();
    const session = await loadSession(db, id);
    if (!session) return reply.code(404).send({ message: "Sesi absensi tidak ditemukan." });
    if (!(await canAccessClass(db, req.user!, session.classId))) {
      return reply.code(403).send({ message: "Anda tidak mengajar pada kelas ini." });
    }
    if (session.status === "closed" && parsed.data.status !== "open") {
      return reply.code(409).send({ message: "Sesi absensi sudah ditutup. Buka kembali untuk mengubahnya." });
    }
    const now = new Date();
    await db
      .update(attendanceSessions)
      .set({
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        updatedAt: now,
      })
      .where(eq(attendanceSessions.id, id));
    await db.insert(auditLogs).values({
      id: randomUUID(),
      actorId: req.user!.id,
      action: parsed.data.status === "closed" ? "attendance.close" : "attendance.update",
      entity: "attendance_session",
      entityId: id,
      createdAt: now,
    });
    const updated = await loadSession(db, id);
    return reply.send({ session: await buildSessionDetail(db, updated!) });
  });

  app.delete("/sessions/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!teacherOnly(req, reply)) return;
    const { id } = req.params as { id: string };
    const db = getDb();
    const session = await loadSession(db, id);
    if (!session) return reply.code(404).send({ message: "Sesi absensi tidak ditemukan." });
    if (!(await canAccessClass(db, req.user!, session.classId))) {
      return reply.code(403).send({ message: "Anda tidak mengajar pada kelas ini." });
    }
    await db.delete(attendanceSessions).where(eq(attendanceSessions.id, id));
    await db.insert(auditLogs).values({
      id: randomUUID(),
      actorId: req.user!.id,
      action: "attendance.delete",
      entity: "attendance_session",
      entityId: id,
      createdAt: new Date(),
    });
    return reply.send({ ok: true });
  });

  // Riwayat kehadiran siswa yang sedang masuk.
  app.get("/me", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!studentOnly(req, reply)) return;
    const db = getDb();
    const me = (await db.select().from(users).where(eq(users.id, req.user!.id)))[0];
    if (!me) return reply.code(404).send({ message: "Akun tidak ditemukan." });

    const memberships = await db.select().from(classMemberships).where(eq(classMemberships.studentId, me.id));
    const allClasses = await db.select().from(classes);
    const classById = new Map(allClasses.map((k) => [k.id, k]));

    const myRecords = (
      await db.select().from(attendanceRecords).where(eq(attendanceRecords.studentId, me.id))
    )
      .sort((a, b) => (iso(b.markedAt) ?? "").localeCompare(iso(a.markedAt) ?? ""))
      .slice(0, 60);
    const sessions = await db.select().from(attendanceSessions);
    const sessionById = new Map(sessions.map((s) => [s.id, s]));
    const allCourses = await db.select().from(courses);
    const courseById = new Map(allCourses.map((c) => [c.id, c]));

    return reply.send({
      classes: memberships
        .map((m) => classById.get(m.classId))
        .filter((k): k is typeof classes.$inferSelect => Boolean(k))
        .map((k) => ({ id: k.id, name: k.name })),
      history: myRecords
        .map((r) => {
          const session = sessionById.get(r.sessionId);
          if (!session) return null;
          return {
            sessionId: session.id,
            date: session.date,
            title: session.title,
            courseTitle: session.courseId ? (courseById.get(session.courseId)?.title ?? null) : null,
            className: classById.get(session.classId)?.name ?? "—",
            status: r.status,
            method: r.method,
            note: r.note ?? null,
            markedAt: iso(r.markedAt) ?? "",
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null),
    });
  });
}
