import { randomUUID } from "node:crypto";
import { asc, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDb } from "../../db/connection.js";
import {
  auditLogs,
  classMemberships,
  classes,
  courseCompetencies,
  courseEnrollments,
  courses,
  lessonProgress,
  lessons,
  modules,
  subjects,
  users,
} from "../../db/schema.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const canManageCourse = requireRole(["admin", "guru"]);

const CourseInput = z.object({
  title: z.string().min(5, "Judul kursus minimal 5 karakter").max(200),
  description: z.string().max(5000).optional(),
  subjectId: z.string().min(1, "Mata pelajaran wajib dipilih."),
  classId: z.string().min(1, "Kelas wajib dipilih."),
});

const PublishInput = z.object({ status: z.enum(["draft", "published", "archived"]) });

/** Ringkasan kursus untuk daftar, plus progres siswa (jika siswa). */
function courseSummary(row: typeof courses.$inferSelect, extra?: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    subjectId: row.subjectId,
    classId: row.classId,
    teacherId: row.teacherId,
    status: row.status,
    thumbnailUrl: row.thumbnailUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(extra ?? {}),
  };
}

export async function courseRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const db = getDb();
    const all = await db.select().from(courses).orderBy(desc(courses.updatedAt)).limit(300);
    const subjectsById = new Map((await db.select().from(subjects)).map((s) => [s.id, s]));
    const classesById = new Map((await db.select().from(classes)).map((c) => [c.id, c]));
    const teachersById = new Map((await db.select().from(users)).map((u) => [u.id, u]));

    if (req.user!.role === "siswa") {
      const enrolled = await db.select().from(courseEnrollments).where(eq(courseEnrollments.studentId, req.user!.id));
      const mine = new Set(enrolled.map((e) => e.courseId));
      // Kelas yang diikuti siswa menentukan kursus terbit yang terlihat.
      const memberships = await db.select().from(classMemberships).where(eq(classMemberships.studentId, req.user!.id));
      const joinedClassIds = new Set(memberships.map((m) => m.classId));
      return reply.send({
        courses: all
          .filter(
            (c) =>
              mine.has(c.id) ||
              (c.status === "published" && (c.classId === null || joinedClassIds.has(c.classId))),
          )
          .map((c) =>
            courseSummary(c, {
              isEnrolled: mine.has(c.id),
              subjectName: c.subjectId ? (subjectsById.get(c.subjectId)?.name ?? null) : null,
              className: c.classId ? (classesById.get(c.classId)?.name ?? null) : null,
              teacherName: c.teacherId ? (teachersById.get(c.teacherId)?.name ?? null) : null,
            }),
          ),
      });
    }

    const filter = req.query as { teacherId?: string };
    const rows = filter.teacherId && req.user!.role === "admin" ? all.filter((c) => c.teacherId === filter.teacherId) : all;
    return reply.send({
      courses: rows.map((c) =>
        courseSummary(c, {
          subjectName: c.subjectId ? (subjectsById.get(c.subjectId)?.name ?? null) : null,
          className: c.classId ? (classesById.get(c.classId)?.name ?? null) : null,
          teacherName: c.teacherId ? (teachersById.get(c.teacherId)?.name ?? null) : null,
        }),
      ),
    });
  });

  app.get("/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const db = getDb();
    const rows = await db.select().from(courses).where(eq(courses.id, id));
    const course = rows[0];
    if (!course) return reply.code(404).send({ message: "Kursus tidak ditemukan." });

    if (req.user!.role === "siswa") {
      if (course.status !== "published") {
        return reply.code(403).send({ message: "Kursus ini belum terbit." });
      }
      // Siswa hanya boleh membuka kursus yang ia ikuti atau kelasnya ia gabungi.
      const enrolled = await db.select().from(courseEnrollments).where(eq(courseEnrollments.courseId, id));
      const isEnrolled = enrolled.some((e) => e.studentId === req.user!.id);
      let isMember = false;
      if (!isEnrolled && course.classId) {
        const memberships = await db.select().from(classMemberships).where(eq(classMemberships.studentId, req.user!.id));
        isMember = memberships.some((m) => m.classId === course.classId);
      } else if (!isEnrolled && !course.classId) {
        isMember = true; // kursus tanpa kelas tetap terbuka bila terbit
      }
      if (!isEnrolled && !isMember) {
        return reply.code(403).send({ message: "Anda belum terdaftar pada kursus ini. Gabung kelas terlebih dahulu." });
      }
    }

    const moduleRows = await db.select().from(modules).where(eq(modules.courseId, id)).orderBy(asc(modules.position));
    const lessonRows = await db.select().from(lessons);
    const lessonsByModule = new Map<string, typeof lessonRows>();
    for (const l of lessonRows) {
      const arr = lessonsByModule.get(l.moduleId) ?? [];
      arr.push(l);
      lessonsByModule.set(l.moduleId, arr);
    }
    const competencyRows = await db.select().from(courseCompetencies).where(eq(courseCompetencies.courseId, id));

    let progress: { completed: string[] } | undefined;
    if (req.user!.role === "siswa") {
      const enrolled = await db
        .select()
        .from(courseEnrollments)
        .where(eq(courseEnrollments.courseId, id));
      const isMine = enrolled.some((e) => e.studentId === req.user!.id);
      const progressRows = await db.select().from(lessonProgress);
      progress = { completed: progressRows.filter((p) => p.studentId === req.user!.id && p.status === "completed").map((p) => p.lessonId) };
      void isMine;
    }

    return reply.send({
      course,
      modules: moduleRows.map((m) => ({
        ...m,
        lessons: (lessonsByModule.get(m.id) ?? []).sort((a, b) => a.position - b.position),
      })),
      competencyIds: competencyRows.map((c) => c.competencyId),
      progress,
    });
  });

  app.post("/", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!canManageCourse(req, reply)) return;
    const parsed = CourseInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Data kursus tidak valid.", details: parsed.error.flatten().fieldErrors });
    }
    const db = getDb();
    const subject = await db.select().from(subjects).where(eq(subjects.id, parsed.data.subjectId));
    if (!subject[0]) return reply.code(400).send({ message: "Mata pelajaran tidak ditemukan." });
    const klass = await db.select().from(classes).where(eq(classes.id, parsed.data.classId));
    if (!klass[0]) return reply.code(400).send({ message: "Kelas tidak ditemukan." });

    const now = new Date();
    const row = {
      id: randomUUID(),
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      subjectId: parsed.data.subjectId,
      classId: parsed.data.classId,
      // Guru hanya bisa membuat kursus untuk dirinya; admin dapat menetapkan via PATCH.
      teacherId: req.user!.role === "guru" ? req.user!.id : null,
      status: "draft" as const,
      thumbnailUrl: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(courses).values(row);
    await db.insert(auditLogs).values({
      id: randomUUID(), actorId: req.user!.id, action: "course.create",
      entity: "course", entityId: row.id, createdAt: now,
    });
    return reply.code(201).send({ course: row });
  });

  app.patch("/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const db = getDb();
    const rows = await db.select().from(courses).where(eq(courses.id, id));
    const course = rows[0];
    if (!course) return reply.code(404).send({ message: "Kursus tidak ditemukan." });
    // Guru hanya boleh mengubah kursusnya sendiri; admin bebas.
    if (req.user!.role === "guru" && course.teacherId !== req.user!.id) {
      return reply.code(403).send({ message: "Anda hanya dapat mengubah kursus Anda sendiri." });
    }
    const parsed = CourseInput.partial().extend({ teacherId: z.string().min(1).optional() }).safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Perubahan kursus tidak valid.", details: parsed.error.flatten().fieldErrors });
    }
    const now = new Date();
    await db
      .update(courses)
      .set({
        ...(parsed.data.title !== undefined ? { title: parsed.data.title.trim() } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description.trim() || null } : {}),
        ...(parsed.data.subjectId !== undefined ? { subjectId: parsed.data.subjectId } : {}),
        ...(parsed.data.classId !== undefined ? { classId: parsed.data.classId } : {}),
        // Penetapan guru hanya boleh admin.
        ...(parsed.data.teacherId !== undefined && req.user!.role === "admin" ? { teacherId: parsed.data.teacherId } : {}),
        updatedAt: now,
      })
      .where(eq(courses.id, id));
    return reply.send({ ok: true });
  });

  app.post("/:id/status", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!canManageCourse(req, reply)) return;
    const { id } = req.params as { id: string };
    const parsed = PublishInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ message: "Status tidak dikenal." });
    const db = getDb();
    const rows = await db.select().from(courses).where(eq(courses.id, id));
    const course = rows[0];
    if (!course) return reply.code(404).send({ message: "Kursus tidak ditemukan." });
    if (req.user!.role === "guru" && course.teacherId !== req.user!.id) {
      return reply.code(403).send({ message: "Anda hanya dapat mengubah kursus Anda sendiri." });
    }
    // Kursus tidak dapat terbit tanpa minimal satu modul berisi satu materi.
    if (parsed.data.status === "published") {
      const moduleRows = await db.select().from(modules).where(eq(modules.courseId, id));
      const lessonRows = await db.select().from(lessons);
      const publishedLessons = lessonRows.filter((l) => moduleRows.some((m) => m.id === l.moduleId) && l.isPublished);
      if (publishedLessons.length === 0) {
        return reply.code(409).send({ message: "Kursus harus memiliki minimal satu materi terbit sebelum dipublikasikan." });
      }
    }
    const now = new Date();
    await db.update(courses).set({ status: parsed.data.status, updatedAt: now }).where(eq(courses.id, id));
    await db.insert(auditLogs).values({
      id: randomUUID(), actorId: req.user!.id, action: `course.${parsed.data.status}`,
      entity: "course", entityId: id, createdAt: now,
    });
    return reply.send({ ok: true });
  });

  app.delete("/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const db = getDb();
    const rows = await db.select().from(courses).where(eq(courses.id, id));
    const course = rows[0];
    if (!course) return reply.code(404).send({ message: "Kursus tidak ditemukan." });
    if (req.user!.role === "guru" && course.teacherId !== req.user!.id) {
      return reply.code(403).send({ message: "Anda hanya dapat menghapus kursus Anda sendiri." });
    }
    await db.delete(courses).where(eq(courses.id, id));
    await db.insert(auditLogs).values({
      id: randomUUID(), actorId: req.user!.id, action: "course.delete",
      entity: "course", entityId: id, createdAt: new Date(),
    });
    return reply.send({ ok: true });
  });
}

/** Modul dalam kursus. */
export function moduleRoutes(app: FastifyInstance): void {
  app.post("/api/courses/:courseId/modules", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!canManageCourse(req, reply)) return;
    const { courseId } = req.params as { courseId: string };
    const parsed = z
      .object({ title: z.string().min(3, "Judul modul minimal 3 karakter").max(200) })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ message: "Judul modul tidak valid.", details: parsed.error.flatten().fieldErrors });
    const db = getDb();
    const courseRows = await db.select().from(courses).where(eq(courses.id, courseId));
    const course = courseRows[0];
    if (!course) return reply.code(404).send({ message: "Kursus tidak ditemukan." });
    if (req.user!.role === "guru" && course.teacherId !== req.user!.id) {
      return reply.code(403).send({ message: "Anda hanya dapat mengubah kursus Anda sendiri." });
    }
    const existing = await db.select().from(modules).where(eq(modules.courseId, courseId));
    const now = new Date();
    // Posisi baru = akhir daftar (maks + 1).
    const position = existing.reduce((max, m) => Math.max(max, m.position), -1) + 1;
    const row = { id: randomUUID(), courseId, title: parsed.data.title.trim(), position, createdAt: now, updatedAt: now };
    await db.insert(modules).values(row);
    return reply.code(201).send({ module: row });
  });

  app.patch("/api/modules/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!canManageCourse(req, reply)) return;
    const { id } = req.params as { id: string };
    const parsed = z.object({ title: z.string().min(3).max(200), position: z.number().int().min(0).optional() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ message: "Perubahan modul tidak valid." });
    const db = getDb();
    const rows = await db.select().from(modules).where(eq(modules.id, id));
    const module = rows[0];
    if (!module) return reply.code(404).send({ message: "Modul tidak ditemukan." });
    const now = new Date();
    await db
      .update(modules)
      .set({
        ...(parsed.data.title !== undefined ? { title: parsed.data.title.trim() } : {}),
        ...(parsed.data.position !== undefined ? { position: parsed.data.position } : {}),
        updatedAt: now,
      })
      .where(eq(modules.id, id));
    return reply.send({ ok: true });
  });

  app.delete("/api/modules/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!canManageCourse(req, reply)) return;
    const { id } = req.params as { id: string };
    const db = getDb();
    await db.delete(modules).where(eq(modules.id, id));
    return reply.send({ ok: true });
  });
}

const LessonInput = z.object({
  moduleId: z.string().min(1),
  title: z.string().min(3, "Judul materi minimal 3 karakter").max(200),
  contentType: z.enum(["article", "video", "pdf", "lab", "external"]).default("article"),
  body: z.string().max(200_000).optional(),
});

/** Materi (lesson) dalam modul — konten terstruktur. */
export function lessonRoutes(app: FastifyInstance): void {
  app.get("/api/lessons/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const db = getDb();
    const rows = await db.select().from(lessons).where(eq(lessons.id, id));
    const lesson = rows[0];
    if (!lesson) return reply.code(404).send({ message: "Materi tidak ditemukan." });
    if (req.user!.role === "siswa" && !lesson.isPublished) {
      return reply.code(403).send({ message: "Materi belum terbit." });
    }
    const moduleRows = await db.select().from(modules).where(eq(modules.id, lesson.moduleId));
    const module = moduleRows[0];
    if (!module) return reply.code(404).send({ message: "Modul materi tidak ditemukan." });
    const courseRows = await db.select().from(courses).where(eq(courses.id, module.courseId));
    const course = courseRows[0];
    if (!course) return reply.code(404).send({ message: "Kursus materi tidak ditemukan." });
    if (req.user!.role === "siswa" && course.status !== "published") {
      return reply.code(403).send({ message: "Kursus belum terbit." });
    }
    // Sertakan urutan navigasi prev/next di kursus yang sama.
    const siblingModules = await db
      .select()
      .from(modules)
      .where(eq(modules.courseId, course.id))
      .orderBy(asc(modules.position));
    const allLessons = (await db.select().from(lessons)).filter((l) => siblingModules.some((m) => m.id === l.moduleId));
    const ordered = allLessons
      .sort((a, b) => {
        const ma = siblingModules.find((m) => m.id === a.moduleId)!;
        const mb = siblingModules.find((m) => m.id === b.moduleId)!;
        return ma.position - mb.position || a.position - b.position;
      })
      .filter((l) => req.user!.role !== "siswa" || l.isPublished);
    const index = ordered.findIndex((l) => l.id === lesson.id);
    return reply.send({
      lesson,
      course: { id: course.id, title: course.title, status: course.status },
      prevLessonId: index > 0 ? (ordered[index - 1]?.id ?? null) : null,
      nextLessonId: index >= 0 && index < ordered.length - 1 ? (ordered[index + 1]?.id ?? null) : null,
    });
  });

  app.post("/api/lessons", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!canManageCourse(req, reply)) return;
    const parsed = LessonInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Data materi tidak valid.", details: parsed.error.flatten().fieldErrors });
    }
    const db = getDb();
    const moduleRows = await db.select().from(modules).where(eq(modules.id, parsed.data.moduleId));
    const module = moduleRows[0];
    if (!module) return reply.code(404).send({ message: "Modul tidak ditemukan." });
    const courseRows = await db.select().from(courses).where(eq(courses.id, module.courseId));
    const course = courseRows[0]!;
    if (req.user!.role === "guru" && course.teacherId !== req.user!.id) {
      return reply.code(403).send({ message: "Anda hanya dapat mengubah kursus Anda sendiri." });
    }
    const siblings = await db.select().from(lessons).where(eq(lessons.moduleId, parsed.data.moduleId));
    const now = new Date();
    const row = {
      id: randomUUID(),
      moduleId: parsed.data.moduleId,
      title: parsed.data.title.trim(),
      contentType: parsed.data.contentType,
      body: parsed.data.body ?? null,
      position: siblings.reduce((max, l) => Math.max(max, l.position), -1) + 1,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(lessons).values(row);
    return reply.code(201).send({ lesson: row });
  });

  app.patch("/api/lessons/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!canManageCourse(req, reply)) return;
    const { id } = req.params as { id: string };
    const parsed = LessonInput.omit({ moduleId: true })
      .extend({ position: z.number().int().min(0).optional(), isPublished: z.boolean().optional() })
      .partial()
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ message: "Perubahan materi tidak valid.", details: parsed.error.flatten().fieldErrors });
    const db = getDb();
    const rows = await db.select().from(lessons).where(eq(lessons.id, id));
    const lesson = rows[0];
    if (!lesson) return reply.code(404).send({ message: "Materi tidak ditemukan." });
    const now = new Date();
    await db
      .update(lessons)
      .set({
        ...(parsed.data.title !== undefined ? { title: parsed.data.title.trim() } : {}),
        ...(parsed.data.contentType !== undefined ? { contentType: parsed.data.contentType } : {}),
        ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
        ...(parsed.data.position !== undefined ? { position: parsed.data.position } : {}),
        ...(parsed.data.isPublished !== undefined ? { isPublished: parsed.data.isPublished } : {}),
        updatedAt: now,
      })
      .where(eq(lessons.id, id));
    return reply.send({ ok: true });
  });

  app.delete("/api/lessons/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!canManageCourse(req, reply)) return;
    const { id } = req.params as { id: string };
    const db = getDb();
    await db.delete(lessons).where(eq(lessons.id, id));
    return reply.send({ ok: true });
  });
}

/** Enrollmen: admin/guru mendaftarkan siswa ke kursus. */
export function enrollmentRoutes(app: FastifyInstance): void {
  app.get("/api/courses/:courseId/students", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!canManageCourse(req, reply)) return;
    const { courseId } = req.params as { courseId: string };
    const db = getDb();
    const rows = await db.select().from(courseEnrollments).where(eq(courseEnrollments.courseId, courseId));
    const students = rows.length > 0 ? await db.select().from(users) : [];
    return reply.send({ students: students.map((u) => ({ id: u.id, name: u.name, email: u.email })) });
  });

  app.post("/api/courses/:courseId/enrollments", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!canManageCourse(req, reply)) return;
    const { courseId } = req.params as { courseId: string };
    const parsed = z.object({ studentIds: z.array(z.string().min(1)).min(1, "Pilih minimal satu siswa.").max(200) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ message: "Daftar siswa tidak valid.", details: parsed.error.flatten().fieldErrors });
    const db = getDb();
    const courseRows = await db.select().from(courses).where(eq(courses.id, courseId));
    if (!courseRows[0]) return reply.code(404).send({ message: "Kursus tidak ditemukan." });
    const existing = await db.select().from(courseEnrollments).where(eq(courseEnrollments.courseId, courseId));
    const mine = new Set(existing.map((e) => e.studentId));
    const now = new Date();
    let added = 0;
    for (const sid of parsed.data.studentIds) {
      if (mine.has(sid)) continue;
      await db.insert(courseEnrollments).values({ id: randomUUID(), courseId, studentId: sid, enrolledAt: now });
      added++;
    }
    return reply.send({ added });
  });

  app.delete("/api/courses/:courseId/enrollments/:studentId", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!canManageCourse(req, reply)) return;
    const { courseId, studentId } = req.params as { courseId: string; studentId: string };
    const db = getDb();
    const existing = await db.select().from(courseEnrollments).where(eq(courseEnrollments.courseId, courseId));
    const target = existing.find((e) => e.studentId === studentId);
    if (!target) return reply.code(404).send({ message: "Siswa belum terdaftar pada kursus ini." });
    await db.delete(courseEnrollments).where(eq(courseEnrollments.id, target.id));
    return reply.send({ ok: true });
  });
}

/** Progres belajar siswa: catat & baca penyelesaian materi. */
export function progressRoutes(app: FastifyInstance): void {
  app.post("/api/lessons/:id/progress", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!requireRole(["siswa"])(req, reply)) return;
    const { id } = req.params as { id: string };
    const parsed = z.object({ status: z.enum(["started", "completed"]) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ message: "Status progres tidak dikenal." });
    const db = getDb();
    const lessonRows = await db.select().from(lessons).where(eq(lessons.id, id));
    const lesson = lessonRows[0];
    if (!lesson) return reply.code(404).send({ message: "Materi tidak ditemukan." });
    if (!lesson.isPublished) return reply.code(403).send({ message: "Materi belum terbit." });
    const now = new Date();
    const existing = await db.select().from(lessonProgress).where(eq(lessonProgress.lessonId, id));
    const row = existing.find((p) => p.studentId === req.user!.id);
    if (row) {
      await db.update(lessonProgress).set({ status: parsed.data.status, updatedAt: now }).where(eq(lessonProgress.id, row.id));
    } else {
      await db.insert(lessonProgress).values({
        id: randomUUID(), lessonId: id, studentId: req.user!.id, status: parsed.data.status, updatedAt: now,
      });
    }
    return reply.send({ ok: true });
  });

  app.get("/api/me/progress", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const db = getDb();
    const rows = await db.select().from(lessonProgress).where(eq(lessonProgress.studentId, req.user!.id));
    return reply.send({
      progress: rows.map((r) => ({ lessonId: r.lessonId, status: r.status, updatedAt: r.updatedAt })),
    });
  });
}
