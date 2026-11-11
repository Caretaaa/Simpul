import { z } from "zod";

export const CreateUserSchema = z.object({
  email: z.string().email("Format surel tidak valid").max(160),
  name: z.string().min(3, "Nama minimal 3 karakter").max(120),
  password: z.string().min(8, "Kata sandi minimal 8 karakter").max(128),
  role: z.enum(["admin", "guru", "siswa"]),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
