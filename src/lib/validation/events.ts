import * as z from "zod";

export const EventSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Informe um nome para o evento." })
    .max(80, { error: "Nome muito longo." }),
  description: z
    .string()
    .trim()
    .max(300, { error: "Descrição muito longa." })
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export const AddExpenseSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, { error: "Informe uma descrição." })
    .max(120, { error: "Descrição muito longa." }),
  amount: z.coerce
    .number({ error: "Informe um valor válido." })
    .positive({ error: "O valor deve ser maior que zero." }),
  paidById: z.string().min(1, { error: "Selecione quem pagou." }),
  date: z.coerce.date({ error: "Informe uma data válida." }),
  splitMode: z.enum(["equal", "custom"], { error: "Selecione como dividir." }),
});
