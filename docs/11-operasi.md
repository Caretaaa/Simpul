# 11 — Operasi (dev → produksi)

## Lingkungan dev
```bash
npm install
cp .env.example .env
npm run seed -w @simpul/api
npm run dev:api      # :3001
npm run dev:web      # :5173, proxy /api → 3001
```
Catatan: `tsx` dipakai untuk dev (tanpa langkah build). API membuat `dev.db`
SQLite (WAL) di `apps/api/`.

## Migrasi & seed
- Migrasi: `apps/api/drizzle/0001_initial.sql`, `0002_core_lms.sql`
  dijalankan urut otomatis oleh `apps/api/src/db/migrate.ts` (dipakai oleh
  server dev, seed, dan test).
- Seed: `npm run seed -w @simpul/api` — data demo yang jelas ditandai.

## Build & jalankan produksi
```bash
npm run build
NODE_ENV=production SESSION_SECRET=<acak-32+> COOKIE_SECURE=true \
  DATABASE_URL=file:/var/lib/simpul/prod.db \
  npm run start -w @simpul/api
npm run preview -w @simpul/web      # sajikan dist/ di belakang proxy HTTPS
```
Wajib: `SESSION_SECRET` kuat (validasi gagal menolak start), `COOKIE_SECURE=true`
saat HTTPS, `CORS_ORIGIN` sesuai domain.

## PostgreSQL (target produksi)
Skema SQLite ditulis portabel; konversi mekanis:
`INTEGER(ms epoch)` → `TIMESTAMPTZ`, `INTEGER boolean` → `BOOLEAN`,
`TEXT` → `TEXT`, `AUTOINCREMENT`/PK teks tetap. Ganti driver di
`apps/api/src/db/connection.ts` (pola sama: satu modul lapisan persistensi) dan
jalankan drizzle-kit dengan dialek `postgresql`. Sisa aplikasi tidak berubah
karena hanya bergantung pada modul `db/*`.

## S3 (unggahan Phase 3)
Rencana: adapter bertingkat di `apps/api/src/modules/files/` — `LocalDisk`
(dev) & `S3Client` (prod) memilih lewat env `STORAGE_DRIVER`. Unduhan selalu
lewat endpoint terkendali izin, bukan URL publik.

## Observability
- Log API terstruktur (Fastify pino) dengan requestId.
- Audit log (`audit_logs`) untuk aksi sensitif: user.create/update,
  class/subject/course/announcement, password reset request, login.
- Metrik inti (usulan): latensi p95 per rute, rasio 5xx, kegagalan login.

## Cadangan
SQLite: cadangkan berkas + WAL saat tidak ada penulisan. PostgreSQL:
`pg_dump` terjadwal + verifikasi restor berkala.

## Buku masukan (runbook) ringkas
1. Gagal start: periksa `SESSION_SECRET` (min 16 char) & `DATABASE_URL`.
2. 401 di semua permintaan: cookie `HttpOnly` memerlukan HTTPS jika
   `COOKIE_SECURE=true`; samakan origin dengan `CORS_ORIGIN`.
3. 409 "Kelas ... sudah ada": nama kelas unik per tahun ajaran.
4. Kursus tak bisa terbit: tambahkan minimal satu materi.
