import * as z from "zod";
import { ACCOUNT_TYPE_VALUES } from "@/lib/account-types";

export const AccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Informe um nome." })
    .max(40, { error: "Nome muito longo." }),
  type: z.enum(ACCOUNT_TYPE_VALUES, { error: "Tipo inválido." }),
  balance: z.coerce.number({ error: "Informe um valor válido." }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "Escolha uma cor." }),
});
