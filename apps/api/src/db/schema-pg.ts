import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Mirror PostgreSQL dari src/db/schema.ts (dialek SQLite).
 * Nama tabel, nama kolom, dan properti TS identik agar seluruh kode modul
 * (routes/seed) dapat dipakai antar-dialek tanpa perubahan. Perbedaan hanya
 * pada tipe kolom: timestamp_ms epoch → timestamptz, boolean integer → boolean.
 * DDL pendamping: drizzle-pg pada pg-init.ts (dijalankan otomatis saat cold start).
 */

const id = () => text("id").primaryKey();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull();

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "guru", "siswa"] }).notNull(),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const userSessions = pgTable("user_sessions", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const academicYears = pgTable("academic_years", {
  id: id(),
  name: text("name").notNull().unique(), // cth. "2025/2026 Ganjil"
  isActive: boolean("is_active").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const classes = pgTable("classes", {
  id: id(),
  name: text("name").notNull(), // cth. "XI TKJ 1"
  grade: text("grade", { enum: ["X", "XI", "XII"] }).notNull(),
  major: text("major").notNull().default("TKJ"),
  academicYearId: text("academic_year_id").references(() => academicYears.id),
  homeroomTeacherId: text("homeroom_teacher_id").references(() => users.id),
  /** Kode gabung 6 karakter (cth. "XK7P2Q") — dibagikan guru ke siswa. */
  joinCode: text("join_code").unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const subjects = pgTable("subjects", {
  id: id(),
  code: text("code").notNull().unique(), // cth. "AIJ"
  name: text("name").notNull(),
  description: text("description"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const courses = pgTable("courses", {
  id: id(),
  title: text("title").notNull(),
  description: text("description"),
  subjectId: text("subject_id").references(() => subjects.id),
  classId: text("class_id").references(() => classes.id),
  teacherId: text("teacher_id").references(() => users.id),
  status: text("status", { enum: ["draft", "published", "archived"] }).notNull().default("draft"),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const courseEnrollments = pgTable("course_enrollments", {
  id: id(),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull(),
});

/** Keanggotaan siswa pada kelas (melalui kode gabung). */
export const classMemberships = pgTable("class_memberships", {
  id: id(),
  classId: text("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull(),
});

export const modules = pgTable("modules", {
  id: id(),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const lessons = pgTable("lessons", {
  id: id(),
  moduleId: text("module_id").notNull().references(() => modules.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  contentType: text("content_type", {
    enum: ["article", "video", "pdf", "lab", "external"],
  }).notNull().default("article"),
  body: text("body"),
  position: integer("position").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const lessonProgress = pgTable("lesson_progress", {
  id: id(),
  lessonId: text("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["started", "completed"] }).notNull().default("started"),
  updatedAt: updatedAt(),
});

export const announcements = pgTable("announcements", {
  id: id(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  scope: text("scope", { enum: ["school", "course"] }).notNull().default("school"),
  courseId: text("course_id").references(() => courses.id, { onDelete: "cascade" }),
  authorId: text("author_id").references(() => users.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const auditLogs = pgTable("audit_logs", {
  id: id(),
  actorId: text("actor_id").references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  metadata: text("metadata"),
  createdAt: createdAt(),
});

export const notifications = pgTable("notifications", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body"),
  kind: text("kind", { enum: ["info", "deadline", "grade", "submission"] }).notNull().default("info"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const competencies = pgTable("competencies", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const courseCompetencies = pgTable("course_competencies", {
  id: id(),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  competencyId: text("competency_id").notNull().references(() => competencies.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});
