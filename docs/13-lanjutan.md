# 13 — Catatan Kelanjutan (Phase 3)

## Lab Workspace (prioritas pembeda)
Entitas: `labs`, `lab_steps`, `lab_submissions`, `submission_attachments`,
`assessment_rubrics`, `rubric_criteria`, `rubric_scores`, `file_assets`.
Alur: guru membuat lab (draf) → tetapkan ke kursus + tenggat → terbit → siswa
buka workspace dua kolom (kiri: tujuan/skenario/langkah/checklist; kanan:
buletin/bukti/verifikasi) → kirim bukti → guru nilai per kriteria rubrik →
minta revisi bila perlu → siswa ajukan ulang.

Aturan bisnis yang harus diuji: tenggat (terlambat → status `late`), batas
revisi, penghapusan aman lampiran (hanya pemilik/admin), unduhan lewat endpoint
berizin.

## Tugas & kuis
- Tugas: `assignments`, `assignment_submissions` + unggah berkas (pdf,
  gambar, ekspor konfigurasi `.txt/.cfg/.rsc`), batas ukuran & jenis, status
  `draft|submitted|graded|late`.
- Kuis: `quizzes`, `questions`, `question_options`, `quiz_attempts`,
  `quiz_answers`; skoring objektif **selalu di server**, kunci jawaban tidak
  pernah dikirim sebelum percobaan selesai/review berizin; jendela waktu, batas
  percobaan, waktu pengerjaan, histori + penjelasan jawaban.

## Kompetensi
`competencies` + `course_competencies` sudah ada. Capaian siswa dihitung dari:
ketercapaian kriteria rubrik (lab/tugas), skor kuis terkait, dan penyelesaian
materi yang terkait maping. Komponen `CompetencyIndicator` menampilkan bukti
sumber nilai, bukan sekadar persentase.

## Alat subnetting
Logika sudah siap & teruji di `packages/shared`. UI: generator soal seeded
(untuk latihan terarah + pengujian), tiga tingkat kesulitan, validasi per
kolom, penjelasan solusi, riwayat latihan di `quiz_attempts`/tabel khusus
`subnetting_history`.

## PWA luring penuh
Cache Storage untuk materi bertanda "tersimpan luring"; IndexedDB untuk draf
jawaban; antrean operasi idempoten (idempotency key) dengan status eksplisit:
tersedia luring / butuh internet / menunggu sinkronisasi / sinkronisasi gagal.

## Utang teknis yang diketahui
1. `node:sqlite` dipakai di dev; jalur produksi Postgres memerlukan implementasi
   `connection.ts` + migrasi drizzle-kit (didokumentasikan di `docs/11-operasi.md`).
2. Belum ada paginasi (batas 500 baris) untuk daftar besar.
3. Skrip verifikasi visual belum jadi suite CI (Playwright).
4. Unggahan/attachment: guard ukuran & tipe wajib sebelum Phase 3 dirilis.
5. Belum ada rate-limit khusus per pengguna (khusus per-IP saat ini).
