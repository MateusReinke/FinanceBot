import * as z from "zod";

export const FinancingSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, { error: "Informe uma descrição." })
    .max(120, { error: "Descrição muito longa." }),
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
    .max(600, { error: "Quantidade de parcelas muito alta." }),
  installmentAmount: z.coerce
    .number({ error: "Informe o valor da parcela." })
    .positive({ error: "O valor da parcela deve ser maior que zero." }),
});

export const UpdateFinancingDescriptionSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, { error: "Informe uma descrição." })
    .max(120, { error: "Descrição muito longa." }),
});

export const PayInstallmentSchema = z.object({
  transactionId: z.string().min(1, { error: "Parcela inválida." }),
  paidAmount: z.coerce
    .number({ error: "Informe um valor válido." })
    .positive({ error: "O valor deve ser maior que zero." }),
});
