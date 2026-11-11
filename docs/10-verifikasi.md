# 10 — Verifikasi & Pengujian

## Hasil yang benar-benar dijalankan (riwayat sesi ini)

### 1. Unit domain — `packages/shared`
```
Test Files  1 passed (1)
     Tests  11 passed (11)
```
Mencakup: konversi IP↔int, mask kontigu, /24 & /26, RFC 3021 (/31, /32),
total alamat 2^(32-prefix), determinisme seed, validasi jawaban per kolom.

### 2. Integrasi API — `apps/api` (Vitest + `app.inject`)
```
Test Files  1 passed (1)
     Tests  10 passed (10)
```
Alur terverifikasi:
- guru membuat kursus → tolak terbit tanpa materi (409) → tambah modul →
  tambah materi → terbit → detail berisi materi.
- admin enroll siswa (idempoten: `added=1` lalu `added=0`) → siswa melihat
  `isEnrolled=true` → siswa menandai materi selesai → `/api/me/progress`
  memuat pelajaran tsb → guru dicoba mencatat progres → **403**.
- kursus tak dikenal → **404**; guru mengubah kursus admin → **403**.
- reset kata sandi: token sekali pakai (pemakaian kedua → 400), sandi lama 401.
- pengumuman sekolah terlihat siswa; guru mengumumkan kursus admin → **403**.
- **gabung kelas**: kode 6 karakter unik per kelas baru; intip kelas dari kode
  (normalisasi huruf kecil/spasi); siswa bergabung → otomatis terdaftar ke
  kursus terbit (idempoten, `already: true` saat diulang); kode salah → 404;
  guru bergabung → 403; regenerasi kode oleh admin membuat kode lama mati.
- **pembuatan kelas**: guru membuat kelas → otomatis menjadi wali + dapat kode;
  siswa membuat → 403; admin membuat sambil memilih wali (harus guru aktif)
  + siswa anggota; PATCH mengganti daftar anggota (semantik set); wali/siswa
  tidak valid → 400.

### 3. Verifikasi browser nyata (Chromium headless, Playwright)
Alur end-to-end lewat UI (dijalankan pada DB dev bersih pasca-reseed):
- login per peran (admin/guru/siswa) → redirect ke dasbor masing-masing.
- **admin**: membuat kelas lewat form → muncul di tabel; membuat pengumuman
  sekolah lewat form.
- **guru**: membuat kursus → menambah modul → menambah materi →
  menekan **Terbitkan** (validasi: kursus tanpa materi ditolak dengan 409).
- **siswa**: melihat kursus kursinya → membuka detail → membaca materi
  (blok perintah monospace + callout teknis) → menandai selesai → tombol
  berubah "Sudah selesai"; progres tercermin di detail kursus.
- **403** saat siswa membuka rute admin; **404** untuk rute tak dikenal.
- **Mobile** 390×844: bottom nav + tata letak ulang; **mode gelap**
  token Graphite Laboratory diverifikasi lewat `data-theme` + computed style
  (`rgb(17,23,28)` / `rgb(242,241,235)`).

Perintah: `npx tsx tooling/visual-check.ts` (memakai Chromium sistem).
Screenshot disimpan ke `/tmp/opencode/simpul-shots/`.

### 4. Smoke HTTP nyata
```bash
curl -X POST localhost:3001/api/auth/login -d '{"email":"siswa@simpul.sch.id","password":"Siswa123!"}' -c cj.txt
curl -b cj.txt localhost:3001/api/auth/me         # 200 + user + role
curl -b cj.txt localhost:3001/api/users           # 403 (peran siswa)
curl -b cj.txt localhost:3001/api/courses         # hanya kursus terdaftar/terbit
```

### 5. Produksi (build nyata dijalankan)
- `npm run build` → shared, api (`dist/server.js`), web (`dist/` + SW).
- `NODE_ENV=production SESSION_SECRET=pendek node dist/server.js` → **gagal
  cepat**: "SESSION_SECRET minimal 16 karakter".
- `POST /api/auth/password-reset/request` di produksi → token **tidak**
  dikembalikan (hanya pesan netral).
- `/api/health` → `{"ok":true,...}`; login tanpa seed → 401 dengan pesan generik.

## Yang BELUM diuji (jujur)
- E2E Playwright sebagai suite CI (skrip verifikasi ada, belum pipeline).
- Beban/konkurensi SQLite (dev) dan PostgreSQL (produksi).
- Jalur produksi dengan HTTPS + Postgres (belum di-deploy).

## 6. Redesain workspace akademik + i18n (sesi ini, frontend web saja)

Perintah: `npx tsx tooling/visual-check.ts` (Chromium nyata, DB dev bersih
pasca-reseed) + `npx tsx tooling/i18n-check.ts` + `npx tsx tooling/i18n-shots.ts`.
Screenshot: `/tmp/opencode/simpul-shots-redesign/`.

- `npm run typecheck -w @simpul/web` → lolos; `npm run build -w @simpul/web`
  → lolos (`dist/` + SW); `npm test` (shared 11 + API 14) → semua lolos.
- Login per peran → dasbor masing-masing; alur siswa kursus → detail
  (breadcrumb) → materi → "Tandai selesai" → tombol menjadi "Sudah selesai"
  dan progres dasbor berubah 0/6 → 1/6 (17%) dari data nyata.
- Ganti bahasa ID↔EN tanpa refresh penuh, persisten lewat `localStorage`
  (`simpul-lang`, default `id`); atribut `lang` dokumen ikut berubah.
- Pencarian global di bilah atas → `?q=` pada halaman kursus peran terkait.
- Sidebar collapsible persisten (`simpul-nav-collapsed`); laci seluler +
  bottom nav; lencana belum-dibaca pada bel notifikasi (sumber: pengumuman,
  status-baca lokal per perangkat); mode gelap Graphite Laboratory terverifikasi.
- `overflowX = 0` pada 1440px dan 390px, dalam ID maupun EN.
- 1 pesan console `401` saat verifikasi = `/auth/me` pra-login (by design,
  mengembalikan `null`, bukan error) — perilaku lama yang dipertahankan.

## 7. Perbaikan login: API tidak memuat `.env` (bug setup)

Gejala: halaman login menampilkan "Tidak dapat masuk. Periksa koneksi Anda."
padahal kredensial benar. Akar masalah: `apps/api` hanya membaca
`process.env`, tidak ada pemuat dotenv, sehingga `npm run dev:api` pada shell
bersih langsung crash (`SESSION_SECRET: Required`) — alur README tidak bisa
jalan apa adanya. Perbaikan: skrip `dev` dan `seed` di `apps/api/package.json`
kini memakai `--env-file ../../.env` bawaan Node (tanpa dependensi baru).
Terverifikasi via `tooling/login-check.ts` (Chromium nyata): login
siswa/guru/admin → dasbor masing-masing, tanpa `pageerror`; kredensial salah
→ "Surel atau kata sandi salah."

## 8. i18n halaman guru/admin + dialog konfirmasi hapus

Seluruh halaman guru (daftar kursus + `?q=`, editor modul/materi, kelas saya)
dan admin (pengguna, kelas + editor wali/siswa, mapel, tahun ajaran,
pengumuman + komposer) kini memakai kamus `id`/`en`, termasuk pesan validasi
Zod (skema dibangun di dalam komponen agar memakai bahasa aktif) dan
`StatusPill` (kode status → label lokal). Aksi destruktif (hapus modul/materi/
kelas/pengguna, nonaktifkan akun, ganti tahun aktif) kini meminta konfirmasi
`window.confirm` berbahasa aktif — sekaligus memperbaiki tautan 403 yang
sebelumnya mengarah ke `/login`, kini ke dasbor peran masing-masing.
Terverifikasi via `tooling/teacher-admin-check.ts` (Chromium nyata, EN+ID):
h1 "Courses"/"My classes"/"Pengguna" sesuai bahasa, dialog "Delete module?"
muncul, publikasi pengumuman admin tampil di daftar, `overflowX = 0`,
nol `pageerror`.

## 9. Navigasi "Segera hadir" menjadi tautan jujur

Item sidebar Lab/Tugas/Kuis/Latihan/Kompetensi sebelumnya nonaktif total
(diklik tidak terjadi apa-apa). Kini semuanya tautan navigasi biasa — tetap
berbadge "Segera hadir" agar ekspektasi jelas — menuju halaman yang jujur
menjelaskan cakupan fase vokasional plus tombol aksi berguna ("Buka kursus
saya", "Lihat progres bacaan", "Kembali ke dasbor"). Gabung kelas tetap TIDAK
membuka fitur-fitur itu (backend-nya memang belum ada); yang terbuka lewat
gabung kelas adalah kursus-kursus terbit di kelas tersebut. Terverifikasi via
`tooling/soon-nav-check.ts`: klik sidebar Lab/Tugas/Kuis/Subnetting/Progres →
URL tepat, tanpa `pageerror`.

## 10. Halaman demo yang bisa dipakai: Lab, Tugas, Kuis, Latihan Subnetting

Empat rute siswa yang tadinya placeholder kini memuat konten demo yang benar-benar
dapat dipakai saat presentasi — dengan kejujuran tetap dijaga:

- **Prinsip**: semua konten dari `apps/web/src/lib/demo.ts`, berbadge
  "DATA DEMO" di banner atas setiap halaman + catatan bahwa progres (checklist,
  status kiriman, skor) hanya tersimpan di localStorage perangkat, tidak ke
  server. Tidak ada yang berpura-pura menjadi data sekolah asli.
- **Lab** (`/student/labs`, `/student/labs/:labId`): daftar 2 lab praktikum
  (LAN kantor, VLAN) dengan tujuan, skenario, tabel perangkat, langkah kerja +
  blok perintah yang bisa disalin, rubrik berbobot, dan checklist interaktif
  yang tersimpan per lab (tombol "Kosongkan checklist" memakai `window.confirm`).
- **Tugas** (`/student/assignments`): 3 tugas contoh dengan tenggat relatif
  terhadap hari ini (1 terlambat, 1 dekat, 1 longgar) → pil status merah/kuning
  netral; tombol "Tandai sudah dikumpulkan" menyimpan status di localStorage
  dan bisa dibatalkan; nama lampiran diberi catatan "tidak ada berkas nyata".
- **Kuis** (`/student/quizzes`, `/student/quizzes/:quizId`): 2 kuis (5 dan 4
  soal) dengan pewaktu hitung-mundur (otomatis menutup saat 0), satu soal per
  layar, skor dihitung di browser, pil Lulus/Belum lulus vs nilai lulus 70,
  tinjauan per soal (jawaban Anda/jawaban benar/pembahasan), dan skor terbaik
  tersimpan per kuis.
- **Latihan Subnetting** (`/student/subnetting`): memakai mesin soal NYATA dari
  `@simpul/shared` (`generateExercise` + `validateAnswer`) — 3 tingkat
  (mudah/sedang/sukar), penilaian per kolom (hijau/merah), pembahasan rumus,
  rentetan benar, dan riwayat 10 entri terakhir (hapus riwayat pakai
  `window.confirm`).
- **Navigasi & dasbor**: item sidebar siswa Lab/Tugas/Kuis/Latihan pindah dari
  badge abu "Segera hadir" ke badge aksen "DEMO" (grup diubah jadi "Praktik &
  progres"); Kompetensi saya tidak lagi berbadge karena halamannya nyata. Kartu
  Tugas & Praktikum di dasbor siswa menegaskan isinya data demo. Halaman
  placeholder tetap untuk rute guru/admin.
- **i18n**: seluruh string demo ditambahkan sebagai subtree `demo.*` di
  `id.ts` dan `en.ts` (kunci identik); teks tenggat memakai `formatDate`
  sesuai locale.

Terverifikasi via `tooling/demo-check.ts` (Chromium nyata, ID lalu EN):
**30 PASS / 0 FAIL** — badge demo di sidebar & banner, 2 lab + detail (4 blok
perintah, 6 item checklist, centang bertahan setelah reload), 3 tugas (kartu
"Terlambat" ada, tandai-terkumpul tampil & bertahan setelah reload), kuis
dijawab benar semua → skor "100%" + pil "Lulus" + skor terbaik "100" di
localStorage, subnetting diisi dengan hasil `calculateSubnet` ulang dari script
→ "Semua kolom yang diisi benar!" + riwayat terisi, "Soal baru" mengosongkan
kolom, EN aktif ("Demo data", h1 "Assignments"), dan nol `pageerror`.
Typecheck + build produksi web hijau setelah perubahan.

## 11. Pengumpulan tugas demo: unggah berkas dengan format sesuai izin guru

Bagian "Pengumpulan" di tiap kartu tugas kini nyata alurnya: pilih berkas →
divalidasi → terkumpul. Format yang diizinkan ditentukan per tugas (seolah
guru yang mengatur, datanya di `demo.ts`: `allowedTypes` + `maxFileMB`):

- **TGS-01** (laporan): hanya **PDF**, maks 5 MB.
- **TGS-02** (bukti foto): **JPG/JPEG/PNG**, maks 10 MB.
- **TGS-03** (diagram): **PDF/PNG/JPG**, maks 8 MB (instruksi disesuaikan:
  "gambar PNG/JPG atau PDF").

Detail perilaku:

- Ekstensi berkas divalidasi terhadap `allowedTypes`; format lain ditolak
  dengan pesan `role="alert"` yang menyebut format yang diizinkan. Ukuran
  melebihi `maxFileMB` juga ditolak. Input memakai `accept=.`+ekstensi agar
  dialog berkas memfilter sejak awal.
- Berkas dipilih → tampil sebagai chip (nama + ukuran) yang bisa dibuang;
  "Kumpulkan berkas" menyimpan **metadata saja** (nama, ukuran, waktu) ke
  localStorage — isi berkas TIDAK diunggah ke server, dinyatakan jujur di
  kartu: "Berkas tidak diunggah ke server — hanya nama, ukuran, dan waktu
  pengumpulan yang disimpan di perangkat ini (demo)."
- Status terkumpul menampilkan berkas + waktu, dengan "Ganti berkas"
  (mengganti = pilih → kumpulkan ulang) dan "Batalkan tanda terkumpul".
- Tipe `DemoSubmitRecord` di `demo.ts`; pembacaan localStorage tahan data
  lama berbentuk boolean (divalidasi bentuk, bukan asal dipakai).

Terverifikasi via `tooling/demo-check.ts` (diperbarui): **34 PASS / 0 FAIL** —
info "Format yang diizinkan guru" tampil, `jawaban.txt` ditolak, `laporan-subnetting.pdf`
diterima → chip tampil → "Terkumpul (demo)" → nama berkas + metadata masih ada
setelah reload (localStorage memuat `fileName`), tanpa `pageerror`. Typecheck
+ build produksi web tetap hijau.
