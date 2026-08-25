import * as z from "zod";
import { phoneField } from "@/lib/phone";

export const SignupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Informe seu nome completo." })
    .max(80, { error: "Nome muito longo." }),
  email: z.email({ error: "Informe um e-mail válido." }).trim().toLowerCase(),
  // Required at signup: it is what lets the WhatsApp side reach this person
  // — both for their own lançamentos and to be added to an event's group.
  phoneNumber: phoneField,
  password: z
    .string()
    .min(8, { error: "A senha deve ter pelo menos 8 caracteres." })
    .regex(/[a-zA-Z]/, { error: "A senha deve conter pelo menos uma letra." })
    .regex(/[0-9]/, { error: "A senha deve conter pelo menos um número." }),
});

export const LoginSchema = z.object({
  email: z.email({ error: "Informe um e-mail válido." }).trim().toLowerCase(),
  password: z.string().min(1, { error: "Informe sua senha." }),
});
