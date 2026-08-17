import * as z from "zod";
import { ACCOUNT_TYPE_VALUES } from "@/lib/account-types";

const dayOfMonth = z.coerce
  .number()
  .int({ error: "Informe um dia válido." })
  .min(1, { error: "O dia deve ser entre 1 e 31." })
  .max(31, { error: "O dia deve ser entre 1 e 31." })
  .optional();

export const PayInvoiceSchema = z.object({
  amount: z.coerce
    .number({ error: "Informe um valor válido." })
    .positive({ error: "O valor deve ser maior que zero." }),
  sourceAccountId: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
});

// Scheduling the next N invoices of a card as previsto. `months` is capped
// at 12 because beyond a year an estimated invoice is a guess dressed up as
// a bill, and the forecast is worse for having it.
export const ScheduleInvoiceSchema = z.object({
  amount: z.coerce
    .number({ error: "Informe um valor válido." })
    .positive({ error: "O valor deve ser maior que zero." }),
  months: z.coerce
    .number({ error: "Informe quantos meses." })
    .int()
    .min(1, { error: "Programe pelo menos 1 fatura." })
    .max(12, { error: "No máximo 12 faturas de uma vez." }),
  sourceAccountId: z.string().min(1, { error: "Escolha a conta que vai pagar." }),
  // Overrides the card's dueDay for this scheduling run, and is required
  // when the card has no dueDay saved.
  dueDay: z.coerce
    .number({ error: "Informe o dia do vencimento." })
    .int()
    .min(1, { error: "O dia deve ser entre 1 e 31." })
    .max(31, { error: "O dia deve ser entre 1 e 31." }),
});

export const AccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Informe um nome." })
    .max(40, { error: "Nome muito longo." }),
  type: z.enum(ACCOUNT_TYPE_VALUES, { error: "Tipo inválido." }),
  balance: z.coerce.number({ error: "Informe um valor válido." }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "Escolha uma cor." }),
  // Only persisted for type: "credit_card" — the action clears these to
  // null for every other type regardless of what the form sends.
  creditLimit: z.coerce
    .number({ error: "Informe um limite válido." })
    .nonnegative({ error: "O limite não pode ser negativo." })
    .optional(),
  closingDay: dayOfMonth,
  dueDay: dayOfMonth,
});
