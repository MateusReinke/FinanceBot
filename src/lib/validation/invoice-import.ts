import * as z from "zod";

// Same ceiling every other money field in the app enforces (see
// lib/validation/transactions.ts) — an AI-extracted, user-editable value
// is no less able to corrupt Account.balance than one typed by hand.
const MAX_AMOUNT = 10000000;
const maxAmountError = `Valor máximo permitido é R$ ${MAX_AMOUNT.toLocaleString("pt-BR")}.`;

// installmentCurrent/Total are trusted loosely here (an inconsistent pair
// just falls back to a plain transaction in the action) — this mirrors the
// rest of the app's defensive parsing rather than hard-failing the whole
// import over one bad row the user could otherwise just uncheck.
const InvoiceItemSchema = z.object({
  description: z.string().trim().min(1, { error: "Descrição obrigatória." }).max(120),
  amount: z.coerce
    .number({ error: "Valor inválido." })
    .positive({ error: "O valor deve ser maior que zero." })
    .max(MAX_AMOUNT, { error: maxAmountError }),
  date: z.coerce.date({ error: "Data inválida." }),
  categoryId: z.string().optional(),
  installmentCurrent: z.coerce.number().int().min(1).optional(),
  installmentTotal: z.coerce.number().int().min(1).optional(),
});

export const ConfirmInvoiceImportSchema = z.object({
  accountId: z.string().min(1, { error: "Conta inválida." }),
  referenceMonth: z.coerce.number().int().min(1).max(12),
  referenceYear: z.coerce.number().int().min(2000).max(2100),
  totalAmount: z.coerce
    .number({ error: "Informe o valor total da fatura." })
    .positive({ error: "O valor total deve ser maior que zero." })
    .max(MAX_AMOUNT, { error: maxAmountError }),
  items: z.array(InvoiceItemSchema).min(1, { error: "Nenhum lançamento para importar." }).max(300),
});
