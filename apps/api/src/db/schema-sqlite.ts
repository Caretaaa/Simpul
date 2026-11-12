import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Util kolom umum: id teks (nanoid/cuid dari aplikasi), timestamps epoch. */
const id = () => text("id").primaryKey();
const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull();
const updatedAt = () => integer("updated_at", { mode: "timestamp_ms" }).notNull();

/**
 * Skema relasional Phase 1–2. Ditulis portabel: tipe kolom memakai padanan
 * SQLite yang memiliki ekuivalen langsung di PostgreSQL (text/integer/timestamp).
 * Migrasi produksi Postgres: lihat drizzle/0001_initial.sql (dialek disesuaikan
 * via drizzle-kit saat Postgres tersedia).
 */
export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "guru", "siswa"] }).notNull(),
  avatarUrl: text("avatar_url"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const userSessions = sqliteTable("user_sessions", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
});

export const academicYears = sqliteTable("academic_years", {
  id: id(),
  name: text("name").notNull().unique(), // cth. "2025/2026 Ganjil"
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const classes = sqliteTable("classes", {
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

export const subjects = sqliteTable("subjects", {
  id: id(),
  code: text("code").notNull().unique(), // cth. "AIJ"
  name: text("name").notNull(),
  description: text("description"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const courses = sqliteTable("courses", {
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

export const courseEnrollments = sqliteTable("course_enrollments", {
  id: id(),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  enrolledAt: integer("enrolled_at", { mode: "timestamp_ms" }).notNull(),
});

/** Keanggotaan siswa pada kelas (melalui kode gabung). */
export const classMemberships = sqliteTable("class_memberships", {
  id: id(),
  classId: text("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull(),
});

export const modules = sqliteTable("modules", {
  id: id(),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const lessons = sqliteTable("lessons", {
  id: id(),
  moduleId: text("module_id").notNull().references(() => modules.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  contentType: text("content_type", {
    enum: ["article", "video", "pdf", "lab", "external"],
  }).notNull().default("article"),
  body: text("body"),
  position: integer("position").notNull().default(0),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const lessonProgress = sqliteTable("lesson_progress", {
  id: id(),
  lessonId: text("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["started", "completed"] }).notNull().default("started"),
  updatedAt: updatedAt(),
});

export const announcements = sqliteTable("announcements", {
  id: id(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  scope: text("scope", { enum: ["school", "course"] }).notNull().default("school"),
  courseId: text("course_id").references(() => courses.id, { onDelete: "cascade" }),
  authorId: text("author_id").references(() => users.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: id(),
  actorId: text("actor_id").references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  metadata: text("metadata"),
  createdAt: createdAt(),
});

export const notifications = sqliteTable("notifications", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body"),
  kind: text("kind", { enum: ["info", "deadline", "grade", "submission"] }).notNull().default("info"),
  readAt: integer("read_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

export const competencies = sqliteTable("competencies", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const courseCompetencies = sqliteTable("course_competencies", {
  id: id(),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  competencyId: text("competency_id").notNull().references(() => competencies.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type Role = User["role"];
