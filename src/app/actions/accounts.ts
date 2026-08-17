"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { AccountSchema, PayInvoiceSchema, ScheduleInvoiceSchema } from "@/lib/validation/accounts";
import { invoiceLabel, nextInvoiceDueDates } from "@/lib/card-invoices";
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

// Settles a credit card's invoice. The card side is a direct balance
// adjustment with no Transaction record — same as manually editing the
// balance field — rather than a "type: income" row, which would otherwise
// wrongly inflate the dashboard's income total (it aggregates every
// income-type transaction; paying down a debt isn't income). The optional
// source account, if given, gets a real expense Transaction instead: money
// genuinely left that account, which does belong in its history/budgets.
export async function payCardInvoice(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();
  const accountId = formData.get("accountId");
  if (typeof accountId !== "string") return { message: "Conta inválida." };

  const account = await prisma.account.findFirst({ where: { id: accountId, userId, type: "credit_card" } });
  if (!account) return { message: "Cartão não encontrado." };
  if (account.pluggyItemId) {
    return { message: "Contas conectadas via Open Finance já sincronizam automaticamente." };
  }

  const validated = PayInvoiceSchema.safeParse({
    amount: formData.get("amount"),
    sourceAccountId: formData.get("sourceAccountId"),
  });
  if (!validated.success) return { errors: validated.error.flatten().fieldErrors };
  const { amount, sourceAccountId } = validated.data;

  let sourceAccount = null;
  if (sourceAccountId) {
    sourceAccount = await prisma.account.findFirst({
      where: { id: sourceAccountId, userId, type: { not: "credit_card" } },
    });
    if (!sourceAccount) return { errors: { sourceAccountId: ["Conta de origem inválida."] } };
    if (sourceAccount.pluggyItemId) {
      return { errors: { sourceAccountId: ["Contas conectadas via Open Finance são somente leitura."] } };
    }
  }

  // A future invoice the user already scheduled for this card is this same
  // payment, written down ahead of time. Settling that row instead of
  // creating a second one is what keeps "programar faturas futuras" and
  // this button from booking the payment twice — the scheduled bill would
  // otherwise sit there pending forever while a duplicate expense appeared
  // next to it.
  //
  // Nearest due date first, so paying in a month with two scheduled
  // invoices clears the one that is actually due.
  const scheduled = sourceAccount
    ? await prisma.transaction.findFirst({
        where: {
          userId,
          accountId: sourceAccount.id,
          invoiceForAccountId: accountId,
          balanceApplied: false,
        },
        orderBy: { date: "asc" },
      })
    : null;

  await prisma.$transaction([
    prisma.account.update({ where: { id: accountId }, data: { balance: { increment: amount } } }),
    ...(sourceAccount
      ? [
          prisma.account.update({
            where: { id: sourceAccount.id },
            data: { balance: { decrement: amount } },
          }),
          scheduled
            ? // The amount actually paid replaces the estimate — that is the
              // whole point of an estimate — and the date becomes today,
              // since this is the moment the money moved.
              prisma.transaction.update({
                where: { id: scheduled.id },
                data: { amount, date: new Date(), balanceApplied: true },
              })
            : prisma.transaction.create({
                data: {
                  userId,
                  accountId: sourceAccount.id,
                  description: `Pagamento da fatura — ${account.name}`,
                  amount,
                  date: new Date(),
                  type: "expense",
                  balanceApplied: true,
                  invoiceForAccountId: accountId,
                },
              }),
        ]
      : []),
  ]);

  revalidateAccountPages();
  revalidatePath("/budgets");
  return { success: true };
}

// Puts a card's next invoices on the calendar as previsto, so the month's
// biggest bill stops being the one thing the forecast doesn't know about.
//
// The rows are expenses on the account that will PAY the invoice, never on
// the card: a card's invoice is not a purchase, and booking it against the
// card would inflate the exact debt it settles. They carry
// invoiceForAccountId so payCardInvoice can recognise and settle them
// instead of writing a duplicate.
export async function scheduleCardInvoices(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();
  const accountId = formData.get("accountId");
  if (typeof accountId !== "string") return { message: "Cartão inválido." };

  const card = await prisma.account.findFirst({
    where: { id: accountId, userId, type: "credit_card" },
  });
  if (!card) return { message: "Cartão não encontrado." };

  const validated = ScheduleInvoiceSchema.safeParse({
    amount: formData.get("amount"),
    months: formData.get("months"),
    sourceAccountId: formData.get("sourceAccountId"),
    dueDay: formData.get("dueDay"),
  });
  if (!validated.success) return { errors: validated.error.flatten().fieldErrors };
  const { amount, months, sourceAccountId, dueDay } = validated.data;

  const sourceAccount = await prisma.account.findFirst({
    where: { id: sourceAccountId, userId, type: { not: "credit_card" } },
  });
  if (!sourceAccount) return { errors: { sourceAccountId: ["Conta de origem inválida."] } };
  if (sourceAccount.pluggyItemId) {
    return { errors: { sourceAccountId: ["Contas conectadas via Open Finance são somente leitura."] } };
  }

  const dueDates = nextInvoiceDueDates(dueDay, months);

  // Scheduling the same months twice is a double-click or a second visit to
  // a form the user forgot they had filled — not an instruction to bill
  // themselves twice. Existing pending invoices for these dates are updated
  // to the new estimate; only the genuinely new months are created.
  const existing = await prisma.transaction.findMany({
    where: {
      userId,
      invoiceForAccountId: accountId,
      balanceApplied: false,
      date: { in: dueDates },
    },
    select: { id: true, date: true },
  });
  const existingByTime = new Map(existing.map((t) => [t.date.getTime(), t.id]));

  const toCreate = dueDates.filter((d) => !existingByTime.has(d.getTime()));
  const toUpdate = [...existingByTime.values()];

  await prisma.$transaction([
    ...(toUpdate.length > 0
      ? [
          prisma.transaction.updateMany({
            where: { id: { in: toUpdate }, userId },
            data: { amount, accountId: sourceAccount.id },
          }),
        ]
      : []),
    ...(toCreate.length > 0
      ? [
          prisma.transaction.createMany({
            data: toCreate.map((date) => ({
              userId,
              accountId: sourceAccount.id,
              description: invoiceLabel(card.name, date),
              amount,
              date,
              type: "expense",
              // Previsto by definition: the whole point is a bill that has
              // not been paid yet. It only touches the balance when the user
              // confirms it, exactly like every other scheduled entry.
              balanceApplied: false,
              invoiceForAccountId: accountId,
            })),
          }),
        ]
      : []),
  ]);

  revalidateAccountPages();
  revalidatePath("/budgets");
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
