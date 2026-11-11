# 12 — PWA: Instalasi & Perilaku

## Yang sudah bekerja (Phase 1)
- **Manifest** (`apps/web/vite.config.ts` → `VitePWA`): `name`, `short_name`,
  `start_url`, `scope`, `display: standalone`, `background_color`, `theme_color`,
  `lang: id`, ikon 192/512 + maskable.
- **Ikon** dibuat nyata di `apps/web/public/icons/` (PNG asli, bukan stub kosong).
- **Service worker** Workbox: `navigateFallback: index.html`, precache rute &
  aset, cache rilis berversi, `registerType: "prompt"` (pembaruan diminta
  konfirmasi implisit lewat lifecycle, tanpa reload paksa).
- **Indikator koneksi** di `AuthProvider`: banner `MODE LURING — sebagian fitur
  membutuhkan internet` saat `offline`, otomatis hilang saat kembali online.
- **Reduced motion** dihormati (`prefers-reduced-motion`).

## Instalasi
1. Jalankan build dan sajikan `dist/` lewat **HTTPS** (atau `localhost`).
   ```bash
   npm run build -w @simpul/web && npm run preview -w @simpul/web
   ```
2. Buka di Chrome/Edge (desktop/Android) → ikon *Install* di address bar, atau
   menu → *Install SIMPUL*.
3. Aplikasi terbuka standalone (`display: standalone`) dengan ikon mandiri.

## Batas luring (saat ini, jujur)
Belum ada konten pembelajaran tersimpan luring pada Phase 1–2. Mode luring saat
ini: aplikasi tetap dapat dibuka (app shell dari cache), tetapi permintaan API
akan gagal dan ditandai banner MODE LURING.

## Phase 4 (rencana)
- Materi ditandai "tersimpan luring" per pelajaran + menyimpan asetnya (HTML,
  gambar, PDF) di Cache Storage.
- Struktur data luring di IndexedDB: pelajaran tersimpan, draf jawaban, dan
  **antrean operasi idempoten** (idempotency key server-side).
- Status eksplisit per konten: **tersedia luring**, **butuh internet**,
  **menunggu sinkronisasi**, **sinkronisasi gagal**.
- Saat daring kembali: sinkronkan, cegah duplikasi, laporkan sukses/gagal,
  konflik ditolak eksplisit (tidak pernah menimpa data server yang lebih baru).
- **Tidak** diklaim luring: autentikasi, penilaian server, unggahan besar.
