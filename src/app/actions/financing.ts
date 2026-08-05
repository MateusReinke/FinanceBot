"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { FinancingSchema, UpdateFinancingDescriptionSchema, PayInstallmentSchema } from "@/lib/validation/financing";
import { buildInstallmentSchedule } from "@/lib/financing";
import type { FormState } from "@/lib/form-state";

function revalidateFinancingPages() {
  revalidatePath("/financings");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
}

export async function createFinancing(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();

  const validatedFields = FinancingSchema.safeParse({
    description: formData.get("description"),
    accountId: formData.get("accountId"),
    categoryId: formData.get("categoryId"),
    firstDueDate: formData.get("firstDueDate"),
    installmentCount: formData.get("installmentCount"),
    installmentAmount: formData.get("installmentAmount"),
  });
  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }
  const data = validatedFields.data;

  const account = await prisma.account.findFirst({ where: { id: data.accountId, userId } });
  if (!account) return { errors: { accountId: ["Conta inválida."] } };
  if (account.pluggyItemId) {
    return {
      errors: { accountId: ["Contas conectadas via Open Finance têm o saldo controlado pela sincronização e não podem receber um financiamento manual."] },
    };
  }

  if (data.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, userId, type: "expense" },
    });
    if (!category) return { errors: { categoryId: ["Categoria inválida."] } };
  }

  const schedule = buildInstallmentSchedule(data.firstDueDate, data.installmentCount, data.installmentAmount);
  const alreadyDueTotal = schedule
    .filter((s) => s.balanceApplied)
    .reduce((sum, s) => sum + s.amount, 0);

  const [financing] = await prisma.$transaction([
    prisma.financing.create({
      data: {
        userId,
        accountId: data.accountId,
        categoryId: data.categoryId,
        description: data.description,
        installmentAmount: data.installmentAmount,
        installmentCount: data.installmentCount,
        firstDueDate: data.firstDueDate,
        installments: {
          create: schedule.map((s) => ({
            userId,
            accountId: data.accountId,
            categoryId: data.categoryId,
            description: `Parcela ${s.installmentNumber}/${data.installmentCount} — ${data.description}`,
            amount: s.amount,
            date: s.date,
            type: "expense",
            installmentNumber: s.installmentNumber,
            balanceApplied: s.balanceApplied,
          })),
        },
      },
    }),
    ...(alreadyDueTotal > 0
      ? [
          prisma.account.update({
            where: { id: data.accountId },
            data: { balance: { decrement: alreadyDueTotal } },
          }),
        ]
      : []),
  ]);

  revalidateFinancingPages();
  redirect(`/financings/${financing.id}`);
}

export async function updateFinancingDescription(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return { message: "Financiamento inválido." };

  const financing = await prisma.financing.findFirst({ where: { id, userId } });
  if (!financing) return { message: "Financiamento não encontrado." };

  const validatedFields = UpdateFinancingDescriptionSchema.safeParse({
    description: formData.get("description"),
  });
  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  await prisma.financing.update({
    where: { id },
    data: { description: validatedFields.data.description },
  });

  revalidateFinancingPages();
  return { success: true };
}

// Lets an installment that hasn't come due yet be settled early for a
// custom amount (e.g. an amortized/discounted payoff) instead of waiting
// for reconcileDueInstallments to apply it at the full scheduled amount.
// The gap between financing.installmentAmount and what was actually paid
// is the "economia" shown in the UI — no separate savings field needed.
export async function payInstallmentNow(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();
  const financingId = formData.get("financingId");
  if (typeof financingId !== "string") return { message: "Financiamento inválido." };

  const financing = await prisma.financing.findFirst({ where: { id: financingId, userId } });
  if (!financing) return { message: "Financiamento não encontrado." };

  const validatedFields = PayInstallmentSchema.safeParse({
    transactionId: formData.get("transactionId"),
    paidAmount: formData.get("paidAmount"),
  });
  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }
  const { transactionId, paidAmount } = validatedFields.data;

  const installment = await prisma.transaction.findFirst({
    where: { id: transactionId, financingId, balanceApplied: false },
  });
  if (!installment) return { message: "Parcela não encontrada ou já paga." };

  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: transactionId },
      data: { amount: paidAmount, balanceApplied: true },
    }),
    prisma.account.update({
      where: { id: installment.accountId },
      data: { balance: { decrement: paidAmount } },
    }),
  ]);

  revalidateFinancingPages();
  return { success: true };
}

// Removes only the installments that haven't come due yet, keeping past
// (already-applied) ones as history. Safe with no balance reversal — an
// unapplied installment never touched Account.balance in the first place.
export async function settleFinancingEarly(formData: FormData) {
  const { userId } = await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const financing = await prisma.financing.findFirst({ where: { id, userId } });
  if (!financing) return;

  await prisma.transaction.deleteMany({ where: { financingId: id, balanceApplied: false } });

  revalidateFinancingPages();
}

export async function deleteFinancing(formData: FormData) {
  const { userId } = await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const financing = await prisma.financing.findFirst({ where: { id, userId } });
  if (!financing) return;

  const appliedAgg = await prisma.transaction.aggregate({
    where: { financingId: id, balanceApplied: true },
    _sum: { amount: true },
  });
  const toReverse = appliedAgg._sum.amount ?? 0;

  await prisma.$transaction([
    ...(toReverse > 0
      ? [
          prisma.account.update({
            where: { id: financing.accountId },
            data: { balance: { increment: toReverse } },
          }),
        ]
      : []),
    // Cascades (onDelete: Cascade on Transaction.financing) to remove every
    // linked installment, applied and unapplied alike.
    prisma.financing.delete({ where: { id } }),
  ]);

  revalidateFinancingPages();
  redirect("/financings");
}
