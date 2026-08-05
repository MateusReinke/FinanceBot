"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { AccountSchema } from "@/lib/validation/accounts";
import type { FormState } from "@/lib/form-state";

function revalidateAccountPages() {
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

// FormData.get() returns null for an absent field and "" for an emptied
// text input — neither should reach z.coerce.number(), which would turn
// them into 0 or NaN instead of "not provided."
function emptyToUndefined(value: FormDataEntryValue | null) {
  return value === null || value === "" ? undefined : value;
}

export async function upsertAccount(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();

  const validatedFields = AccountSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    balance: formData.get("balance"),
    color: formData.get("color"),
    creditLimit: emptyToUndefined(formData.get("creditLimit")),
    closingDay: emptyToUndefined(formData.get("closingDay")),
    dueDay: emptyToUndefined(formData.get("dueDay")),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const id = formData.get("id");
  const { creditLimit, closingDay, dueDay, ...rest } = validatedFields.data;
  // Never persist card-only fields for a non-card account, regardless of
  // what the form happened to send — the UI hides them, but the server
  // is what actually enforces it.
  const data =
    rest.type === "credit_card"
      ? { ...rest, creditLimit: creditLimit ?? null, closingDay: closingDay ?? null, dueDay: dueDay ?? null }
      : { ...rest, creditLimit: null, closingDay: null, dueDay: null };

  if (typeof id === "string" && id.length > 0) {
    const existing = await prisma.account.findFirst({ where: { id, userId } });
    if (!existing) return { message: "Conta não encontrada." };
    if (existing.pluggyItemId) {
      return { message: "Contas conectadas via Open Finance são somente leitura." };
    }
    await prisma.account.update({ where: { id }, data });
  } else {
    await prisma.account.create({ data: { ...data, userId } });
  }

  revalidateAccountPages();
  return { success: true };
}

export async function toggleArchiveAccount(formData: FormData) {
  const { userId } = await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const existing = await prisma.account.findFirst({ where: { id, userId } });
  if (!existing) return;

  await prisma.account.update({
    where: { id },
    data: { archived: !existing.archived },
  });
  revalidateAccountPages();
}

export async function deleteAccount(formData: FormData) {
  const { userId } = await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const existing = await prisma.account.findFirst({ where: { id, userId } });
  if (!existing || existing.pluggyItemId) return;

  await prisma.account.delete({ where: { id } });
  revalidateAccountPages();
}
