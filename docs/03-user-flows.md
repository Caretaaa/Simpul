# 03 — Alur Pengguna per Peran

## Siswa
Login → `/student/dashboard` (lanjutkan belajar, tenggat, lab aktif) →
`/student/courses` → jalur modul → baca materi → tandai selesai →
kerjakan lab (unggah bukti) → kumpulkan tugas/kuis → lihat umpan balik →
`/student/progress` (peta kompetensi) → notifikasi.

## Guru
Login → `/teacher/dashboard` (aktivitas hari ini, antrean penilaian) →
buat kursus (`draft` → `published`) → susun modul/materi → buat lab +
rubrik → tetapkan tenggat → nilai kiriman + umpan balik individual →
pantau progres & kompetensi kelas.

## Admin
Login → `/admin/dashboard` (agregasi nyata: pengguna, kelas, aktivitas) →
kelola pengguna/kelas/tahun ajaran/mapel → petakan guru↔kelas↔mapel →
kelola enrollmen & pengumuman → audit log tindakan sensitif.

Semua transisi peran sensitif divalidasi di server (`requireRole`),
bukan hanya navigasi tersembunyi.
