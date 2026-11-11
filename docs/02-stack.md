# 02 — Stack & Justifikasi

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Web | React 18 + Vite 5 + TS strict | Ekosistem stabil, code-splitting per rute, build cepat |
| Router | React Router 6 | Protected layout per peran, 403/404 eksplisit |
| State server | TanStack Query 5 | Cache, retry, invalidasi; tanpa global state tak perlu |
| Form | RHF + Zod | Validasi konsisten klien & server, pesan BI |
| CSS | Tailwind 3 + token CSS | Token dual-theme sebagai variabel; bukan tampilan default shadcn |
| Ikon | Lucide | Ikon vektor konsisten; tanpa emoji sebagai ikon primer |
| PWA | vite-plugin-pwa + Workbox | Manifest, SW, cache versioning, update prompt |
| API | Fastify 5 + TS | Cepat, skema jelas, plugin cookie/cors/rate-limit |
| ORM | Drizzle | SQL eksplisit, migrasi terkontrol, portabel PG↔SQLite |
| DB dev | SQLite (better-sqlite3) | Lingkungan ini tanpa Postgres/Docker; skema ditulis portabel |
| DB prod | PostgreSQL | Target Phase 5; konversi tipe 1:1 di `docs/06-database.md` |
| Auth | Cookie HttpOnly + sesi hash SHA-256 | Tanpa token di localStorage; sesi revocable, TTL 7 hari |
| Hash | bcryptjs (cost 12) | Standar aman tanpa native binding |
| Test | Vitest (+ RTL/Playwright Phase 5) | Unit domain + integrasi API via `inject` |

**Tradeoff sadar:** SQLite dev ≠ Postgres prod (perbedaan konkurensi/tipe).
Dimigasi dengan: (a) tipe kolom portabel, (b) akses DB terisolasi di
`apps/api/src/db/*`, (c) migrasi SQL terdokumentasi per dialek.
