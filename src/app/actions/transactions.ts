"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { PartialSettlementSchema, TransactionSchema } from "@/lib/validation/transactions";
import { signedAmount, formatCurrency } from "@/lib/utils";
import { startOfTodayUTC } from "@/lib/transaction-status";
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
      prisma.transaction.update({
        where: { id },
        // Editing a row to "já paguei" is the same statement as pressing
        // Paguei, so it lifts the manual override too — otherwise a row
        // could sit confirmed while still carrying a stale "não paguei".
        data: {
          ...data,
          balanceApplied: nextApplied,
          ...(nextApplied ? { unsettledAt: null } : {}),
        },
      }),
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

  // Deleting one slice of a partially received entry hands its value back to
  // the open remainder, exactly as pressing Desfazer inside the "parcial"
  // modal would. Without this the R$ 500 João paid would simply evaporate:
  // the settled row goes, the remainder stays at R$ 1.000, and a R$ 1.500
  // debt has quietly become a R$ 1.000 one.
  const parent = existing.partialOfId
    ? await prisma.transaction.findFirst({ where: { id: existing.partialOfId, userId } })
    : null;

  await prisma.$transaction([
    ...(existing.balanceApplied
      ? [
          prisma.account.update({
            where: { id: existing.accountId },
            data: { balance: { increment: -signedAmount(existing.amount, existing.type) } },
          }),
        ]
      : []),
    ...(parent
      ? [
          prisma.transaction.update({
            where: { id: parent.id },
            data: { amount: toCents(parent.amount + existing.amount) },
          }),
          // A parent that is itself already settled has the value counted in
          // the balance the moment it lands back on its amount, so the
          // reversal above has to be put back.
          ...(parent.balanceApplied
            ? [
                prisma.account.update({
                  where: { id: parent.accountId },
                  data: { balance: { increment: signedAmount(existing.amount, parent.type) } },
                }),
              ]
            : []),
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

  await applySettlement(existing);

  revalidateTransactionPages();
}

// Flips one pending row to realizado and moves the balance by its value.
// Shared with settlePartialAmount, which lands here whenever the "parcial"
// the user typed turns out to be the whole remainder.
function applySettlement(row: { id: string; accountId: string; amount: number; type: string }) {
  return prisma.$transaction([
    // unsettledAt is cleared here: confirming is the user taking back an
    // earlier "não paguei", so the override that was holding the automatic
    // reconciliation off must go with it.
    prisma.transaction.update({
      where: { id: row.id },
      data: { balanceApplied: true, unsettledAt: null },
    }),
    prisma.account.update({
      where: { id: row.accountId },
      data: { balance: { increment: signedAmount(row.amount, row.type) } },
    }),
  ]);
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
// Works on installments of a gasto fixo too, which is the case that needed
// it most: those are the rows people confirm by accident, and they used to
// be the only ones with no way back — the paid/pending switch is hidden in
// their edit form, so a mis-click on "Paguei" was permanent.
//
// Making that safe is what unsettledAt is for. An installment of an
// autoSettle financing whose date has passed is due, and
// reconcileDueInstallments would re-apply it on the very next request;
// stamping the override tells the reconciler the user has spoken, and it
// leaves that row alone until the row is confirmed again.
export async function unconfirmTransaction(formData: FormData) {
  const { userId } = await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const existing = await prisma.transaction.findFirst({
    where: { id, userId, balanceApplied: true },
  });
  if (!existing) return;

  await prisma.$transaction([
    prisma.transaction.update({
      where: { id },
      data: { balanceApplied: false, unsettledAt: new Date() },
    }),
    prisma.account.update({
      where: { id: existing.accountId },
      data: { balance: { increment: -signedAmount(existing.amount, existing.type) } },
    }),
  ]);

  revalidateTransactionPages();
}

// "Recebi R$ 500 dos R$ 1.500" — a partial receipt (or a partial payment;
// the mechanics are identical and only the wording differs).
//
// Deliberately written as two ordinary rows rather than a second amount
// column on this one:
//
//   - the money that arrived becomes a real settled row, linked back via
//     partialOfId, so it moves the balance and shows up in the statement
//     through exactly the same path as any other confirmation;
//   - the open row keeps only what is still owed.
//
// That is what makes "o que falta" come out right everywhere for free —
// every balance, forecast, month total and a-receber sum in the app already
// reads Transaction.amount, and none of them had to learn a new concept.
export async function settlePartialAmount(
  _state: FormState,
  formData: FormData
): Promise<FormState> {
  const { userId } = await verifySession();

  const id = formData.get("id");
  if (typeof id !== "string") return { message: "Lançamento não encontrado." };

  const validatedFields = PartialSettlementSchema.safeParse({ amount: formData.get("amount") });
  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const existing = await prisma.transaction.findFirst({
    where: { id, userId, balanceApplied: false },
  });
  if (!existing) return { message: "Este lançamento não está mais em aberto." };

  // Both sides rounded to centavos before they are compared. Without it a
  // user paying off the exact remainder of, say, R$ 0,1 + R$ 0,2 lands on
  // the float that is a hair over it and gets told the value is too high.
  const value = toCents(validatedFields.data.amount);
  const remaining = toCents(existing.amount);

  if (value > remaining) {
    return {
      errors: {
        amount: [`Falta receber apenas ${formatCurrency(remaining)}.`],
      },
    };
  }

  // Paying the whole remainder is not a partial receipt — settle the row
  // itself. Splitting here instead would leave a R$ 0,00 ghost sitting in
  // "A receber" forever, which is the opposite of what the user just said
  // happened.
  if (value === remaining) {
    await applySettlement(existing);
    revalidateTransactionPages();
    return { success: true };
  }

  await prisma.$transaction([
    prisma.transaction.create({
      data: {
        userId,
        accountId: existing.accountId,
        categoryId: existing.categoryId,
        // Same description as the entry it came from, so the statement reads
        // "Empréstimo (parcial)" next to the rest instead of a mystery row.
        description: partialDescription(existing.description),
        amount: value,
        // The day the money actually moved, not the day it was due: this row
        // is realizado, and dating it back would move it into a month that
        // has already been reported.
        date: startOfTodayUTC(),
        type: existing.type,
        notes: existing.notes,
        counterparty: existing.counterparty,
        counterpartyPhone: existing.counterpartyPhone,
        source: existing.source,
        balanceApplied: true,
        partialOfId: existing.id,
        // financingId and installmentNumber are deliberately not copied: a
        // partial receipt is not an installment of the schedule (and the
        // (financingId, installmentNumber) unique would reject it anyway).
      },
    }),
    prisma.transaction.update({
      where: { id },
      data: { amount: toCents(remaining - value) },
    }),
    prisma.account.update({
      where: { id: existing.accountId },
      data: { balance: { increment: signedAmount(value, existing.type) } },
    }),
  ]);

  revalidateTransactionPages();
  return { success: true };
}

// The way back from a partial receipt recorded by mistake: the settled part
// is removed and its value handed back to the row it came out of, so the two
// always add back up to what was originally owed.
export async function undoPartialSettlement(formData: FormData) {
  const { userId } = await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const partial = await prisma.transaction.findFirst({
    where: { id, userId, balanceApplied: true, partialOfId: { not: null } },
  });
  if (!partial?.partialOfId) return;

  const parent = await prisma.transaction.findFirst({
    where: { id: partial.partialOfId, userId },
  });
  // The remainder was deleted at some point (partialOfId is SetNull, so the
  // money stayed put and correct). There is nothing to give the value back
  // to, and deleting it here would take real income out of the balance.
  if (!parent) return;

  await prisma.$transaction([
    prisma.account.update({
      where: { id: partial.accountId },
      data: { balance: { increment: -signedAmount(partial.amount, partial.type) } },
    }),
    prisma.transaction.delete({ where: { id: partial.id } }),
    prisma.transaction.update({
      where: { id: parent.id },
      data: { amount: toCents(parent.amount + partial.amount) },
    }),
    // Handing the value back to a row that is itself already settled leaves
    // the balance where it was: the amount lands on an applied row, so the
    // reversal above has to be put back. Written as its own update on the
    // parent's own account rather than netted into one, because the two rows
    // need not sit on the same account.
    ...(parent.balanceApplied
      ? [
          prisma.account.update({
            where: { id: parent.accountId },
            data: { balance: { increment: signedAmount(partial.amount, parent.type) } },
          }),
        ]
      : []),
  ]);

  revalidateTransactionPages();
}

// Money is stored as a Float, so every arithmetic result that goes back into
// the database is snapped to centavos here. Two partial receipts of R$ 33,33
// against R$ 100 must leave exactly R$ 33,34 open, not R$ 33,340000000000003.
function toCents(value: number) {
  return Math.round(value * 100) / 100;
}

// Keeps the suffix without letting a long description grow past what the
// edit form will accept back (TransactionSchema caps it at 120).
function partialDescription(description: string) {
  const suffix = " (parcial)";
  return `${description.slice(0, 120 - suffix.length)}${suffix}`;
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
