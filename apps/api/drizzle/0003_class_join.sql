-- Phase 2 lanjutan: sistem gabung kelas via kode acak.
-- 1) Kode gabung unik per kelas (dapat NULL untuk baris lama; diisi malas oleh aplikasi).
ALTER TABLE classes ADD COLUMN join_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_classes_join_code ON classes(join_code);

-- 2) Keanggotaan siswa pada kelas.
CREATE TABLE IF NOT EXISTS class_memberships (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL,
  UNIQUE (class_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_student ON class_memberships(student_id);
CREATE INDEX IF NOT EXISTS idx_memberships_class ON class_memberships(class_id);
