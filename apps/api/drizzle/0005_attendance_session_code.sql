-- Absensi dengan QR per sesi: satu kode unik per sesi (kelas + mapel + tanggal).
-- Kolom nullable agar baris lama tetap valid; aplikasi mengisi kode secara malas
-- dan kode tidak pernah berubah sehingga QR yang sudah dicetak tetap berlaku.
ALTER TABLE attendance_sessions ADD COLUMN code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_att_sessions_code ON attendance_sessions(code);
