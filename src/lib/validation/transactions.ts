import * as z from "zod";
import { optionalPhoneField } from "@/lib/phone";

// Maximum monetary value to prevent accidental huge entries (R$ 10 million)
const MAX_AMOUNT = 10000000;

export const TransactionSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, { error: "Informe uma descrição." })
    .max(120, { error: "Descrição muito longa." }),
  amount: z.coerce
    .number({ error: "Informe um valor válido." })
    .positive({ error: "O valor deve ser maior que zero." })
    .max(MAX_AMOUNT, { error: `Valor máximo permitido é R$ ${MAX_AMOUNT.toLocaleString("pt-BR")}.` }),
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
  // Who owes it / who it is owed to. Absent on most entries; only filled
  // when the user is tracking a person, which is what puts the row on the
  // "A receber" screen with a name on it.
  counterparty: z
    .string()
    .trim()
    .max(80, { error: "Nome muito longo." })
    .optional()
    .transform((v) => (v ? v : undefined)),
  // Reuses the app's one phone rule, so a number typed here normalizes
  // exactly like one typed at signup. Empty stays empty rather than failing:
  // knowing that João owes you R$50 is useful even without his number.
  counterpartyPhone: optionalPhoneField.optional().transform((v) => v ?? undefined),
});

// "Recebi só uma parte" — the amount that actually came in, checked against
// what is still open by the action itself (the schema has no way to know the
// row's remaining value). Kept separate from TransactionSchema because a
// partial settlement decides nothing else about the row: not the date, not
// the category, not who owes it — all of that is inherited from the entry
// being settled.
export const PartialSettlementSchema = z.object({
  amount: z.coerce
    .number({ error: "Informe um valor válido." })
    .positive({ error: "O valor recebido deve ser maior que zero." }),
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
