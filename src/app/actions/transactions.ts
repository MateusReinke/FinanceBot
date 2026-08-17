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
  // Confirming or editing an income is exactly what removes it from (or
  // adds it to) the a-receber list, so that page has to be invalidated by
  // the same actions.
  revalidatePath("/receivables");
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
    counterparty: formData.get("counterparty"),
    counterpartyPhone: formData.get("counterpartyPhone"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const id = formData.get("id");
  const { paid, counterparty, counterpartyPhone, ...rest } = validatedFields.data;
  // Written as explicit nulls rather than left undefined: clearing the "de
  // quem" field has to actually clear it, and Prisma reads undefined as
  // "leave this column alone".
  const data = {
    ...rest,
    counterparty: counterparty ?? null,
    counterpartyPhone: counterpartyPhone ?? null,
  };

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

// The exact inverse of confirmTransaction: puts a row back to previsto and
// takes its effect out of the balance. Marking something paid is a
// one-click action sitting next to a delete button, so it needs a one-click
// way back — before this, undoing a mis-click meant opening the edit form
// and knowing that the paid/pending switch was what to change.
//
// balanceApplied: true in the filter makes it idempotent under a double
// submit, mirroring the guard on the way in.
//
// A financing installment is excluded for the same reason a plain edit
// can't flip one: its state belongs to the schedule, and un-applying an
// occurrence that reconcileDueInstallments considers due would just be
// re-applied on the next request, silently undoing the undo.
export async function unconfirmTransaction(formData: FormData) {
  const { userId } = await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const existing = await prisma.transaction.findFirst({
    where: { id, userId, balanceApplied: true, financingId: null },
  });
  if (!existing) return;

  await prisma.$transaction([
    prisma.transaction.update({ where: { id }, data: { balanceApplied: false } }),
    prisma.account.update({
      where: { id: existing.accountId },
      data: { balance: { increment: -signedAmount(existing.amount, existing.type) } },
    }),
  ]);

  revalidateTransactionPages();
}

// Records that the user sent a charge for this entry. Touches nothing about
// the money — it exists so the list can say "cobrado hoje" and stop the
// same person being messaged three times in an afternoon.
export async function markAsCharged(formData: FormData) {
  const { userId } = await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  // updateMany, not update: it scopes the write to this user's own row, so
  // an id from somewhere else matches nothing instead of throwing.
  await prisma.transaction.updateMany({
    where: { id, userId, balanceApplied: false },
    data: { chargedAt: new Date() },
  });

  revalidatePath("/receivables");
}

// Same, for a whole person at once — the "cobrar tudo" button on a group
// that owes several things.
export async function markCounterpartyAsCharged(formData: FormData) {
  const { userId } = await verifySession();
  const ids = formData.getAll("ids").filter((v): v is string => typeof v === "string");
  if (ids.length === 0) return;

  await prisma.transaction.updateMany({
    where: { id: { in: ids }, userId, balanceApplied: false },
    data: { chargedAt: new Date() },
  });

  revalidatePath("/receivables");
}
