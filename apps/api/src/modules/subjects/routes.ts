import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDb } from "../../db/connection.js";
import { auditLogs, courses, subjects } from "../../db/schema.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const SubjectInput = z.object({
  code: z.string().min(2, "Kode minimal 2 karakter").max(24),
  name: z.string().min(3, "Nama minimal 3 karakter").max(160),
  description: z.string().max(2000).optional(),
});

export async function subjectRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const db = getDb();
    const rows = await db.select().from(subjects).orderBy(subjects.name).limit(300);
    return reply.send({ subjects: rows });
  });

  app.post("/", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!requireRole(["admin"])(req, reply)) return;
    const parsed = SubjectInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Data mata pelajaran tidak valid.", details: parsed.error.flatten().fieldErrors });
    }
    const db = getDb();
    const now = new Date();
    const row = {
      id: randomUUID(),
      code: parsed.data.code.trim().toUpperCase(),
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await db.insert(subjects).values(row);
    } catch {
      return reply.code(409).send({ message: "Kode mata pelajaran sudah dipakai." });
    }
    await db.insert(auditLogs).values({
      id: randomUUID(), actorId: req.user!.id, action: "subject.create",
      entity: "subject", entityId: row.id, createdAt: now,
    });
    return reply.code(201).send({ subject: row });
  });

  app.patch("/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!requireRole(["admin"])(req, reply)) return;
    const { id } = req.params as { id: string };
    const parsed = SubjectInput.partial().safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Perubahan tidak valid.", details: parsed.error.flatten().fieldErrors });
    }
    const db = getDb();
    const rows = await db.select().from(subjects).where(eq(subjects.id, id));
    if (!rows[0]) return reply.code(404).send({ message: "Mata pelajaran tidak ditemukan." });
    const now = new Date();
    try {
      await db
        .update(subjects)
        .set({
          ...(parsed.data.code !== undefined ? { code: parsed.data.code.trim().toUpperCase() } : {}),
          ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
          ...(parsed.data.description !== undefined ? { description: parsed.data.description.trim() || null } : {}),
          updatedAt: now,
        })
        .where(eq(subjects.id, id));
    } catch {
      return reply.code(409).send({ message: "Kode mata pelajaran sudah dipakai." });
    }
    return reply.send({ ok: true });
  });

  app.delete("/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!requireRole(["admin"])(req, reply)) return;
    const { id } = req.params as { id: string };
    const db = getDb();
    const used = await db.select().from(courses).where(eq(courses.subjectId, id));
    if (used[0]) {
      return reply.code(409).send({ message: `Mata pelajaran masih dipakai ${used.length} kursus.` });
    }
    const rows = await db.select().from(subjects).where(eq(subjects.id, id));
    if (!rows[0]) return reply.code(404).send({ message: "Mata pelajaran tidak ditemukan." });
    await db.delete(subjects).where(eq(subjects.id, id));
    return reply.send({ ok: true });
  });
}
