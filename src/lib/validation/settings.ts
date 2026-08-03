import * as z from "zod";

export const UpdateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Informe seu nome completo." })
    .max(80, { error: "Nome muito longo." }),
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "Informe sua senha atual." }),
    newPassword: z
      .string()
      .min(8, { error: "A nova senha deve ter pelo menos 8 caracteres." })
      .regex(/[a-zA-Z]/, { error: "A senha deve conter pelo menos uma letra." })
      .regex(/[0-9]/, { error: "A senha deve conter pelo menos um número." }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });
