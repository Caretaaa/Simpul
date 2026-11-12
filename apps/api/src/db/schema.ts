import * as pgSchema from "./schema-pg.js";
import * as sqliteSchema from "./schema-sqlite.js";

/**
 * Selector dialek runtime: seluruh modul (routes/seed/middleware) mengimpor
 * tabel dari file ini, dan mendapatkan objek tabel yang COCOK dengan koneksi
 * aktif — pg tables saat DATABASE_URL postgres, sqlite tables selain itu.
 * Nama properti, nama tabel, dan nama kolom identik antar kedua skema.
 *
 * Tipe dianotasi ke sqlite table agar kode pemanggil tetap terketik seperti
 * sebelumnya; pada saat runtime objeknya adalah tabel pg bila perlu.
 * `$inferSelect`/`$inferInsert` ada di kedua dialek sehingga tipe tetap akurat.
 */
const isPg = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");
const S = isPg ? pgSchema : sqliteSchema;

export const users = S.users as unknown as typeof sqliteSchema.users;
export const userSessions = S.userSessions as unknown as typeof sqliteSchema.userSessions;
export const academicYears = S.academicYears as unknown as typeof sqliteSchema.academicYears;
export const classes = S.classes as unknown as typeof sqliteSchema.classes;
export const subjects = S.subjects as unknown as typeof sqliteSchema.subjects;
export const courses = S.courses as unknown as typeof sqliteSchema.courses;
export const courseEnrollments = S.courseEnrollments as unknown as typeof sqliteSchema.courseEnrollments;
export const classMemberships = S.classMemberships as unknown as typeof sqliteSchema.classMemberships;
export const modules = S.modules as unknown as typeof sqliteSchema.modules;
export const lessons = S.lessons as unknown as typeof sqliteSchema.lessons;
export const lessonProgress = S.lessonProgress as unknown as typeof sqliteSchema.lessonProgress;
export const announcements = S.announcements as unknown as typeof sqliteSchema.announcements;
export const auditLogs = S.auditLogs as unknown as typeof sqliteSchema.auditLogs;
export const notifications = S.notifications as unknown as typeof sqliteSchema.notifications;
export const competencies = S.competencies as unknown as typeof sqliteSchema.competencies;
export const courseCompetencies = S.courseCompetencies as unknown as typeof sqliteSchema.courseCompetencies;
export const passwordResetTokens = S.passwordResetTokens as unknown as typeof sqliteSchema.passwordResetTokens;

export type User = typeof users.$inferSelect;
export type Role = User["role"];
