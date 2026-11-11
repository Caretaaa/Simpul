import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import { loadEnv } from "./config.js";
import { authPlugin } from "./middleware/auth.js";
import { academicYearRoutes } from "./modules/academic-years/routes.js";
import { announcementRoutes } from "./modules/announcements/routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import { classRoutes } from "./modules/classes/routes.js";
import {
  courseRoutes,
  enrollmentRoutes,
  lessonRoutes,
  moduleRoutes,
  progressRoutes,
} from "./modules/courses/routes.js";
import { competencyRoutes } from "./modules/competencies/routes.js";
import { healthRoutes } from "./modules/health/routes.js";
import { subjectRoutes } from "./modules/subjects/routes.js";
import { passwordResetRoutes, userRoutes } from "./modules/users/routes.js";

export async function buildApp(env = loadEnv()): Promise<FastifyInstance> {
  const app = Fastify({ logger: env.NODE_ENV !== "test" });

  await app.register(cookie);
  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  // Hook autentikasi dipanggil langsung (bukan via register) agar menempel di
  // konteks root dan melindungi semua rute, termasuk rute terenkapsulasi.
  await authPlugin(app);
  await app.register(rateLimit, { max: 200, timeWindow: "1 minute" });

  await app.register(healthRoutes, { prefix: "/api" });
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(passwordResetRoutes, { prefix: "/api/auth/password-reset" });
  await app.register(userRoutes, { prefix: "/api/users" });
  await app.register(academicYearRoutes, { prefix: "/api/academic-years" });
  await app.register(classRoutes, { prefix: "/api/classes" });
  await app.register(subjectRoutes, { prefix: "/api/subjects" });
  await app.register(courseRoutes, { prefix: "/api/courses" });
  await moduleRoutes(app);
  await lessonRoutes(app);
  await enrollmentRoutes(app);
  await progressRoutes(app);
  await app.register(announcementRoutes, { prefix: "/api/announcements" });
  await app.register(competencyRoutes, { prefix: "/api/competencies" });

  app.setErrorHandler((err: FastifyError, _req, reply) => {
    const code = err.statusCode ?? 500;
    const status = Number.isInteger(code) && code < 500 ? code : 500;
    if (status === 500) app.log.error(err);
    // Jangan bocorkan stack trace ke klien.
    void reply.code(status).send({
      message: status === 500 ? "Terjadi kesalahan pada server." : err.message,
    });
  });

  return app;
}
