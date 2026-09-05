import * as z from "zod";
import { FREQUENCIES, MAX_INSTALLMENTS } from "@/lib/recurrence";

// Maximum monetary value to prevent accidental huge entries (R$ 10 million)
const MAX_AMOUNT = 10000000;

// Checkboxes and hidden inputs both arrive as strings; z.coerce.boolean()
// is useless here because Boolean("false") is true in plain JS, which would
// silently flip every "false" the form sends.
const booleanField = (fallback: boolean) =>
  z
    .string()
    .nullish()
    .transform((v) =>
      v === null || v === undefined || v === "" ? fallback : v === "true" || v === "on"
    );

export const FinancingSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, { error: "Informe uma descrição." })
    .max(120, { error: "Descrição muito longa." }),
  // A receita fixa (salário) and a gasto fixo are the same schedule with
  // opposite signs — see Financing.type.
  type: z
    .enum(["expense", "income"], { error: "Selecione se é uma entrada ou uma saída." })
    .default("expense"),
  accountId: z.string().min(1, { error: "Selecione uma conta." }),
  categoryId: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
  firstDueDate: z.coerce.date({ error: "Informe a data do primeiro pagamento." }),
  installmentCount: z.coerce
    .number({ error: "Informe a quantidade de parcelas." })
    .int({ error: "A quantidade de parcelas deve ser um número inteiro." })
    .min(1, { error: "Informe pelo menos 1 parcela." })
    .max(MAX_INSTALLMENTS, { error: "Quantidade de parcelas muito alta." }),
  // Absent (older form payload) means the only thing this could have been
  // before frequencies existed: monthly.
  frequency: z
    .enum(FREQUENCIES, { error: "Selecione com que frequência se repete." })
    .default("monthly"),
  installmentAmount: z.coerce
    .number({ error: "Informe o valor da parcela." })
    .positive({ error: "O valor da parcela deve ser maior que zero." })
    .max(MAX_AMOUNT, {
      error: `Valor máximo permitido é R$ ${MAX_AMOUNT.toLocaleString("pt-BR")}.`,
    }),
  isRecurring: booleanField(false),
  autoSettle: booleanField(true),
});

// "Editar esta e as próximas" — the scope every recurring-entry app offers.
// Only occurrences that haven't been paid yet are rewritten, so history is
// never retroactively altered and no balance needs recomputing.
export const UpdateFinancingSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, { error: "Informe uma descrição." })
    .max(120, { error: "Descrição muito longa." }),
  categoryId: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
  installmentAmount: z.coerce
    .number({ error: "Informe o valor." })
    .positive({ error: "O valor deve ser maior que zero." })
    .max(MAX_AMOUNT, {
      error: `Valor máximo permitido é R$ ${MAX_AMOUNT.toLocaleString("pt-BR")}.`,
    }),
  frequency: z
    .enum(FREQUENCIES, { error: "Selecione com que frequência se repete." })
    .default("monthly"),
  // The date the *next* unpaid occurrence should land on; the ones after it
  // are re-spaced from there. Optional — leaving it alone keeps the dates
  // exactly as they are, which is what editing only the amount should do.
  nextDate: z.coerce
    .date({ error: "Informe uma data válida." })
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
  autoSettle: booleanField(true),
});

export const PayInstallmentSchema = z.object({
  transactionId: z.string().min(1, { error: "Parcela inválida." }),
  paidAmount: z.coerce
    .number({ error: "Informe um valor válido." })
    .positive({ error: "O valor deve ser maior que zero." })
    .max(MAX_AMOUNT, {
      error: `Valor máximo permitido é R$ ${MAX_AMOUNT.toLocaleString("pt-BR")}.`,
    }),
  // Lets the user record that the bill was actually paid on a different day
  // than it was due (paguei o aluguel com 3 dias de atraso).
  paidDate: z.coerce.date({ error: "Informe uma data válida." }).optional(),
});
