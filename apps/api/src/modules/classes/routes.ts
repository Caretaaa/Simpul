import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDb, type Db } from "../../db/connection.js";
import {
  academicYears,
  auditLogs,
  classMemberships,
  classes,
  courseEnrollments,
  courses,
  users,
} from "../../db/schema.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { generateJoinCode, normalizeJoinCode } from "./joinCode.js";

const CreateClassSchema = z
  .object({
    name: z.string().min(3, "Nama kelas minimal 3 karakter").max(120),
    grade: z.enum(["X", "XI", "XII"], { errorMap: () => ({ message: "Tingkat harus X, XI, atau XII." }) }),
    major: z.string().max(60).optional(),
    academicYearId: z.string().min(1, "Tahun ajaran wajib dipilih."),
    /** Kosongkan string untuk melepas wali kelas. */
    homeroomTeacherId: z.string().max(64).optional(),
    /** Siswa yang langsung dimasukkan sebagai anggota (khusus admin). */
    studentIds: z.array(z.string().min(1)).max(200).optional(),
  });

/** Validasi daftar siswa: harus ada, berperan siswa, dan aktif. */
async function resolveStudents(db: Db, studentIds: string[]): Promise<{ ok: true } | { ok: false; message: string }> {
  const unique = [...new Set(studentIds)];
  if (unique.length === 0) return { ok: true };
  const all = await db.select().from(users);
  const byId = new Map(all.map((u) => [u.id, u]));
  for (const sid of unique) {
    const u = byId.get(sid);
    if (!u) return { ok: false, message: "Salah satu siswa yang dipilih tidak ditemukan." };
    if (u.role !== "siswa" || !u.isActive) {
      return { ok: false, message: `Akun ${u.name} bukan siswa aktif sehingga tidak dapat dimasukkan ke kelas.` };
    }
  }
  return { ok: true };
}

/** Validasi wali kelas: harus akun guru yang aktif (atau null = tanpa wali). */
async function resolveHomeroom(
  db: Db,
  homeroomTeacherId: string | null | undefined,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (homeroomTeacherId === undefined || homeroomTeacherId === null) return { ok: true };
  const rows = await db.select().from(users).where(eq(users.id, homeroomTeacherId));
  const u = rows[0];
  if (!u || u.role !== "guru" || !u.isActive) {
    return { ok: false, message: "Wali kelas harus dipilih dari akun guru yang aktif." };
  }
  return { ok: true };
}

const JoinClassSchema = z.object({
  code: z.string().min(4, "Kode kelas minimal 4 karakter").max(12),
});

/** Bangkitkan kode gabung yang belum dipakai (coba ulang bila tabrakan). */
async function uniqueJoinCode(db: Db): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateJoinCode();
    const existing = await db.select().from(classes).where(eq(classes.joinCode, code));
    if (!existing[0]) return code;
  }
  // Praktis tidak tercapai (34^6 kombinasi); gabung dengan stempel waktu.
  return `${generateJoinCode()}${Date.now().toString(36).toUpperCase().slice(-2)}`;
}

/** Isi kode gabung untuk kelas lama yang belum punya (migrasi malas). */
async function ensureJoinCode(db: Db, klass: typeof classes.$inferSelect): Promise<string> {
  if (klass.joinCode) return klass.joinCode;
  const code = await uniqueJoinCode(db);
  await db.update(classes).set({ joinCode: code, updatedAt: new Date() }).where(eq(classes.id, klass.id));
  return code;
}

export interface ClassCard {
  id: string;
  name: string;
  grade: string;
  major: string;
  academicYearId: string | null;
  academicYearName: string | null;
  homeroomTeacherId: string | null;
  homeroomTeacherName: string | null;
  joinCode: string;
  memberCount: number;
  courseCount: number;
  isMember?: boolean;
}

/** Rakit kartu kelas lengkap dengan hitungan anggota & kursus. */
async function buildClassCards(
  db: Db,
  rows: Array<typeof classes.$inferSelect>,
  opts: { studentId?: string } = {},
): Promise<ClassCard[]> {
  const years = new Map((await db.select().from(academicYears)).map((y) => [y.id, y.name]));
  const teachers = new Map((await db.select().from(users)).map((u) => [u.id, u.name]));
  const memberships = await db.select().from(classMemberships);
  const courseRows = await db.select().from(courses);
  const cards: ClassCard[] = [];
  for (const klass of rows) {
    const joinCode = await ensureJoinCode(db, klass);
    const members = memberships.filter((m) => m.classId === klass.id);
    cards.push({
      id: klass.id,
      name: klass.name,
      grade: klass.grade,
      major: klass.major,
      academicYearId: klass.academicYearId,
      academicYearName: klass.academicYearId ? (years.get(klass.academicYearId) ?? null) : null,
      homeroomTeacherId: klass.homeroomTeacherId,
      homeroomTeacherName: klass.homeroomTeacherId ? (teachers.get(klass.homeroomTeacherId) ?? null) : null,
      joinCode,
      memberCount: members.length,
      courseCount: courseRows.filter((c) => c.classId === klass.id).length,
      ...(opts.studentId !== undefined ? { isMember: members.some((m) => m.studentId === opts.studentId) } : {}),
    });
  }
  return cards;
}

/** Apakah guru mengajar (memiliki kursus) pada kelas ini? */
async function teacherOwnsClass(db: Db, teacherId: string, classId: string): Promise<boolean> {
  const rows = await db.select().from(courses).where(eq(courses.classId, classId));
  return rows.some((c) => c.teacherId === teacherId);
}

export async function classRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const db = getDb();
    const rows = await db.select().from(classes).orderBy(classes.name).limit(300);
    return reply.send({ classes: await buildClassCards(db, rows, { studentId: req.user!.id }) });
  });

  // Daftar kelas "milik saya": admin → semua; guru → yang diajar/wali;
  // siswa → yang ia ikuti. Dipakai halaman "Kelas saya".
  app.get("/mine", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const db = getDb();
    const all = await db.select().from(classes).orderBy(classes.name).limit(300);
    const role = req.user!.role;
    if (role === "admin") {
      return reply.send({ classes: await buildClassCards(db, all) });
    }
    if (role === "guru") {
      const mine = await db.select().from(courses);
      const taughtIds = new Set(mine.filter((c) => c.teacherId === req.user!.id).map((c) => c.classId));
      const filtered = all.filter((k) => taughtIds.has(k.id) || k.homeroomTeacherId === req.user!.id);
      return reply.send({ classes: await buildClassCards(db, filtered) });
    }
    const memberships = await db.select().from(classMemberships).where(eq(classMemberships.studentId, req.user!.id));
    const joinedIds = new Set(memberships.map((m) => m.classId));
    const joined = all.filter((k) => joinedIds.has(k.id));
    return reply.send({ classes: await buildClassCards(db, joined, { studentId: req.user!.id }) });
  });

  // Intip info kelas dari kode gabung sebelum masuk (untuk konfirmasi siswa).
  app.get("/code/:code", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { code } = req.params as { code: string };
    const db = getDb();
    const rows = await db.select().from(classes).where(eq(classes.joinCode, normalizeJoinCode(code)));
    const klass = rows[0];
    if (!klass) return reply.code(404).send({ message: "Kode kelas tidak ditemukan. Periksa kembali kode dari guru Anda." });
    const [card] = await buildClassCards(db, [klass], { studentId: req.user!.id });
    const courseRows = await db.select().from(courses).where(eq(courses.classId, klass.id));
    return reply.send({
      class: { id: card!.id, name: card!.name, grade: card!.grade, major: card!.major, homeroomTeacherName: card!.homeroomTeacherName },
      isMember: card!.isMember ?? false,
      publishedCourseCount: courseRows.filter((c) => c.status === "published").length,
    });
  });

  // Siswa masuk kelas dengan kode → otomatis terdaftar ke kursus terbit di kelas itu.
  app.post("/join", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!requireRole(["siswa"])(req, reply)) return;
    const parsed = JoinClassSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Kode kelas tidak valid.", details: parsed.error.flatten().fieldErrors });
    }
    const db = getDb();
    const code = normalizeJoinCode(parsed.data.code);
    const rows = await db.select().from(classes).where(eq(classes.joinCode, code));
    const klass = rows[0];
    if (!klass) return reply.code(404).send({ message: "Kode kelas tidak ditemukan. Periksa kembali kode dari guru Anda." });

    const existing = await db.select().from(classMemberships).where(eq(classMemberships.classId, klass.id));
    if (existing.some((m) => m.studentId === req.user!.id)) {
      const [card] = await buildClassCards(db, [klass], { studentId: req.user!.id });
      return reply.send({ already: true as const, class: card });
    }

    const now = new Date();
    await db.insert(classMemberships).values({
      id: randomUUID(), classId: klass.id, studentId: req.user!.id, joinedAt: now,
    });

    // Daftarkan otomatis ke seluruh kursus terbit pada kelas ini.
    const published = (await db.select().from(courses).where(eq(courses.classId, klass.id))).filter(
      (c) => c.status === "published",
    );
    const enrolled = await db.select().from(courseEnrollments).where(eq(courseEnrollments.studentId, req.user!.id));
    const enrolledIds = new Set(enrolled.map((e) => e.courseId));
    let enrolledCount = 0;
    for (const course of published) {
      if (enrolledIds.has(course.id)) continue;
      await db.insert(courseEnrollments).values({
        id: randomUUID(), courseId: course.id, studentId: req.user!.id, enrolledAt: now,
      });
      enrolledCount++;
    }

    await db.insert(auditLogs).values({
      id: randomUUID(), actorId: req.user!.id, action: "class.join",
      entity: "class", entityId: klass.id, metadata: JSON.stringify({ code }), createdAt: now,
    });

    const [card] = await buildClassCards(db, [klass], { studentId: req.user!.id });
    return reply.send({ already: false as const, class: card, enrolledCourses: enrolledCount });
  });

  app.get("/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const db = getDb();
    const rows = await db.select().from(classes).where(eq(classes.id, id));
    const klass = rows[0];
    if (!klass) return reply.code(404).send({ message: "Kelas tidak ditemukan." });
    const [card] = await buildClassCards(db, [klass], { studentId: req.user!.id });
    const courseRows = await db.select().from(courses).where(eq(courses.classId, id));
    return reply.send({ class: card, courses: courseRows });
  });

  // Daftar anggota kelas (admin, atau guru pengajar/wali kelas tersebut).
  app.get("/:id/members", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const db = getDb();
    const rows = await db.select().from(classes).where(eq(classes.id, id));
    const klass = rows[0];
    if (!klass) return reply.code(404).send({ message: "Kelas tidak ditemukan." });
    if (req.user!.role === "guru") {
      const allowed = klass.homeroomTeacherId === req.user!.id || (await teacherOwnsClass(db, req.user!.id, id));
      if (!allowed) return reply.code(403).send({ message: "Anda tidak mengajar pada kelas ini." });
    } else if (!requireRole(["admin", "guru"])(req, reply)) {
      return;
    }
    const memberships = await db.select().from(classMemberships).where(eq(classMemberships.classId, id));
    const students = await db.select().from(users);
    const byId = new Map(students.map((u) => [u.id, u]));
    return reply.send({
      members: memberships.map((m) => ({
        id: m.studentId,
        name: byId.get(m.studentId)?.name ?? "—",
        email: byId.get(m.studentId)?.email ?? "—",
        joinedAt: m.joinedAt,
      })),
    });
  });

  // Buat ulang kode gabung (mis. kode tersebar ke pihak yang tidak diinginkan).
  app.post("/:id/regenerate-code", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!requireRole(["admin"])(req, reply)) return;
    const { id } = req.params as { id: string };
    const db = getDb();
    const rows = await db.select().from(classes).where(eq(classes.id, id));
    if (!rows[0]) return reply.code(404).send({ message: "Kelas tidak ditemukan." });
    const code = await uniqueJoinCode(db);
    await db.update(classes).set({ joinCode: code, updatedAt: new Date() }).where(eq(classes.id, id));
    await db.insert(auditLogs).values({
      id: randomUUID(), actorId: req.user!.id, action: "class.regenerate_code",
      entity: "class", entityId: id, createdAt: new Date(),
    });
    return reply.send({ joinCode: code });
  });

  app.post("/", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!requireRole(["admin", "guru"])(req, reply)) return;
    const parsed = CreateClassSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Data kelas tidak valid.", details: parsed.error.flatten().fieldErrors });
    }
    const db = getDb();
    const isGuru = req.user!.role === "guru";
    // Guru yang membuat kelas otomatis menjadi walinya; hanya admin yang
    // boleh menunjuk wali lain atau memasukkan siswa langsung.
    const homeroomTeacherId = isGuru ? req.user!.id : (parsed.data.homeroomTeacherId || null);
    const studentIds = isGuru ? [] : (parsed.data.studentIds ?? []);
    const homeroomCheck = await resolveHomeroom(db, homeroomTeacherId);
    if (!homeroomCheck.ok) return reply.code(400).send({ message: homeroomCheck.message });
    const studentsCheck = await resolveStudents(db, studentIds);
    if (!studentsCheck.ok) return reply.code(400).send({ message: studentsCheck.message });

    const now = new Date();
    const classId = randomUUID();
    const row = {
      id: classId,
      name: parsed.data.name.trim(),
      grade: parsed.data.grade,
      major: parsed.data.major?.trim() || "TKJ",
      academicYearId: parsed.data.academicYearId,
      homeroomTeacherId,
      joinCode: await uniqueJoinCode(db),
      createdAt: now,
      updatedAt: now,
    };
    try {
      await db.insert(classes).values(row);
    } catch {
      return reply.code(409).send({ message: "Kelas dengan nama ini sudah ada pada tahun ajaran tersebut." });
    }
    for (const sid of [...new Set(studentIds)]) {
      await db.insert(classMemberships).values({ id: randomUUID(), classId, studentId: sid, joinedAt: now });
    }
    await db.insert(auditLogs).values({
      id: randomUUID(), actorId: req.user!.id, action: "class.create",
      entity: "class", entityId: row.id,
      metadata: JSON.stringify({ homeroomTeacherId, students: [...new Set(studentIds)].length }),
      createdAt: now,
    });
    const [card] = await buildClassCards(db, [row]);
    return reply.code(201).send({ class: { ...row, memberCount: card!.memberCount, courseCount: 0 } });
  });

  app.patch("/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!requireRole(["admin"])(req, reply)) return;
    const { id } = req.params as { id: string };
    const parsed = CreateClassSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Perubahan kelas tidak valid.", details: parsed.error.flatten().fieldErrors });
    }
    const db = getDb();
    const rows = await db.select().from(classes).where(eq(classes.id, id));
    if (!rows[0]) return reply.code(404).send({ message: "Kelas tidak ditemukan." });
    if (parsed.data.homeroomTeacherId !== undefined) {
      const check = await resolveHomeroom(db, parsed.data.homeroomTeacherId || null);
      if (!check.ok) return reply.code(400).send({ message: check.message });
    }
    if (parsed.data.studentIds !== undefined) {
      const check = await resolveStudents(db, parsed.data.studentIds);
      if (!check.ok) return reply.code(400).send({ message: check.message });
    }
    const now = new Date();
    try {
      await db
        .update(classes)
        .set({
          ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
          ...(parsed.data.grade !== undefined ? { grade: parsed.data.grade } : {}),
          ...(parsed.data.major !== undefined ? { major: parsed.data.major.trim() } : {}),
          ...(parsed.data.academicYearId !== undefined ? { academicYearId: parsed.data.academicYearId } : {}),
          ...(parsed.data.homeroomTeacherId !== undefined
            ? { homeroomTeacherId: parsed.data.homeroomTeacherId || null }
            : {}),
          updatedAt: now,
        })
        .where(eq(classes.id, id));
    } catch {
      return reply.code(409).send({ message: "Kelas dengan nama ini sudah ada pada tahun ajaran tersebut." });
    }
    // Daftar siswa diganti utuh sesuai pilihan admin (semantik "set anggota").
    if (parsed.data.studentIds !== undefined) {
      const current = await db.select().from(classMemberships).where(eq(classMemberships.classId, id));
      for (const m of current) {
        await db.delete(classMemberships).where(eq(classMemberships.id, m.id));
      }
      for (const sid of [...new Set(parsed.data.studentIds)]) {
        await db.insert(classMemberships).values({ id: randomUUID(), classId: id, studentId: sid, joinedAt: now });
      }
    }
    await db.insert(auditLogs).values({
      id: randomUUID(), actorId: req.user!.id, action: "class.update",
      entity: "class", entityId: id, createdAt: now,
    });
    return reply.send({ ok: true });
  });

  app.delete("/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!requireRole(["admin"])(req, reply)) return;
    const { id } = req.params as { id: string };
    const db = getDb();
    const used = await db.select().from(courses).where(eq(courses.classId, id));
    if (used[0]) {
      return reply.code(409).send({ message: `Kelas masih dipakai ${used.length} kursus. Hapus kursus terlebih dahulu.` });
    }
    const rows = await db.select().from(classes).where(eq(classes.id, id));
    if (!rows[0]) return reply.code(404).send({ message: "Kelas tidak ditemukan." });
    await db.delete(classes).where(eq(classes.id, id));
    await db.insert(auditLogs).values({
      id: randomUUID(), actorId: req.user!.id, action: "class.delete",
      entity: "class", entityId: id, createdAt: new Date(),
    });
    return reply.send({ ok: true });
  });
}
