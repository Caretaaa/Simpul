# 14 — Absensi Kehadiran (QR per sesi & daftar manual)

Fitur absensi untuk akun **guru** (dan admin sebagai pengawas): membuka sesi
absensi per kelas/mapel/tanggal, menampilkan **QR sesi**, lalu **siswa memindai
QR itu dengan ponselnya sendiri** dan menandai kehadiran. Guru tetap dapat
menandai daftar hadir secara manual untuk siswa tanpa ponsel atau yang izin.

Setiap sesi punya kode QR sendiri (kelas + mata pelajaran + tanggal), sehingga
absensi dua mata pelajaran pada hari yang sama tidak saling bertabrakan.
Guru tidak lagi memindai kartu siswa.

## Alur

1. Guru membuka `/teacher/attendance`, memilih kelas, mata pelajaran (opsional),
   dan tanggal (default hari ini, zona Asia/Jakarta), lalu **Mulai absensi**.
   Sesi bersifat idempoten: membuka ulang kelas+tanggal+mapel yang sama
   mengembalikan sesi terbuka yang sudah ada beserta kode yang sama.
2. Di `/teacher/attendance/:sessionId` guru melihat **QR sesi** (kode 8 karakter
   + tombol salin tautan). QR berisi URL absolut `${origin}/absen/<KODE>` supaya
   kamera bawaan ponsel siswa langsung membuka halaman check-in.
3. Siswa memindai QR → membuka `/absen/<KODE>` → masuk dengan akun siswa →
   menekan **Tandai kehadiran saya**. Guru dapat memantau jumlah check-in di
   halaman sesi (disinkronkan tiap 5 detik selama sesi terbuka).
4. Guru juga dapat menandai manual `hadir / terlambat / izin / sakit / alpa`,
   menambah catatan singkat, menandai seluruh sisa siswa hadir, menutup/membuka
   kembali sesi, menghapus sesi, dan mencetak **poster QR sesi**
   (`/teacher/attendance/:sessionId/qr`).
5. Siswa dapat membuka `/student/attendance` kapan pun: formulir kode sesi
   (untuk siswa yang tidak memindai QR) dan riwayat kehadirannya.

Kode sesi: 8 karakter dari alfabet tanpa karakter ambigu
(`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`), unik di `attendance_sessions.code`, diisi
saat sesi dibuat (sesi lama diisi malas saat pertama dibaca) dan **tidak pernah
berubah** — poster QR yang sudah dicetak tetap berlaku. Semua masukan
dinormalkan oleh `parseAttendanceSessionInput` di `@simpul/shared`: isi QR
berupa tautan `/absen/<KODE>`, kode telanjang, huruf kecil, spasi, atau tanda
hubung semuanya diterima.

## Aturan kehadiran

- Check-in siswa selalu mencatat `hadir` dengan `method = 'scan'`.
- Check-in **tidak menimpa** catatan yang sudah ada. Bila guru sudah mencatat
  izin/sakit/terlambat/alpa, check-in mengembalikan `duplicate: true` beserta
  catatan tersebut; kehadiran hanya dapat diubah guru lewat daftar manual.
- Sesi `closed` menolak check-in (409) dan perubahan status manual (409).
- Siswa non-anggota kelas ditolak (403); kode asing (404).

## Data

```sql
attendance_sessions(id, class_id, course_id NULL, title, date 'YYYY-MM-DD',
                    code TEXT UNIQUE, status 'open'|'closed',
                    created_by, created_at, updated_at)
attendance_records(id, session_id, student_id, status, method 'scan'|'manual',
                   note, marked_by, marked_at,
                   UNIQUE(session_id, student_id))
```

Migrasi SQLite: `apps/api/drizzle/0004_attendance.sql` (tabel) dan
`0005_attendance_session_code.sql` (kolom `code` + indeks unik).
Postgres: DDL idempoten berversi di `apps/api/src/db/pg-init.ts`
(marker `0002` tabel absensi, `0003` kode sesi). Tanggal sesi disimpan sebagai
teks tanggal sekolah, bukan timestamp, agar tidak bergeser oleh zona waktu
server.

## API (`/api/attendance`)

| Metode | Rute | Akses | Guna |
|---|---|---|---|
| GET | `/classes` | guru, admin | kelas yang diampu + sesi hari ini |
| GET | `/sessions?classId&limit` | guru, admin | daftar sesi terbaru (berisi `code`) |
| POST | `/sessions` | guru, admin | buka sesi + kode QR (200 bila sudah ada) |
| GET | `/sessions/:id` | guru, admin | sesi + roster + ringkasan |
| GET | `/sessions/by-code/:code` | siswa | pratinjau sesi dari hasil pindai QR |
| POST | `/sessions/by-code/:code/check-in` | siswa | tandai kehadiran sendiri |
| POST | `/sessions/:id/records` | guru, admin | upsert status manual (`null` = hapus) |
| PATCH | `/sessions/:id` | guru, admin | tutup/buka sesi, ubah judul |
| DELETE | `/sessions/:id` | guru, admin | hapus sesi + catatannya |
| GET | `/me` | siswa | kelas + riwayat kehadiran (maks 60) |

Kontrol akses guru: wali kelas **atau** pengajar salah satu kursus pada kelas
itu. Admin bebas.

## Keputusan

- **QR per sesi, bukan kartu per siswa.** Satu QR ditampilkan di depan kelas dan
  dipakai seluruh siswa; tidak ada kartu yang perlu dicetak/dibagikan dan tidak
  ada risiko tertukar antar siswa.
- **QR berisi URL, bukan payload kustom.** Kamera bawaan ponsel (iOS/Android)
  dapat membukanya tanpa aplikasi pemindai tambahan; halaman check-in tetap
  meminta login agar kehadiran tidak bisa dicatat orang lain.
- **Siswa check-in sendiri, guru mengawasi.** Guru melihat hitungan hadir yang
  menyegarkan sendiri dan tetap memegang daftar manual sebagai sumber koreksi.
- **Tanpa rekap lintas sesi pada iterasi ini.** Ringkasan hanya per sesi; rekap
  periode dapat dibangun di atas tabel yang sama nanti.
- **Tidak ada status "belum ditandai" di basis data.** Ketidakhadiran tanda
  dihitung sebagai `unmarked`; `alpa` hanya jika guru menyatakannya.

## Verifikasi

- `npm run test -w @simpul/shared` — 16/16 lulus, termasuk normalisasi kode
  sesi dari tautan QR, pembentukan path/URL, dan generator kode 8 karakter.
- `npm run test -w @simpul/api` — 19/19 lulus; 6 di antaranya tes absensi: kode
  unik per sesi + idempotensi, kode berbeda antar tanggal, check-in siswa +
  duplikat, catatan guru tidak tertimpa, non-anggota 403, sesi tutup 409 lalu
  buka kembali, riwayat siswa, dan 403 pada rute guru.
- `npm run typecheck -w @simpul/api`, `-w @simpul/web`, dan `npm run build`
  (shared → api → web) lulus.
- Browser nyata (Chromium headless): `npx tsx tooling/attendance-check.ts`
  → **26/26 pemeriksaan lulus**. Alur terverifikasi: hub tanpa tautan kartu,
  buka sesi, QR sesi + kode 8 karakter + tautan `/absen/<KODE>`, tandai manual
  lalu hapus tanda, poster QR, tautan QR → login → kembali ke check-in,
  check-in siswa tercatat, buka ulang tidak menggandakan, kode asing ditolak,
  riwayat siswa, guru melihat status "Check-in QR", tanpa overflow horizontal
  pada 390×844, tanpa galat API tak terduga, dan sesi uji dihapus kembali.
  Screenshot: `/tmp/opencode/simpul-shots/attendance-*.png`.

## Catatan deploy (Vercel/Neon)

DDL Postgres di `pg-init.ts` dipisah chunk berversi: `0001` (skema inti),
`0002` (tabel absensi), dan `0003` (kolom `attendance_sessions.code`). Deploy
lama hanya menjalankan chunk `0003` (2 statement). Setiap chunk dikirim sebagai
**satu query** (simple query Neon mengeksekusi banyak statement dalam satu
round-trip, implicit transaction) agar cold start tetap di bawah batas 10 detik
fungsi Vercel; bila proxy menolak atau hanya menjalankan statement pertama
(diperiksa lewat `to_regclass` / `information_schema.columns`), chunk diulang
per statement karena seluruh DDL idempoten.

Kolom lama `users.attendance_code` tidak lagi dipakai dan tidak ada di skema;
kolom nullable itu boleh dibiarkan di database produksi (tidak mengganggu).
