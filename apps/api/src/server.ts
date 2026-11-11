import { loadEnv } from "./config.js";
import { migrate } from "./db/migrate.js";
import { buildApp } from "./app.js";

async function main(): Promise<void> {
  const env = loadEnv();
  if (env.NODE_ENV !== "test") migrate();
  const app = await buildApp(env);
  await app.listen({ port: env.API_PORT, host: env.API_HOST });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
