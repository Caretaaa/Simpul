# README — SIMPUL

**SIMPUL** — Ruang Belajar. Ruang Praktik. Ruang Berkembang.
PWA Learning Management System vokasional untuk SMK Teknik Komputer dan Jaringan (TKJ).

## Apa ini
LMS yang menghubungkan teori → praktik lab → asesmen → kompetensi, dengan bahasa
desain *Technical Editorial × Industrial Learning Workspace*. Semua antarmuka
memakai Bahasa Indonesia yang natural.

## Status implementasi (jujur)

| Fase | Status | Isi terverifikasi |
|---|---|---|
| 1 — Fondasi | ✅ Selesai | Arsitektur, IA, rute + guard, skema DB + migrasi + seed, auth cookie + RBAC, token desain dual-theme, app shell responsif, PWA (manifest/SW/ikon) |
| 2 — Core LMS | ✅ Selesai | Manajemen pengguna/kelas/mapel/tahun ajaran (admin), kursus draft→terbit, modul & materi, enrollmen, **gabung kelas via kode + tautan**, progres materi, pengumuman, reset kata sandi |
| 3 — Vokasional | ⏳ Berikutnya | Lab Workspace + rubrik, tugas & kiriman berkas, kuis (skor server-side), kompetensi terhitung, alat subnetting |
| 4 — PWA penuh | ⏳ Berikutnya | Materi tersimpan luring, IndexedDB, antrean sinkronisasi idempoten |
| 5 — Hardening | ⏳ Berikutnya | E2E Playwright, audit a11y/keamanan, performa, deployment |

## Teknologi
- **Web:** React 18, TypeScript strict, Vite 5, React Router 6, Tailwind 3
  (token CSS), TanStack Query 5, React Hook Form + Zod, Lucide, vite-plugin-pwa.
- **API:** Fastify 5, Drizzle ORM, bcryptjs (cost 12), cookie session HttpOnly,
  `node:sqlite` (tanpa native binding) — skema ditulis portabel ke PostgreSQL.
- **Shared:** kontrak Zod + logika subnetting IPv4 murni + teruji.
- **Tes:** Vitest (unit domain + integrasi API `inject`), Playwright
  (verifikasi visual browser nyata via `tooling/`).

Lihat justifikasi & tradeoff di `docs/02-stack.md` dan `docs/09-keputusan-arsitektur.md`.

## Prasyarat
Node.js ≥ 20 (Node ≥ 22.5 untuk `node:sqlite`; diverifikasi pada Node 26), npm ≥ 10.

## Menjalankan lokal
```bash
cd simpul
npm install
cp .env.example .env
npm run seed -w @simpul/api     # buat DB dev + data demo
npm run dev:api                 # API  → http://localhost:3001
npm run dev:web                 # Web  → http://localhost:5173 (proxy /api)
```

### Akun demo (data pengembangan — BUKAN data sekolah asli)
| Peran | Surel | Kata sandi |
|---|---|---|
| Admin | admin@simpul.sch.id | Admin123! |
| Guru | guru@simpul.sch.id | Guru123! |
| Siswa | siswa@simpul.sch.id | Siswa123! |
| Siswa | siswa2@simpul.sch.id | Siswa123! |

**Materi milik guru** (Budi Santoso): kursus terbit *Dasar Pengalamatan IP &
Subnetting* berisi 3 modul × 6 materi (artikel + 1 video referensi), plus 1
materi draf pada kursus *Dasar VLAN dan Segmentasi Jaringan*.

**Gabung kelas**: setiap kelas punya kode 6 karakter (lihat output seed atau
halaman *Kelas saya* milik guru). Siswa masuk lewat `http://localhost:5173/join/<KODE>`
atau formulir kode di halaman kursus. Kolom kata sandi memiliki tombol mata
(tampilkan/sembunyikan) di halaman login dan form admin.

**Kelola kelas**: guru dapat membuat kelas (otomatis menjadi wali) di halaman
*Kelas saya*. Admin dapat memilih wali kelas dan mencentang siswa anggota
langsung pada formulir buat kelas, serta mengubah wali/anggota belakangan
via tombol *Kelola wali & siswa* pada tiap kartu kelas.

Reset kata sandi: `POST /api/auth/password-reset/request` mengembalikan
`devToken` **hanya saat `NODE_ENV !== production`** (tanpa SMTP). Token sekali
pakai, kedaluwarsa 30 menit: `POST /api/auth/password-reset/resolve`.

## Tes
```bash
npm test                       # shared (subnetting) + API integrasi
npm run test -w @simpul/api    # hanya API
npm run test -w @simpul/shared # hanya domain
```
Verifikasi visual (Chromium nyata + screenshot): `docs/10-verifikasi.md`.

## Build produksi
```bash
npm run build                  # shared → api → web
npm run start -w @simpul/api   # menjalankan dist/server.js
npm run preview -w @simpul/web # menyajikan dist/ (di belakang HTTPS)
```

## PWA
Manifest, ikon (192/512 + maskable), service worker Workbox, indikator
online/offline, dan prompt pembaruan sudah aktif. Instalasi: buka URL produksi
(HTTPS) di Chrome/Edge → *Install*. Kemampuan luring penuh: Phase 4.

## Struktur
```
apps/web/src/{app,routes,features/{auth,courses,teacher,admin},components/design-system,lib,styles}
apps/api/src/{modules,middleware,db}   packages/shared/src
docs/  tooling/
```

## Catatan desain
- Token warna: Workshop Paper (terang) & Graphite Laboratory (gelap) —
  `docs/05-desain.md`.
- Huruf: Space Grotesk (judul), Inter (tubuh), IBM Plex Mono (IP/perintah/ID).
- Tema otomatis mengikuti preferensi sistem, dapat dialihkan manual.
- Semua kondisi: loading, kosong, error, 403, 404, sukses — ditangani eksplisit.
