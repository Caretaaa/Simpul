# 06 — Basis Data (relasi tingkat tinggi)

```
users ─┬─ user_sessions (revocable, TTL)
       ├─ classes.homeroom_teacher ── classes ─┬─ courses ─┬─ modules ── lessons ── lesson_progress
       │                                       │           └─ course_enrollments ── users(siswa)
       │                                       └─ announcements(course scope)
       └─ audit_logs(actor)
academic_years ── classes
subjects ── courses
```

Phase 1 tercakup: users, user_sessions, academic_years, classes, subjects,
courses, course_enrollments, modules, lessons, lesson_progress, announcements,
audit_logs. Migrasi: `apps/api/drizzle/0001_initial.sql`.

Phase 3 menambahkan: competencies, course_competencies, labs, lab_steps,
lab_submissions, submission_attachments, assignments, assignment_submissions,
quizzes, questions, question_options, quiz_attempts, quiz_answers, grades,
assessment_rubrics, rubric_criteria, rubric_scores, notifications, file_assets.

**Aturan:** PK teks, FK + cascade yang tepat, UNIQUE (email; course+student;
lesson+student), indeks (role, teacher, class, actor), timestamps epoch-ms
(dev SQLite) ↔ `TIMESTAMPTZ` (prod Postgres — konversi mekanis, kolom setara).
