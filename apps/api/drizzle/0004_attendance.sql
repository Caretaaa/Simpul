-- Phase 2 lanjutan: absensi kehadiran siswa.
-- Tabel dibuat lebih dulu; ALTER users diletakkan terakhir agar kegagalan
-- "duplicate column name" pada re-run tidak menghalangi pembuatan tabel.

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_by TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
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
  marked_at INTEGER NOT NULL,
  UNIQUE (session_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_att_records_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_att_records_student ON attendance_records(student_id);

-- Kode kartu absensi siswa: unik, diisi malas oleh aplikasi bila masih NULL.
ALTER TABLE users ADD COLUMN attendance_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_attendance_code ON users(attendance_code);
