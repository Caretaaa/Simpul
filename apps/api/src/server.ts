import { loadEnv } from "./config.js";
import { migrate } from "./db/migrate.js";
import { whenDbReady } from "./db/connection.js";
import { buildApp } from "./app.js";

async function main(): Promise<void> {
  const env = loadEnv();
  // migrate() hanya untuk SQLite (dev/test); Postgres diinisialisasi via
  // ensurePgReady() di dalam whenDbReady() (DDL idempoten + seed demo).
  if (env.NODE_ENV !== "test" && !/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) migrate();
  await whenDbReady();
  const app = await buildApp(env);
  await app.listen({ port: env.API_PORT, host: env.API_HOST });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
