import { DatabaseSync } from "node:sqlite";
import { drizzle, type SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema.js";

export type Db = SqliteRemoteDatabase<typeof schema>;


let sqlite: DatabaseSync | null = null;
let db: Db | null = null;

function resolvePath(databaseUrl: string): string {
  if (databaseUrl.startsWith("file:")) {
    const p = databaseUrl.slice("file:".length);
    return p === "" ? ":memory:" : p;
  }
  return databaseUrl;
}

/**
 * Koneksi lazy di atas `node:sqlite` bawaan Node (tanpa native binding).
 * Drizzle dipakai sebagai query-builder + skema terketik via sqlite-proxy;
 * seluruh SQL tetap eksplisit dan portabel ke PostgreSQL.
 */
export function getDb(databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db"): Db {
  if (db) return db;
  const path = resolvePath(databaseUrl);
  if (path.startsWith("postgres")) {
    throw new Error("DATABASE_URL Postgres didukung di produksi (Phase 5). Dev/test memakai SQLite file:/:memory:.");
  }
  sqlite = new DatabaseSync(path);
  sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const client = sqlite;
  /**
   * Kontrak sqlite-proxy: baris HARUS array posisional (Object.values
   * mengikuti urutan kolom SELECT). Untuk "get", kembalikan SATU baris
   * (bukan dibungkus array) agar mapGetResult bekerja benar.
   */
  const toValues = (row: Record<string, unknown>): unknown[] => Object.values(row);
  db = drizzle<typeof schema>(async (query, params, method) => {
    try {
    const stmt = client.prepare(query);
    if (method === "run") {
      stmt.run(...params);
      return { rows: [] };
    }
    if (method === "get") {
      const row = stmt.get(...params) as Record<string, unknown> | undefined;
      // Baris kosong → undefined agar pemanggil .get() menerima undefined.
      return { rows: (row ? toValues(row) : undefined) as unknown as [] };
    }
    const rows = stmt.all(...params) as Record<string, unknown>[];
      return { rows: rows.map(toValues) };
    } catch (e) {
      if (process.env.SIMPUL_DEBUG_SQL === "1") {
        console.error("[sql-fail]", method, query, JSON.stringify(params), (e as Error).message);
      }
      throw e;
    }
  }, { schema });
  // Validasi koneksi via query ringan.
  client.prepare("SELECT 1").get();
  return db;
}

/** Reset handle global — hanya untuk test. */
export function __resetDb(): void {
  if (sqlite) sqlite.close();
  sqlite = null;
  db = null;
}
