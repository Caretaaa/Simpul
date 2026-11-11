import { randomBytes, randomUUID } from "node:crypto";
import { desc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDb } from "../../db/connection.js";
import { auditLogs, passwordResetTokens, users } from "../../db/schema.js";
import {
  SESSION_COOKIE,
  hashPassword,
  hashToken,
  requireAuth,
  requireRole,
  toPublicUser,
} from "../../middleware/auth.js";

export const CreateUserSchema = z.object({
  email: z.string().email("Format surel tidak valid").max(160),
  name: z.string().min(3, "Nama minimal 3 karakter").max(120),
  password: z.string().min(8, "Kata sandi minimal 8 karakter").max(128),
  role: z.enum(["admin", "guru", "siswa"]),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(3, "Nama minimal 3 karakter").max(120).optional(),
  role: z.enum(["admin", "guru", "siswa"]).optional(),
  isActive: z.boolean().optional(),
});

export const ResolveResetSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8, "Kata sandi minimal 8 karakter").max(128),
});

export async function userRoutes(app: FastifyInstance): Promise<void> {
  const adminOnly = requireRole(["admin"]);

  app.get("/", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!adminOnly(req, reply)) return;
    const db = getDb();
    const rows = await db.select().from(users).orderBy(desc(users.createdAt)).limit(500);
    return reply.send({ users: rows.map(toPublicUser) });
  });

  // Daftar ringkas per peran untuk dropdown (cth. pilih wali/siswa saat buat kelas).
  // Hanya id, nama, surel — tanpa data sensitif. Khusus admin.
  app.get("/by-role", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!adminOnly(req, reply)) return;
    const { role } = req.query as { role?: string };
    if (role !== "guru" && role !== "siswa") {
      return reply.code(400).send({ message: "Parameter role harus guru atau siswa." });
    }
    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.role, role));
    return reply.send({
      users: rows
        .filter((u) => u.isActive)
        .map((u) => ({ id: u.id, name: u.name, email: u.email }))
        .sort((a, b) => a.name.localeCompare(b.name, "id")),
    });
  });

  app.get("/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!adminOnly(req, reply)) return;
    const { id } = req.params as { id: string };
    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.id, id));
    const u = rows[0];
    if (!u) return reply.code(404).send({ message: "Pengguna tidak ditemukan." });
    return reply.send({ user: toPublicUser(u) });
  });

  app.post("/", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!adminOnly(req, reply)) return;
    const parsed = CreateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Data pengguna tidak valid.", details: parsed.error.flatten().fieldErrors });
    }
    const db = getDb();
    const email = parsed.data.email.trim().toLowerCase();
    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing[0]) return reply.code(409).send({ message: "Surel sudah terdaftar." });
    const now = new Date();
    const row = {
      id: randomUUID(),
      email,
      name: parsed.data.name.trim(),
      passwordHash: await hashPassword(parsed.data.password),
      role: parsed.data.role,
      avatarUrl: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(users).values(row);
    await db.insert(auditLogs).values({
      id: randomUUID(), actorId: req.user!.id, action: "user.create",
      entity: "user", entityId: row.id, metadata: JSON.stringify({ role: row.role }), createdAt: now,
    });
    return reply.code(201).send({ user: toPublicUser(row) });
  });

  app.patch("/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!adminOnly(req, reply)) return;
    const { id } = req.params as { id: string };
    const parsed = UpdateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Perubahan tidak valid.", details: parsed.error.flatten().fieldErrors });
    }
    if (Object.keys(parsed.data).length === 0) {
      return reply.code(400).send({ message: "Tidak ada perubahan yang dikirim." });
    }
    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.id, id));
    const target = rows[0];
    if (!target) return reply.code(404).send({ message: "Pengguna tidak ditemukan." });
    // Admin terakhir yang aktif tidak boleh dinonaktifkan (menghindari lockout).
    if (parsed.data.isActive === false && target.role === "admin" && target.isActive) {
      const admins = await db.select().from(users).where(eq(users.role, "admin"));
      const activeAdmins = admins.filter((a) => a.isActive);
      if (activeAdmins.length <= 1) {
        return reply.code(409).send({ message: "Setidaknya satu administrator aktif harus tersisa." });
      }
    }
    const now = new Date();
    await db
      .update(users)
      .set({
        ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        updatedAt: now,
      })
      .where(eq(users.id, id));
    await db.insert(auditLogs).values({
      id: randomUUID(), actorId: req.user!.id, action: "user.update", entity: "user",
      entityId: id, metadata: JSON.stringify(parsed.data), createdAt: now,
    });
    const updated = await db.select().from(users).where(eq(users.id, id));
    return reply.send({ user: toPublicUser(updated[0]!) });
  });
}

/** Alur reset kata sandi berbasis token sekali-pakai (tanpa transport surel di dev). */
export async function passwordResetRoutes(app: FastifyInstance): Promise<void> {
  app.post("/request", async (req, reply) => {
    const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ message: "Surel tidak valid." });
    const db = getDb();
    const email = parsed.data.email.trim().toLowerCase();
    const rows = await db.select().from(users).where(eq(users.email, email));
    // Respons sengaja netral untuk mencegah enumerasi akun.
    const generic = { message: "Jika akun terdaftar, tautan pemulihan telah dibuat. Hubungi admin bila tidak menerimanya." };
    const user = rows[0];
    if (!user || !user.isActive) return reply.send(generic);

    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    await db.insert(passwordResetTokens).values({
      id: randomUUID(), userId: user.id, tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + 1000 * 60 * 30), usedAt: null, createdAt: now,
    });
    await db.insert(auditLogs).values({
      id: randomUUID(), actorId: user.id, action: "auth.password_reset_request",
      entity: "user", entityId: user.id, createdAt: now,
    });
    // DEV-ONLY: tanpa SMTP, token dikembalikan agar alur dapat diuji.
    const expose = process.env.NODE_ENV !== "production";
    return reply.send(expose ? { ...generic, devToken: token } : generic);
  });

  app.post("/resolve", async (req, reply) => {
    const parsed = ResolveResetSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Token atau kata sandi tidak valid.", details: parsed.error.flatten().fieldErrors });
    }
    const db = getDb();
    const rows = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, hashToken(parsed.data.token)));
    const entry = rows[0];
    if (!entry || entry.usedAt || entry.expiresAt.getTime() < Date.now()) {
      return reply.code(400).send({ message: "Tautan pemulihan tidak berlaku atau sudah dipakai." });
    }
    const now = new Date();
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(parsed.data.password), updatedAt: now })
      .where(eq(users.id, entry.userId));
    await db
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(inArray(passwordResetTokens.id, [entry.id]));
    void reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.send({ message: "Kata sandi berhasil diperbarui. Silakan masuk kembali." });
  });
}
