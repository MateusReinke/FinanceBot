import * as z from "zod";
import { ACCOUNT_TYPE_VALUES } from "@/lib/account-types";

const dayOfMonth = z.coerce
  .number()
  .int({ error: "Informe um dia válido." })
  .min(1, { error: "O dia deve ser entre 1 e 31." })
  .max(31, { error: "O dia deve ser entre 1 e 31." })
  .optional();

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
