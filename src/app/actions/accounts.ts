"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { Prisma } from "@prisma/client";
import { AccountSchema, InvoicePlanSchema, PayInvoiceSchema } from "@/lib/validation/accounts";
import {
  invoiceDateFor,
  invoiceLabel,
  monthBounds,
  monthKeyOf,
  parseMonthKey,
} from "@/lib/card-invoices";
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
      ? {
          ...rest,
          creditLimit: creditLimit ?? null,
          closingDay: closingDay ?? null,
          dueDay: dueDay ?? null,
        }
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

  const account = await prisma.account.findFirst({
    where: { id: accountId, userId, type: "credit_card" },
  });
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
      return {
        errors: { sourceAccountId: ["Contas conectadas via Open Finance são somente leitura."] },
      };
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

// One field per month the planner is showing. Named rather than indexed so
// the action can pick them out of a FormData that also carries React's own
// $ACTION_ entries, and so a month keeps its identity even if the list the
// form rendered was a different length.
const MONTH_FIELD = /^amount-(\d{4}-\d{2})$/;

// Fills in a card's future invoices, month by month, as previsto — so the
// month's biggest bill stops being the one thing the forecast doesn't know
// about.
//
// The planner submits every month it is showing, the empty ones included,
// which is what makes this a *plan* rather than an append: a month with a
// value is created or updated, and a month the user cleared has its
// scheduled invoice deleted. A month whose invoice is already paid is left
// completely alone — that money moved, and a plan does not get to rewrite
// history.
//
// The rows are expenses on the account that will PAY the invoice, never on
// the card: a card's invoice is not a purchase, and booking it against the
// card would inflate the exact debt it settles. They carry
// invoiceForAccountId so payCardInvoice can recognise and settle them
// instead of writing a duplicate.
export async function saveCardInvoicePlan(
  _state: FormState,
  formData: FormData
): Promise<FormState> {
  const { userId } = await verifySession();
  const accountId = formData.get("accountId");
  if (typeof accountId !== "string") return { message: "Cartão inválido." };

  const card = await prisma.account.findFirst({
    where: { id: accountId, userId, type: "credit_card" },
  });
  if (!card) return { message: "Cartão não encontrado." };

  const months: { key: string; amount: FormDataEntryValue | number }[] = [];
  for (const [field, value] of formData.entries()) {
    const match = MONTH_FIELD.exec(field);
    // An emptied field means zero here, not "not provided": a blank month is
    // how the user says that month carries no invoice.
    if (match) months.push({ key: match[1], amount: value === "" ? 0 : value });
  }

  const validated = InvoicePlanSchema.safeParse({
    sourceAccountId: formData.get("sourceAccountId"),
    dueDay: formData.get("dueDay"),
    months,
  });
  if (!validated.success) return { errors: validated.error.flatten().fieldErrors };
  const { sourceAccountId, dueDay, months: planned } = validated.data;

  const sourceAccount = await prisma.account.findFirst({
    where: { id: sourceAccountId, userId, type: { not: "credit_card" } },
  });
  if (!sourceAccount) return { errors: { sourceAccountId: ["Conta de origem inválida."] } };
  if (sourceAccount.pluggyItemId) {
    return {
      errors: { sourceAccountId: ["Contas conectadas via Open Finance são somente leitura."] },
    };
  }

  // What each month should end up being worth. A Map so a month arriving
  // twice settles on one value instead of racing itself in the writes below.
  const wanted = new Map<string, { year: number; month: number; amount: number; date: Date }>();
  for (const entry of planned) {
    const parsed = parseMonthKey(entry.key);
    if (!parsed) continue;
    wanted.set(entry.key, {
      ...parsed,
      // Money, so centavos and not floating-point dust.
      amount: Math.round(entry.amount * 100) / 100,
      date: invoiceDateFor(parsed.year, parsed.month - 1, dueDay),
    });
  }
  if (wanted.size === 0) return { message: "Nenhum mês para salvar." };

  // One read spanning every month on screen, rather than one per month.
  const keys = [...wanted.keys()].sort();
  const first = wanted.get(keys[0])!;
  const last = wanted.get(keys[keys.length - 1])!;
  const existing = await prisma.transaction.findMany({
    where: {
      userId,
      invoiceForAccountId: accountId,
      date: {
        gte: monthBounds(first.year, first.month).start,
        lt: monthBounds(last.year, last.month).end,
      },
    },
    select: { id: true, date: true, balanceApplied: true },
    orderBy: { date: "asc" },
  });

  const existingByMonth = new Map<string, typeof existing>();
  for (const row of existing) {
    const key = monthKeyOf(row.date);
    const rows = existingByMonth.get(key);
    if (rows) rows.push(row);
    else existingByMonth.set(key, [row]);
  }

  const operations: Prisma.PrismaPromise<unknown>[] = [];

  // The vencimento the user just typed is the card's vencimento, not a
  // one-off override: leaving the two to disagree would show "Vence dia 10"
  // on a card whose invoices all land on the 20th, and reopening the planner
  // would quietly offer to drag them back. Synced cards are read-only, so
  // theirs stays whatever the bank says.
  if (!card.pluggyItemId && card.dueDay !== dueDay) {
    operations.push(prisma.account.update({ where: { id: card.id }, data: { dueDay } }));
  }

  for (const [key, target] of wanted) {
    const rows = existingByMonth.get(key) ?? [];
    // Already settled: skipped whole, including any pending row sitting
    // beside it, which could just as easily be a real second bill as a
    // leftover. Deleting on a guess is the one thing that would lose data.
    if (rows.some((row) => row.balanceApplied)) continue;

    const [current, ...duplicates] = rows;
    // Two pending invoices in the same month are leftovers from an earlier
    // run with a different vencimento. One invoice per month is the whole
    // premise here, so the extras go.
    for (const duplicate of duplicates) {
      operations.push(prisma.transaction.delete({ where: { id: duplicate.id } }));
    }

    if (target.amount <= 0) {
      if (current) operations.push(prisma.transaction.delete({ where: { id: current.id } }));
      continue;
    }

    const data = {
      amount: target.amount,
      date: target.date,
      accountId: sourceAccount.id,
      description: invoiceLabel(card.name, target.date),
    };
    operations.push(
      current
        ? prisma.transaction.update({ where: { id: current.id }, data })
        : prisma.transaction.create({
            data: {
              ...data,
              userId,
              type: "expense",
              // Previsto by definition: the whole point is a bill that has
              // not been paid yet. It only touches the balance when the user
              // confirms it, exactly like every other scheduled entry.
              balanceApplied: false,
              invoiceForAccountId: accountId,
            },
          })
    );
  }

  if (operations.length > 0) await prisma.$transaction(operations);

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
