# 14 — Absensi Kehadiran (scan kartu & daftar manual)

Fitur absensi untuk akun **guru** (dan admin sebagai pengawas): membuka sesi
absensi per kelas/tanggal, memindai **kartu QR siswa** lewat kamera atau
pemindai barcode USB, dan/atau menandai daftar hadir secara manual. Siswa
melihat kartu absensinya sendiri beserta riwayat kehadiran.

## Alur

1. Guru membuka `/teacher/attendance`, memilih kelas, mata pelajaran (opsional),
   dan tanggal (default hari ini, zona Asia/Jakarta), lalu **Mulai absensi**.
   Sesi bersifat idempoten: membuka ulang kelas+tanggal+mapel yang sama
   mengembalikan sesi terbuka yang sudah ada.
2. Di `/teacher/attendance/:sessionId`, guru:
   - menyalakan kamera dan memindai QR kartu siswa (jsQR), atau mengetik/
     memindai kode dengan pemindai barcode USB (mode papan ketik) lalu Enter;
   - menandai manual `hadir / terlambat / izin / sakit / alpa`, menambah
     catatan singkat, atau menandai seluruh sisa siswa hadir;
   - melihat ringkasan hitung per status, menutup/membuka kembali sesi, dan
     menghapus sesi.
3. `/teacher/attendance/cards/:classId` mencetak kartu QR seluruh siswa kelas
   (satu kartu per siswa, siap dipotong).
4. Siswa membuka `/student/attendance` untuk menunjukkan QR kartu dan melihat
   riwayat kehadirannya.

Kode kartu: 10 karakter dari alfabet tanpa karakter ambigu
(`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`), unik di tabel `users`, diisi malas saat
pertama dibutuhkan. Isi QR: `SIMPUL:ATT:<KODE>`; pemindai boleh mengirim kode
telanjang, isi QR lengkap, atau tautan kartu — semuanya dinormalkan oleh
`parseAttendancePayload` di `@simpul/shared`.

## Data

```sql
attendance_sessions(id, class_id, course_id NULL, title, date 'YYYY-MM-DD',
                    status 'open'|'closed', created_by, created_at, updated_at)
attendance_records(id, session_id, student_id, status, method 'scan'|'manual',
                   note, marked_by, marked_at,
                   UNIQUE(session_id, student_id))
users.attendance_code TEXT UNIQUE
```

Migrasi SQLite: `apps/api/drizzle/0004_attendance.sql`.
Postgres: DDL idempoten di `apps/api/src/db/pg-init.ts` (marker `0002`).
Tanggal sesi disimpan sebagai teks tanggal sekolah, bukan timestamp, agar tidak
bergeser oleh zona waktu server.

## API (`/api/attendance`)

| Metode | Rute | Akses | Guna |
|---|---|---|---|
| GET | `/classes` | guru, admin | kelas yang diampu + sesi hari ini |
| GET | `/sessions?classId&limit` | guru, admin | daftar sesi terbaru |
| POST | `/sessions` | guru, admin | buka sesi (200 bila sudah ada) |
| GET | `/sessions/:id` | guru, admin | sesi + roster + ringkasan |
| POST | `/sessions/:id/scan` | guru, admin | tandai hadir dari kode kartu |
| POST | `/sessions/:id/records` | guru, admin | upsert status manual (`null` = hapus) |
| PATCH | `/sessions/:id` | guru, admin | tutup/buka sesi, ubah judul |
| DELETE | `/sessions/:id` | guru, admin | hapus sesi + catatannya |
| GET | `/classes/:classId/cards` | guru, admin | kode seluruh siswa untuk dicetak |
| GET | `/me` | siswa | kartu sendiri + riwayat (maks 60) |

Kontrol akses guru: wali kelas **atau** pengajar salah satu kursus pada kelas
itu. Admin bebas. Sesi tertutup menolak scan/perubahan status (409); kode asing
atau siswa non-anggota ditolak 404.

## Keputusan

- **Kode per siswa, bukan per sesi.** Kartu siswa dapat dicetak sekali dan
  dipakai di semua sesi; guru tidak perlu membagikan QR baru tiap pertemuan.
- **Kamera + input kode.** `jsQR` bekerja tanpa API peramban khusus; kolom kode
  menjamin pemindai barcode USB dan perangkat tanpa kamera tetap berfungsi.
  Kamera memerlukan HTTPS atau `localhost`.
- **Tanpa rekap lintas sesi pada iterasi ini.** Ringkasan hanya per sesi;
  rekap periode dapat dibangun di atas tabel yang sama nanti.
- **Tidak ada status "belum ditandai" di basis data.** Ketidakhadiran tanda
  dihitung sebagai `unmarked`; `alpa` hanya jika guru menyatakannya.

## Verifikasi

- `npm run test -w @simpul/api` — 20/20 lulus; 6 di antaranya tes absensi: kartu
  otomatis, idempotensi sesi, scan + duplikat + kode asing, manual/izin/hapus
  tanda, non-anggota 404, sesi tutup 409 lalu buka kembali, kartu & riwayat
  siswa, guru lain 403, siswa 403 pada rute guru.
- `npm run test -w @simpul/shared` — 15/15 lulus, termasuk normalisasi kode/QR
  dan generator kode kartu.
- `npm run typecheck -w @simpul/api`, `-w @simpul/web`, dan `npm run build`
  (shared → api → web) lulus.
- Browser nyata (Chromium headless): `npx tsx tooling/attendance-check.ts`
  → **18/18 pemeriksaan lulus**. Alur terverifikasi: hub kelas, buka sesi,
  tandai manual (tersimpan + badge "Manual"), pindai kode (status diperbarui),
  kode asing ditolak, tutup/buka sesi, kartu QR guru dirender, kartu + riwayat
  siswa, serta tidak ada overflow horizontal pada 390×844 dan tanpa galat API
  tak terduga. Screenshot: `/tmp/opencode/simpul-shots/attendance-*.png`.

Catatan pengujian kamera: jalur pindai diuji lewat kolom kode (jalur yang sama
dengan pemindai barcode USB). Dekode kamera memakai `jsQR` dan memerlukan
HTTPS/`localhost`; bukan cakupan otomatis headless.

