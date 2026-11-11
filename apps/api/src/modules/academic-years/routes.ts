import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDb } from "../../db/connection.js";
import { auditLogs, academicYears } from "../../db/schema.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const CreateYearSchema = z.object({
  name: z.string().min(4, "Nama tahun ajaran minimal 4 karakter").max(60),
  isActive: z.boolean().optional(),
});

export async function academicYearRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const db = getDb();
    const rows = await db.select().from(academicYears).orderBy(desc(academicYears.name));
    return reply.send({ academicYears: rows });
  });

  app.post("/", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!requireRole(["admin"])(req, reply)) return;
    const parsed = CreateYearSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Data tahun ajaran tidak valid.", details: parsed.error.flatten().fieldErrors });
    }
    const db = getDb();
    const now = new Date();
    if (parsed.data.isActive) {
      // Hanya satu tahun ajaran aktif.
      await db.update(academicYears).set({ isActive: false, updatedAt: now });
    }
    const row = { id: randomUUID(), name: parsed.data.name.trim(), isActive: parsed.data.isActive ?? false, createdAt: now, updatedAt: now };
    await db.insert(academicYears).values(row);
    return reply.code(201).send({ academicYear: row });
  });

  app.patch("/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!requireRole(["admin"])(req, reply)) return;
    const { id } = req.params as { id: string };
    const parsed = z.object({ isActive: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ message: "Status tidak valid." });
    const db = getDb();
    const now = new Date();
    if (parsed.data.isActive) {
      await db.update(academicYears).set({ isActive: false, updatedAt: now });
    }
    await db.update(academicYears).set({ isActive: parsed.data.isActive, updatedAt: now }).where(eq(academicYears.id, id));
    await db.insert(auditLogs).values({
      id: randomUUID(), actorId: req.user!.id, action: "academic_year.update",
      entity: "academic_year", entityId: id, createdAt: now,
    });
    return reply.send({ ok: true });
  });
}
