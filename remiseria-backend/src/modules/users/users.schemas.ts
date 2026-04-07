import { z } from "zod";

export const createUserSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  apellido: z.string().min(1, "Apellido requerido"),
  telefono: z.string().min(1, "Teléfono requerido"),
  email: z.email("Email inválido").optional(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  rol: z.enum(["ADMIN", "OPERATOR", "DRIVER"]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;