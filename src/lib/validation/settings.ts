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
    // Optional at the schema level because an account that signs in with
    // Google has no current password to give. changePassword still demands
    // it whenever one is actually set.
    currentPassword: z.string().optional().default(""),
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
