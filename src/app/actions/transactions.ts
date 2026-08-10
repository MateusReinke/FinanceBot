"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { TransactionSchema } from "@/lib/validation/transactions";
import { signedAmount } from "@/lib/utils";
import type { FormState } from "@/lib/form-state";

function revalidateTransactionPages() {
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
}

export async function upsertTransaction(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();

  const validatedFields = TransactionSchema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    type: formData.get("type"),
    accountId: formData.get("accountId"),
    categoryId: formData.get("categoryId"),
    notes: formData.get("notes"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const id = formData.get("id");
  const data = validatedFields.data;

  const account = await prisma.account.findFirst({ where: { id: data.accountId, userId } });
  if (!account) return { errors: { accountId: ["Conta inválida."] } };

  if (data.categoryId) {
    const category = await prisma.category.findFirst({ where: { id: data.categoryId, userId } });
    if (!category) return { errors: { categoryId: ["Categoria inválida."] } };
  }

  if (typeof id === "string" && id.length > 0) {
    const existing = await prisma.transaction.findFirst({ where: { id, userId } });
    if (!existing) return { message: "Transação não encontrada." };

    // Reverse the previous balance effect, then apply the new one — but only
    // if this row had already applied one. A not-yet-due financing
    // installment (balanceApplied: false) never touched the balance, and an
    // edit here doesn't change that; it's picked up normally the next time
    // reconcileDueInstallments() runs (see src/lib/dal.ts). This action never
    // changes balanceApplied itself.
    await prisma.$transaction([
      ...(existing.balanceApplied
        ? [
            prisma.account.update({
              where: { id: existing.accountId },
              data: { balance: { increment: -signedAmount(existing.amount, existing.type) } },
            }),
            prisma.account.update({
              where: { id: data.accountId },
              data: { balance: { increment: signedAmount(data.amount, data.type) } },
            }),
          ]
        : []),
      prisma.transaction.update({ where: { id }, data }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.transaction.create({ data: { ...data, userId } }),
      prisma.account.update({
        where: { id: data.accountId },
        data: { balance: { increment: signedAmount(data.amount, data.type) } },
      }),
    ]);
  }

  revalidateTransactionPages();
  return { success: true };
}

export async function deleteTransaction(formData: FormData) {
  const { userId } = await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) return;

  await prisma.$transaction([
    ...(existing.balanceApplied
      ? [
          prisma.account.update({
            where: { id: existing.accountId },
            data: { balance: { increment: -signedAmount(existing.amount, existing.type) } },
          }),
        ]
      : []),
    prisma.transaction.delete({ where: { id } }),
  ]);

  revalidateTransactionPages();
}
