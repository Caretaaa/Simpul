import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { userSessions, users, type Role } from "../db/schema.js";
import { getDb } from "../db/connection.js";

export const SESSION_COOKIE = "simpul_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 hari

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function toPublicUser(u: typeof users.$inferSelect) {
  return { id: u.id, email: u.email, name: u.name, role: u.role as Role };
}

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string; email: string; name: string; role: Role };
  }
}

/** Memuat sesi dari cookie HttpOnly; menempelkan request.user bila valid. */
export async function authPlugin(app: FastifyInstance): Promise<void> {
  app.decorateRequest("user", undefined);
  app.addHook("preHandler", async (req: FastifyRequest) => {
    const token = req.cookies[SESSION_COOKIE];
    if (!token) return;
    const db = getDb();
    const rows = await db.select().from(userSessions).where(eq(userSessions.tokenHash, hashToken(token)));
    const session = rows[0];
    if (!session || session.expiresAt.getTime() < Date.now()) return;
    const found = await db.select().from(users).where(eq(users.id, session.userId));
    const u = found[0];
    if (!u || !u.isActive) return;
    req.user = { id: u.id, email: u.email, name: u.name, role: u.role as Role };
  });
}

export function requireAuth(req: FastifyRequest, reply: FastifyReply): boolean {
  if (!req.user) {
    void reply.code(401).send({ message: "Sesi berakhir atau belum masuk. Silakan masuk kembali." });
    return false;
  }
  return true;
}

export function requireRole(roles: Role[]) {
  return (req: FastifyRequest, reply: FastifyReply): boolean => {
    if (!requireAuth(req, reply)) return false;
    if (!roles.includes(req.user!.role)) {
      void reply.code(403).send({ message: "Akun Anda tidak memiliki izin untuk tindakan ini." });
      return false;
    }
    return true;
  };
}

/** Membuat sesi baru + mengatur cookie HttpOnly. */
export async function createSession(
  reply: FastifyReply,
  userId: string,
  opts: { secure: boolean },
): Promise<void> {
  const db = getDb();
  const token = randomBytes(32).toString("hex");
  await db.insert(userSessions).values({
    id: randomUUID(),
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    createdAt: new Date(),
  });
  void reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: opts.secure,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}
