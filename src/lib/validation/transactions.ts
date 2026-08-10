import * as z from "zod";

export const TransactionSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, { error: "Informe uma descrição." })
    .max(120, { error: "Descrição muito longa." }),
  amount: z.coerce
    .number({ error: "Informe um valor válido." })
    .positive({ error: "O valor deve ser maior que zero." }),
  date: z.coerce.date({ error: "Informe uma data válida." }),
  type: z.enum(["income", "expense"], { error: "Tipo inválido." }),
  accountId: z.string().min(1, { error: "Selecione uma conta." }),
  categoryId: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
  notes: z
    .string()
    .trim()
    .max(500, { error: "Nota muito longa." })
    .optional()
    .transform((v) => (v ? v : undefined)),
  // Whether the money already moved. Absent means true, so every existing
  // caller (and the API) keeps creating realized transactions by default.
  paid: z
    .string()
    .nullish()
    .transform((v) => v === null || v === undefined || v === "" || v === "true" || v === "on"),
});

export const TransactionFiltersSchema = z.object({
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  type: z.enum(["income", "expense"]).optional(),
  status: z.enum(["paid", "pending", "overdue"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
});
