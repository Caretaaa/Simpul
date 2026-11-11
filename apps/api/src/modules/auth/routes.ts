import { randomUUID } from "node:crypto";
import { LoginSchema } from "@simpul/shared";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { getDb } from "../../db/connection.js";
import { auditLogs, userSessions, users } from "../../db/schema.js";
import { SESSION_COOKIE, createSession, hashToken, requireAuth, toPublicUser } from "../../middleware/auth.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/login",
    // Batas brute-force: 20 percobaan per menit per IP.
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Surel atau kata sandi tidak valid.",
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const db = getDb();
    // Normalisasi surel agar login tidak sensitif huruf besar/kecil.
    const email = parsed.data.email.trim().toLowerCase();
    const rows = await db.select().from(users).where(eq(users.email, email));
    const user = rows[0];
    // Pesan generik untuk mencegah enumerasi akun.
    if (!user || !user.isActive) {
      return reply.code(401).send({ message: "Surel atau kata sandi salah." });
    }
    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) return reply.code(401).send({ message: "Surel atau kata sandi salah." });
    const secure = process.env.COOKIE_SECURE === "true";
    await createSession(reply, user.id, { secure });
    await db.insert(auditLogs).values({
      id: randomUUID(),
      actorId: user.id,
      action: "auth.login",
      entity: "user",
      entityId: user.id,
      createdAt: new Date(),
    });
    return reply.send({ user: toPublicUser(user) });
  });

  app.post("/logout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) {
      const db = getDb();
      await db.delete(userSessions).where(eq(userSessions.tokenHash, hashToken(token)));
    }
    void reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.send({ ok: true });
  });

  app.get("/me", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return reply.send({ user: req.user });
  });
}
