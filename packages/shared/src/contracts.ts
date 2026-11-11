import { z } from "zod";

/** Peran pengguna — satu-satunya sumber kebenaran role di seluruh monorepo. */
export const RoleSchema = z.enum(["admin", "guru", "siswa"]);
export type Role = z.infer<typeof RoleSchema>;

export const LoginSchema = z.object({
  email: z.string().email("Format surel tidak valid").max(160),
  password: z.string().min(1, "Kata sandi wajib diisi").max(256),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const IdSchema = z.string().min(1).max(64);

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof PaginationSchema>;

export const CreateClassSchema = z.object({
  name: z.string().min(3, "Nama kelas minimal 3 karakter").max(120),
  grade: z.enum(["X", "XI", "XII"]),
  major: z.string().default("TKJ").pipe(z.string().max(60)),
  academicYearId: z.string().min(1),
});
export type CreateClassInput = z.infer<typeof CreateClassSchema>;

export const CreateSubjectSchema = z.object({
  code: z.string().min(2).max(24),
  name: z.string().min(3).max(160),
  description: z.string().max(2000).optional(),
});
export type CreateSubjectInput = z.infer<typeof CreateSubjectSchema>;

export const CreateCourseSchema = z.object({
  title: z.string().min(5, "Judul kursus minimal 5 karakter").max(200),
  description: z.string().max(5000).optional(),
  subjectId: z.string().min(1),
  classId: z.string().min(1),
});
export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;

/** Siswa masuk kelas dengan kode gabung 6 karakter dari guru. */
export const JoinClassSchema = z.object({
  code: z.string().min(4, "Kode kelas minimal 4 karakter").max(12),
});
export type JoinClassInput = z.infer<typeof JoinClassSchema>;

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, string[]>;
}
