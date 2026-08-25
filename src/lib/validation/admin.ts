import * as z from "zod";

const passwordField = z
  .string()
  .min(8, { error: "A senha deve ter pelo menos 8 caracteres." })
  .regex(/[a-zA-Z]/, { error: "A senha deve conter pelo menos uma letra." })
  .regex(/[0-9]/, { error: "A senha deve conter pelo menos um número." });

export const AdminCreateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Informe o nome completo." })
    .max(80, { error: "Nome muito longo." }),
  email: z.email({ error: "Informe um e-mail válido." }).trim().toLowerCase(),
  password: passwordField,
  role: z.enum(["user", "admin"], { error: "Papel inválido." }),
});

export const AdminUpdateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Informe o nome completo." })
    .max(80, { error: "Nome muito longo." }),
  email: z.email({ error: "Informe um e-mail válido." }).trim().toLowerCase(),
  role: z.enum(["user", "admin"], { error: "Papel inválido." }),
});

export const AdminResetPasswordSchema = z.object({
  password: passwordField,
});
