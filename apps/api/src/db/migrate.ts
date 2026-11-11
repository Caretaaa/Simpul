import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const here = dirname(fileURLToPath(import.meta.url));

function resolvePath(databaseUrl: string): string {
  if (databaseUrl.startsWith("file:")) {
    const p = databaseUrl.slice("file:".length);
    return p === "" ? ":memory:" : p;
  }
  return databaseUrl;
}

/**
 * Menjalankan migrasi SQL yang belum diterapkan (berurutan per nama file).
 * Idempoten melalui tabel pelacakan `schema_migrations`. Berkas lama
 * (0001–0002) memakai IF NOT EXISTS sehingga aman dijalankan ulang.
 * SQLite tidak mendukung ADD COLUMN ... IF NOT EXISTS, sehingga kegagalan
 * "duplicate column name" diperlakukan sebagai "sudah diterapkan" — ini
 * menutupi DB yang dimigrasi sebelum tabel pelacakan ada.
 * Catatan: produksi Postgres memakai drizzle-kit dengan dialek terpisah.
 */
export function migrate(databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db"): void {
  const sqlite = new DatabaseSync(resolvePath(databaseUrl));
  sqlite.exec("PRAGMA foreign_keys = OFF;");
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);",
  );
  const applied = new Set(
    (sqlite.prepare("SELECT name FROM schema_migrations").all() as Array<{ name: string }>).map((r) => r.name),
  );
  const dir = join(here, "..", "..", "drizzle");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const mark = sqlite.prepare("INSERT OR IGNORE INTO schema_migrations (name, applied_at) VALUES (?, ?)");
  for (const f of files) {
    if (applied.has(f)) continue;
    try {
      sqlite.exec(readFileSync(join(dir, f), "utf8"));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (!/duplicate column name/i.test(message)) throw e;
      // Kolom sudah ada (DB dimigrasi sebelum pelacakan) → lanjutkan.
    }
    mark.run(f, Date.now());
  }
  sqlite.close();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate();
  console.log("Migrasi diterapkan.");
}
