# 04 — Arsitektur Informasi & Rute

```
/login, /settings, /notifications, /profile, /join/:code
/student/dashboard, /student/courses, /student/courses/:id,
  /student/lessons/:id, /student/labs, /student/labs/:id,
  /student/assignments, /student/quizzes, /student/subnetting, /student/progress
/teacher/dashboard, /teacher/courses, /teacher/courses/new,
  /teacher/courses/:id/edit, /teacher/classes, /teacher/labs,
  /teacher/assignments, /teacher/submissions, /teacher/assessments
/admin/dashboard, /admin/users, /admin/classes, /admin/subjects,
  /admin/courses, /admin/academic-years, /admin/competencies, /admin/settings
```

**Gabung kelas:** setiap kelas memiliki kode 6 karakter (cth. `XK7P2Q`) yang
dibuat otomatis saat kelas dibuat. Siswa masuk via `/join/:code` (pratinjau
kelas → tombol gabung) atau formulir kode di halaman kursus. Setelah bergabung,
siswa otomatis terdaftar ke seluruh kursus terbit pada kelas tersebut.
Kode dapat dibuat ulang oleh admin bila tersebar ke pihak yang salah.

Status Phase 1: shell + guard + dasbor per peran + daftar kursus +
placeholder jujur ("Hadir di fase berikutnya") untuk rute Phase 2–4.
State: 403 (peran salah), 404 (tak dikenal), loading, error — semua eksplisit.
