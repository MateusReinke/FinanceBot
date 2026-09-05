import * as z from "zod";

// Maximum monetary value to prevent accidental huge entries (R$ 10 million)
const MAX_AMOUNT = 10000000;

export const BudgetSchema = z.object({
  categoryId: z.string().min(1, { error: "Selecione uma categoria." }),
  amount: z.coerce
    .number({ error: "Informe um valor válido." })
    .positive({ error: "O valor deve ser maior que zero." })
    .max(MAX_AMOUNT, {
      error: `Valor máximo permitido é R$ ${MAX_AMOUNT.toLocaleString("pt-BR")}.`,
    }),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});
