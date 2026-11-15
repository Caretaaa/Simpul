import { seedDemo } from "./seed.js";

/**
 * Inisialisasi database PostgreSQL (produksi: Vercel/Neon).
 * - DDL idempoten (CREATE ... IF NOT EXISTS) dijalankan saat cold start.
 * - Data demo di-seed hanya bila tabel users masih kosong, sehingga login
 *   akun demo langsung bekerja pada deploy baru.
 * DDL ditulis sebagai string agar tidak bergantung pada bundling file .sql.
 * Sumber padanan SQLite: apps/api/drizzle/*.sql (docs/06-database.md).
 *
 * DDL dipisah menjadi chunk berversi agar deploy lama hanya menjalankan chunk
 * baru saat cold start — batas 10 detik fungsi Vercel tidak terlampaui.
 */
export const PG_DDL_CORE = /* sql */ `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','guru','siswa')),
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);

CREATE TABLE IF NOT EXISTS academic_years (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  grade TEXT NOT NULL CHECK (grade IN ('X','XI','XII')),
  major TEXT NOT NULL DEFAULT 'TKJ',
  academic_year_id TEXT REFERENCES academic_years(id),
  homeroom_teacher_id TEXT REFERENCES users(id),
  join_code TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  subject_id TEXT REFERENCES subjects(id),
  class_id TEXT REFERENCES classes(id),
  teacher_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_courses_teacher ON courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_courses_class ON courses(class_id);
CREATE INDEX IF NOT EXISTS idx_courses_class_status ON courses(class_id, status);

CREATE TABLE IF NOT EXISTS course_enrollments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL,
  UNIQUE (course_id, student_id)
);

CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'article',
  body TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'started',
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (lesson_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_student ON lesson_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson ON lesson_progress(lesson_id);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'school',
  course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  metadata TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pwreset_user ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  kind TEXT NOT NULL DEFAULT 'info',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at);

CREATE TABLE IF NOT EXISTS competencies (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS course_competencies (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  competency_id TEXT NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (course_id, competency_id)
);

CREATE TABLE IF NOT EXISTS class_memberships (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL,
  UNIQUE (class_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_student ON class_memberships(student_id);
CREATE INDEX IF NOT EXISTS idx_memberships_class ON class_memberships(class_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_classes_year_name ON classes(academic_year_id, name);
`;

/** DDL versi 0002 — tabel absensi kehadiran (lihat docs/14-absensi.md). */
export const PG_DDL_ATTENDANCE = /* sql */ `
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_att_sessions_class_date ON attendance_sessions(class_id, date);
CREATE INDEX IF NOT EXISTS idx_att_sessions_creator ON attendance_sessions(created_by);

CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('hadir','terlambat','izin','sakit','alpa')),
  method TEXT NOT NULL DEFAULT 'manual' CHECK (method IN ('scan','manual')),
  note TEXT,
  marked_by TEXT REFERENCES users(id),
  marked_at TIMESTAMPTZ NOT NULL,
  UNIQUE (session_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_att_records_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_att_records_student ON attendance_records(student_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS attendance_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_attendance_code ON users(attendance_code);
`;

/** Gabungan seluruh chunk — acuan dokumentasi dan pemeriksaan jumlah statement. */
export const PG_DDL = `${PG_DDL_CORE}\n${PG_DDL_ATTENDANCE}`;

type PgClient = {
  unsafe: (query: string, params?: unknown[]) => Promise<unknown>;
};

interface DdlChunk {
  /** Versi yang dicatat di `_pg_ddl_applied`. */
  name: string;
  ddl: string;
  /** Tabel penanda: ada berarti seluruh statement chunk benar-benar berjalan. */
  sentinel: string;
}

const DDL_CHUNKS: DdlChunk[] = [
  // Sentinel = tabel yang dibuat paling akhir pada chunk, bukan yang pertama,
  // agar batch yang hanya menjalankan statement pertama tetap terdeteksi.
  { name: "0001", ddl: PG_DDL_CORE, sentinel: "class_memberships" },
  { name: "0002", ddl: PG_DDL_ATTENDANCE, sentinel: "attendance_records" },
];

function splitStatements(ddl: string): string[] {
  return ddl
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function chunkApplied(client: PgClient, chunk: DdlChunk): Promise<boolean> {
  const rows = (await client.unsafe(
    `SELECT to_regclass('public.${chunk.sentinel}') AS name`,
  )) as Array<{ name?: string | null }>;
  return Boolean(Array.isArray(rows) && rows[0]?.name);
}

/**
 * Terapkan satu chunk DDL. Driver Neon HTTP mengirim query sebagai simple query
 * sehingga banyak statement dieksekusi dalam satu round-trip (implicit
 * transaction) — ini yang membuat cold start jauh di bawah batas 10 detik
 * Vercel. Bila proxy menolak atau hanya menjalankan statement pertama, chunk
 * diulang per statement; seluruh DDL idempoten sehingga aman diulang.
 */
async function applyDdlChunk(client: PgClient, chunk: DdlChunk): Promise<void> {
  try {
    await client.unsafe(chunk.ddl);
    if (await chunkApplied(client, chunk)) return;
    console.warn(`[pg-init] batch DDL ${chunk.name} tidak lengkap; mengulang per statement.`);
  } catch (error) {
    console.warn(
      `[pg-init] batch DDL ${chunk.name} ditolak; mengulang per statement:`,
      (error as Error).message,
    );
  }
  for (const statement of splitStatements(chunk.ddl)) {
    await client.unsafe(statement);
  }
}

/**
 * Terapkan DDL lalu seed demo bila database masih kosong.
 * client: pembungkus `neon()` (HTTP) yang mengeksekusi satu query per call.
 * Marker `_pg_ddl_applied` membuat cold start berikutnya hanya beberapa query;
 * hanya chunk yang belum tercatat yang dijalankan (deploy lama cukup chunk 0002).
 */
export async function ensurePgReady(client: PgClient): Promise<void> {
  await client.unsafe("CREATE TABLE IF NOT EXISTS _pg_ddl_applied (name TEXT PRIMARY KEY)");
  const applied = (await client.unsafe(
    "SELECT name FROM _pg_ddl_applied WHERE name IN ('0001','0002')",
  )) as Array<{ name?: string }>;
  const done = new Set(Array.isArray(applied) ? applied.map((row) => row.name) : []);
  for (const chunk of DDL_CHUNKS) {
    if (done.has(chunk.name)) continue;
    await applyDdlChunk(client, chunk);
    await client.unsafe(
      `INSERT INTO _pg_ddl_applied (name) VALUES ('${chunk.name}') ON CONFLICT DO NOTHING`,
    );
  }
  const rows = (await client.unsafe("SELECT COUNT(*)::int AS count FROM users")) as Array<{ count: number }>;
  const userCount = Number(rows[0]?.count ?? 0);
  if (userCount === 0) {
    await seedDemo();
    console.log("[pg-init] Data demo di-seed ke Postgres.");
  }
}
