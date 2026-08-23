import * as z from "zod";
import { ICON_OPTIONS } from "@/lib/icon-registry";

export const CategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Informe um nome." })
    .max(40, { error: "Nome muito longo." }),
  type: z.enum(["income", "expense"], { error: "Tipo inválido." }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "Escolha uma cor." }),
  icon: z.enum(ICON_OPTIONS as [string, ...string[]], { error: "Escolha um ícone." }),
});
