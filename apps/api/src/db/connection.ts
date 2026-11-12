import { DatabaseSync } from "node:sqlite";
import { drizzle, type SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema.js"; // selector: pg tables saat DATABASE_URL postgres
import { ensurePgReady } from "./pg-init.js";

export type Db = SqliteRemoteDatabase<typeof schema>;

let sqlite: DatabaseSync | null = null;
let db: Db | null = null;
/** Selesai saat inisialisasi database (DDL + seed demo) sudah berjalan. */
let initPromise: Promise<void> | null = null;

/** Await sebelum melayani request (no-op untuk SQLite). */
export function whenDbReady(): Promise<void> {
  if (!initPromise && /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "")) {
    // Memicu pembuatan koneksi + inisialisasi DDL/seed sekali per proses.
    getDb();
  }
  return initPromise ?? Promise.resolve();
}

function resolvePath(databaseUrl: string): string {
  if (databaseUrl.startsWith("file:")) {
    const p = databaseUrl.slice("file:".length);
    return p === "" ? ":memory:" : p;
  }
  return databaseUrl;
}

/**
 * Koneksi dual-dialek:
 * - `postgres://...` → PostgreSQL (produksi: Neon via Vercel serverless),
 *   driver postgres.js + drizzle postgre-js. DDL & seed demo dijamin siap
 *   lewat `whenDbReady()` (idempoten, sekali per proses).
 * - selain itu → SQLite file/:memory: via `node:sqlite` bawaan Node (dev/test).
 * Drizzle dipakai sebagai query-builder + skema terketik; seluruh SQL tetap
 * eksplisit dan portabel antar kedua dialek.
 */
export function getDb(databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db"): Db {
  if (db) return db;

  if (/^postgres(ql)?:\/\//.test(databaseUrl)) {
    // Neon HTTP driver: query lewat HTTPS fetch — bebas dari masalah TCP/TLS
    // pada runtime serverless (Vercel), koneksi per-request tanpa pool hang.
    const sql = neon(databaseUrl);
    // Adapter: drizzle-orm 0.36 memanggil client(query, params, opts) gaya lama;
    // driver neon 1.x menerima gaya itu lewat sql.query(). Drizzle mengirim
    // { arrayMode, fullResults: true } agar hasilnya { rows: [...] }.
    const pgClient = (q: string, params?: unknown[], opts?: unknown) =>
      sql.query(q, params as never[], opts as never);
    // `schema` pada jalur ini berisi tabel pg (selector schema.ts).
    // Cast: tipe generik drizzle-neon tidak cocok dengan overloads neon 1.x.
    db = (drizzleNeon as unknown as (client: unknown, config: unknown) => Db)(pgClient, { schema }) as Db;
    initPromise = ensurePgReady({ unsafe: (q: string) => sql.query(q) as Promise<unknown> })
      .catch((e) => {
        console.error("[pg-init] gagal inisialisasi Postgres:", e);
        throw e;
      });
    return db;
  }

  sqlite = new DatabaseSync(resolvePath(databaseUrl));
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
  initPromise = null;
}
