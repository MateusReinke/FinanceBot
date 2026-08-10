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
    paid: formData.get("paid"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const id = formData.get("id");
  const { paid, ...data } = validatedFields.data;

  const account = await prisma.account.findFirst({ where: { id: data.accountId, userId } });
  if (!account) return { errors: { accountId: ["Conta inválida."] } };

  if (data.categoryId) {
    const category = await prisma.category.findFirst({ where: { id: data.categoryId, userId } });
    if (!category) return { errors: { categoryId: ["Categoria inválida."] } };
  }

  if (typeof id === "string" && id.length > 0) {
    const existing = await prisma.transaction.findFirst({ where: { id, userId } });
    if (!existing) return { message: "Transação não encontrada." };

    // Reverse whatever balance effect this row currently has, then apply
    // whatever it should have after the edit. Writing both sides from the
    // stored flags (instead of assuming the row was applied) is what lets a
    // pending transaction be edited freely, and lets an edit flip it
    // between previsto and realizado in one step.
    //
    // A financing installment is deliberately excluded from flipping: its
    // paid/pending state belongs to the schedule and is driven by
    // reconcileDueInstallments / payInstallmentNow, never by a plain edit.
    const nextApplied = existing.financingId ? existing.balanceApplied : paid;
    await prisma.$transaction([
      ...(existing.balanceApplied
        ? [
            prisma.account.update({
              where: { id: existing.accountId },
              data: { balance: { increment: -signedAmount(existing.amount, existing.type) } },
            }),
          ]
        : []),
      ...(nextApplied
        ? [
            prisma.account.update({
              where: { id: data.accountId },
              data: { balance: { increment: signedAmount(data.amount, data.type) } },
            }),
          ]
        : []),
      prisma.transaction.update({ where: { id }, data: { ...data, balanceApplied: nextApplied } }),
    ]);
  } else {
    // A transaction created as "ainda não paguei" is scheduled, not
    // realized: it shows up in previsto and in Próximos vencimentos, and
    // only touches the balance when confirmed.
    await prisma.$transaction([
      prisma.transaction.create({ data: { ...data, userId, balanceApplied: paid } }),
      ...(paid
        ? [
            prisma.account.update({
              where: { id: data.accountId },
              data: { balance: { increment: signedAmount(data.amount, data.type) } },
            }),
          ]
        : []),
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

// Marks a scheduled transaction as actually paid/received, moving the
// balance once. The balanceApplied: false in the filter makes it idempotent
// under a double submit — the second call matches nothing and stops.
export async function confirmTransaction(formData: FormData) {
  const { userId } = await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const existing = await prisma.transaction.findFirst({
    where: { id, userId, balanceApplied: false },
  });
  if (!existing) return;

  await prisma.$transaction([
    prisma.transaction.update({ where: { id }, data: { balanceApplied: true } }),
    prisma.account.update({
      where: { id: existing.accountId },
      data: { balance: { increment: signedAmount(existing.amount, existing.type) } },
    }),
  ]);

  revalidateTransactionPages();
}
