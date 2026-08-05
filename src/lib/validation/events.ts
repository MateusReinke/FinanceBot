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

export const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;
export const ALLOWED_RECEIPT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const ReceiptItemSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, { error: "Informe uma descrição." })
    .max(120, { error: "Descrição muito longa." }),
  amount: z.coerce
    .number({ error: "Informe um valor válido." })
    .positive({ error: "O valor deve ser maior que zero." }),
});

export const ConfirmReceiptExpensesSchema = z.object({
  receiptId: z.string().min(1, { error: "Nota inválida." }),
  items: z
    .array(ReceiptItemSchema)
    .min(1, { error: "Adicione ao menos um item." })
    .max(50, { error: "Muitos itens de uma vez — divida em mais de uma nota." }),
  paidById: z.string().min(1, { error: "Selecione quem pagou." }),
  date: z.coerce.date({ error: "Informe uma data válida." }),
});
