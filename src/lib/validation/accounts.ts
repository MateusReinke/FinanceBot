import * as z from "zod";
import { ACCOUNT_TYPE_VALUES } from "@/lib/account-types";
import { INVOICE_PLAN_MONTHS } from "@/lib/card-invoices";

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

// Filling a card's future invoices, one month at a time. The form sends one
// `amount-YYYY-MM` field per month it is showing; the action collects them
// into `months` before validating.
//
// A month left blank arrives as 0, which is not an error — it means "não
// tenho fatura programada aqui", and is what erases a month the user had
// filled before. So amounts are non-negative rather than positive.
export const InvoicePlanMonthSchema = z.object({
  key: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: "Mês inválido." }),
  amount: z.coerce
    .number({ error: "Informe valores válidos." })
    .nonnegative({ error: "Os valores não podem ser negativos." }),
});

export const InvoicePlanSchema = z.object({
  sourceAccountId: z.string().min(1, { error: "Escolha a conta que vai pagar." }),
  // Overrides the card's dueDay for the invoices being saved, and is
  // required when the card has no dueDay saved.
  dueDay: z.coerce
    .number({ error: "Informe o dia do vencimento." })
    .int()
    .min(1, { error: "O dia deve ser entre 1 e 31." })
    .max(31, { error: "O dia deve ser entre 1 e 31." }),
  months: z
    .array(InvoicePlanMonthSchema)
    .min(1, { error: "Nenhum mês para salvar." })
    .max(INVOICE_PLAN_MONTHS, { error: `No máximo ${INVOICE_PLAN_MONTHS} meses de uma vez.` }),
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
