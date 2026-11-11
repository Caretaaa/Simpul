# 08 — Milestone

- [x] **Phase 1 — Fondasi** (selesai): arsitektur monorepo, IA + rute + guard
  peran, skema DB + migrasi + seed demo, autentikasi cookie HttpOnly + RBAC
  server-side, token desain dual-theme, app shell responsif (sidebar + bottom
  nav), fondasi PWA (manifest, ikon, service worker, indikator online/offline),
  tes unit domain subnetting + integrasi API.
- [x] **Phase 2 — Core LMS** (selesai): manajemen pengguna/kelas/mapel/tahun ajaran, kursus draft→terbit, modul & materi, enrollmen, progres materi, pengumuman, reset kata sandi bertoken.
  ajaran, kursus draft→terbit dengan aturan "minimal satu materi", modul &
  materi berurutan, enrollmen (admin/guru, idempoten), progres materi siswa,
  pengumuman sekolah/kursus dengan otorisasi pemilik, reset kata sandi
  bertoken sekali pakai.
- [ ] **Phase 3 — Vokasional**: Lab Workspace (tujuan, skenario, langkah,
  checklist verifikasi, kiriman bukti, rubrik), tugas + unggah berkas,
  kuis (bank soal, jendela waktu, batas percobaan, skor server-side),
  pelacakan kompetensi berbasis aktivitas nyata, alat latihan subnetting.
- [ ] **Phase 4 — PWA luring penuh**: materi tersimpan, IndexedDB, antrean
  sinkronisasi idempoten + resolusi konflik, indikator status per konten.
- [ ] **Phase 5 — Hardening**: E2E Playwright, audit a11y (WCAG 2.2 AA) &
  keamanan (CSRF, rate limit, upload), performa (code-split, paginasi),
  deployment + dokumentasi operasional.

Bukti eksekusi tiap fase: `docs/10-verifikasi.md`.
