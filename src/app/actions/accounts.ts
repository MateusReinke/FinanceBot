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

export async function upsertAccount(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();

  const validatedFields = AccountSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    balance: formData.get("balance"),
    color: formData.get("color"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const id = formData.get("id");
  const data = validatedFields.data;

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
