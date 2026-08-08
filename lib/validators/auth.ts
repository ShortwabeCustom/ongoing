import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Contraseña requerida"),
  rememberMe: z.boolean().optional().default(false),
});

export const RegisterSchema = z.object({
  email: z.string().email("Email inválido"),
  name: z.string().min(2, "Nombre debe tener al menos 2 caracteres"),
  password: z.string().min(8, "Contraseña debe tener al menos 8 caracteres"),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(2, "Nombre debe tener al menos 2 caracteres").optional(),
  email: z.string().email("Email inválido").optional(),
  password: z.string().min(8, "Contraseña debe tener al menos 8 caracteres").optional(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
