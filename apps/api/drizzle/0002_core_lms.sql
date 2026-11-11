-- Phase 2: kebutuhan core LMS (dribble ke atas 0001)
-- 1) users: pemulihan kata sandi via token + jejak login terakhir
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pwreset_user ON password_reset_tokens(user_id);

-- 2) Enrollmen & progres pelajaran sudah ada pada 0001; tambahkan indeks progres
CREATE INDEX IF NOT EXISTS idx_lesson_progress_student ON lesson_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson ON lesson_progress(lesson_id);

-- 3) Kelas harus unik per tahun ajaran + nama (satu kelas hanya sekali per TA)
CREATE UNIQUE INDEX IF NOT EXISTS uq_classes_year_name ON classes(academic_year_id, name);

-- 4) Kursus: indeks komposit untuk daftar per kelas (dipakai siswa)
CREATE INDEX IF NOT EXISTS idx_courses_class_status ON courses(class_id, status);

-- 5) Notifikasi (fase 2: pengumuman; antrean notifikasi khusus siswa di Phase 3)
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  kind TEXT NOT NULL DEFAULT 'info',
  read_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at);

-- 6) Kompetensi & pemetaan kompetensi kursus (kerangka; pelacakan terisi di Phase 3)
CREATE TABLE IF NOT EXISTS competencies (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS course_competencies (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  competency_id TEXT NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  UNIQUE (course_id, competency_id)
);
