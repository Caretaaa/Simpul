# 09 — Risiko & Tradeoff

1. **SQLite dev vs Postgres prod** — risiko divergensi. Mitigasi: tipe portabel,
   lapis DB terisolasi, migrasi per dialek, CI Postgres di Phase 5.
2. **Tanpa klaim simulasi jaringan** — jangan pura-pura mengeksekusi topologi.
   Viewer read-only + tautan Packet Tracer/GNS3/EVE-NG; emulasi hanya bila ada
   model data + persistensi + tes.
3. **Offline vs otoritas server** — auth, grading, upload besar TIDAK offline.
   Antrean hanya untuk operasi retry-aman dengan idempotency key.
4. **Kunci jawaban kuis** — skoring server-side; API tak pernah mengekspos kunci
   sebelum submit/review berizin.
5. **Perangkat siswa murah** — anggaran animasi ketat, code-split per rute,
   paginasi, gambar optimal.
6. **Cakupan vs kualitas** — tiap fase harus working & testable; placeholder
   eksplisit lebih baik daripada tombol palsu.
