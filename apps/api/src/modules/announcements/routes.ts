import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDb } from "../../db/connection.js";
import { announcements, auditLogs, courses } from "../../db/schema.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const AnnouncementInput = z.object({
  title: z.string().min(4, "Judul minimal 4 karakter").max(200),
  body: z.string().min(1, "Isi pengumuman wajib diisi").max(5000),
  scope: z.enum(["school", "course"]).default("school"),
  courseId: z.string().min(1).optional(),
});

/** Pengumuman sekolah (admin) dan pengumuman kursus (guru pemilik). */
export async function announcementRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const db = getDb();
    if (req.user!.role === "guru") {
      const mine = await db.select().from(courses);
      const myCourses = new Set(mine.filter((c) => c.teacherId === req.user!.id).map((c) => c.id));
      const rows = (await db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(200))
        .filter((a) => a.scope === "school" || (a.courseId && myCourses.has(a.courseId)));
      return reply.send({ announcements: rows });
    }
    if (req.user!.role === "siswa") {
      const rows = (await db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(50)).filter(
        (a) => a.scope === "school",
      );
      return reply.send({ announcements: rows });
    }
    const rows = await db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(200);
    return reply.send({ announcements: rows });
  });

  app.post("/", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!requireRole(["admin", "guru"])(req, reply)) return;
    const parsed = AnnouncementInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Pengumuman tidak valid.", details: parsed.error.flatten().fieldErrors });
    }
    const db = getDb();
    let courseId: string | null = null;
    if (parsed.data.scope === "course") {
      if (!parsed.data.courseId) return reply.code(400).send({ message: "Pilih kursus untuk pengumuman kursus." });
      const rows = await db.select().from(courses).where(eq(courses.id, parsed.data.courseId));
      const course = rows[0];
      if (!course) return reply.code(400).send({ message: "Kursus tidak ditemukan." });
      if (req.user!.role === "guru" && course.teacherId !== req.user!.id) {
        return reply.code(403).send({ message: "Anda hanya dapat mengumumkan pada kursus Anda sendiri." });
      }
      courseId = course.id;
    }
    const now = new Date();
    const row = {
      id: randomUUID(),
      title: parsed.data.title.trim(),
      body: parsed.data.body,
      scope: parsed.data.scope,
      courseId,
      authorId: req.user!.id,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(announcements).values(row);
    return reply.code(201).send({ announcement: row });
  });

  app.delete("/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!requireRole(["admin", "guru"])(req, reply)) return;
    const { id } = req.params as { id: string };
    const db = getDb();
    const rows = await db.select().from(announcements).where(eq(announcements.id, id));
    const target = rows[0];
    if (!target) return reply.code(404).send({ message: "Pengumuman tidak ditemukan." });
    if (req.user!.role === "guru") {
      if (target.scope !== "course" || !target.courseId) {
        return reply.code(403).send({ message: "Guru hanya dapat menghapus pengumuman kursusnya sendiri." });
      }
      const courseRows = await db.select().from(courses).where(eq(courses.id, target.courseId));
      if (courseRows[0]?.teacherId !== req.user!.id) {
        return reply.code(403).send({ message: "Anda hanya dapat menghapus pengumuman kursus Anda sendiri." });
      }
    }
    await db.delete(announcements).where(eq(announcements.id, id));
    await db.insert(auditLogs).values({
      id: randomUUID(), actorId: req.user!.id, action: "announcement.delete",
      entity: "announcement", entityId: id, createdAt: new Date(),
    });
    return reply.send({ ok: true });
  });
}
