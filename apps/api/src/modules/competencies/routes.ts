import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDb } from "../../db/connection.js";
import { competencies, courseCompetencies, courses } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const CompetencyInput = z.object({
  code: z.string().min(2, "Kode minimal 2 karakter").max(24),
  name: z.string().min(3, "Nama minimal 3 karakter").max(160),
  description: z.string().max(2000).optional(),
});

/**
 * Kompetensi vokasional TKJ (dikonfigurasi admin, bukan hardcode).
 * Nilai capaian siswa dihitung di Phase 3 dari aktivitas nyata.
 */
export async function competencyRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const db = getDb();
    const rows = await db.select().from(competencies);
    return reply.send({ competencies: rows });
  });

  app.post("/", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!requireRole(["admin"])(req, reply)) return;
    const parsed = CompetencyInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Data kompetensi tidak valid.", details: parsed.error.flatten().fieldErrors });
    }
    const db = getDb();
    const now = new Date();
    try {
      await db.insert(competencies).values({
        id: randomUUID(),
        code: parsed.data.code.trim().toUpperCase(),
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
        createdAt: now,
        updatedAt: now,
      });
    } catch {
      return reply.code(409).send({ message: "Kode kompetensi sudah dipakai." });
    }
    return reply.code(201).send({ ok: true });
  });

  app.delete("/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!requireRole(["admin"])(req, reply)) return;
    const { id } = req.params as { id: string };
    const db = getDb();
    await db.delete(competencies).where(eq(competencies.id, id));
    return reply.send({ ok: true });
  });

  app.get("/courses/:courseId", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { courseId } = req.params as { courseId: string };
    const db = getDb();
    const rows = await db.select().from(courseCompetencies);
    const ids = rows.filter((r) => r.courseId === courseId).map((r) => r.competencyId);
    return reply.send({ ids });
  });

  app.post("/courses/:courseId", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!requireRole(["admin", "guru"])(req, reply)) return;
    const { courseId } = req.params as { courseId: string };
    const parsed = z.object({ competencyIds: z.array(z.string().min(1)).max(50) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ message: "Daftar kompetensi tidak valid." });
    const db = getDb();
    const rows = await db.select().from(courses).where(eq(courses.id, courseId));
    if (!rows[0]) return reply.code(404).send({ message: "Kursus tidak ditemukan." });
    const now = new Date();
    for (const competencyId of parsed.data.competencyIds) {
      try {
        await db.insert(courseCompetencies).values({ id: randomUUID(), courseId, competencyId, createdAt: now });
      } catch {
        // duplikat: lewati
      }
    }
    return reply.send({ ok: true });
  });
}
