# 05 — Arah Desain & Token

**Bahasa desain:** *Technical Editorial × Industrial Learning Workspace.*
Editorial (tipografi kuat, nomor teknis, grid modular) × lab (monospace
bermakna, garis arsitektural 1px, whitespace disengaja).

**Dilarang:** gradien ungu-biru generik, glassmorphism, kartu KPI menumpuk,
ilustrasi AI, emoji sebagai ikon, radius/shadow berlebihan.

**Token** (`apps/web/src/styles/tokens.css`):
- Light *Workshop Paper*: bg `#F6F4EE`, surface `#FFFEFA`, ink `#171D24`,
  muted `#647079`, aksen `#DE653F`, teal `#446D65`, garis `#DDDCD5`.
- Dark *Graphite Lab*: bg `#11171C`, surface `#1B2329`, elevated `#242E35`,
  ink `#F2F1EB`, muted `#A8B2B7`, aksen `#F18B67`, teal `#9ABFB0`, garis `#364149`.
- Huruf: Space Grotesk (judul), Inter (tubuh), IBM Plex Mono (IP/perintah/ID).
- Komponen teknis bermakna: `IPAddressDisplay`, `CIDRBadge`, `CommandBlock`
  (+salin), `StatusPill`, `PageHeader` (nomor + judul), `EmptyState` yang dirancang.
- Komponen pengalaman belajar: `CourseCover` (sampul topologi deterministik per
  kursus — identitas visual, bukan data jaringan), `ProgressBar` (progres dari
  data nyata + `role=progressbar`), `LessonStatusDot` (selesai/berjalan/daftar),
  daftar isi materi + estimasi waktu baca (± kata/200/menit).
- Gerak 150–250ms + `prefers-reduced-motion`; fokus `:focus-visible` jelas.
