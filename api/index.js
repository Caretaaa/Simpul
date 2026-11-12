/**
 * Vercel serverless entry — menjembatani Fastify API ke Node functions.
 * Runtime Node menyediakan req (IncomingMessage) & res (ServerResponse) asli,
 * sehingga app.routing(req, res) dari Fastify bisa dipakai langsung.
 * Build API (apps/api/dist) dihasilkan oleh buildCommand di vercel.json.
 *
 * Instance app & inisialisasi DB (DDL + seed demo, idempoten) dibuat sekali
 * per lambda instance (cold start) lalu dipakai ulang di warm invocations.
 */

let appPromise = null;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const [{ buildApp }, { loadEnv }, { whenDbReady }] = await Promise.all([
        import("../apps/api/dist/app.js"),
        import("../apps/api/dist/config.js"),
        import("../apps/api/dist/db/connection.js"),
      ]);
      await whenDbReady();
      return buildApp(loadEnv());
    })().catch((err) => {
      appPromise = null; // boleh dicoba lagi pada invocation berikutnya
      throw err;
    });
  }
  return appPromise;
}

export default async function handler(req, res) {
  try {
    const app = await getApp();
    await app.ready();
    // Rewrite "/api/(.*)" → "/api" menaikkan fungsi ini; pastikan path asli
    // tetap lengkap agar routing Fastify menemukan rutenya.
    if (!req.url.startsWith("/api")) {
      req.url = "/api" + (req.url === "/" ? "" : req.url);
    }
    await app.routing(req, res);
  } catch (err) {
    console.error("[api] handler error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
    }
    res.end(JSON.stringify({ message: "Terjadi kesalahan pada server." }));
  }
}
