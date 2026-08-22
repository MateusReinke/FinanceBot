import "server-only";
import { prisma } from "@/lib/prisma";
import { monthKeyOf } from "@/lib/card-invoices";
import { startOfTodayUTC } from "@/lib/transaction-status";

// One invoice the user has already written down for a card, as the planner
// and the card tile need to read it back.
//
// `paid` is Transaction.balanceApplied: an invoice that has been settled is
// history, not a plan, so the planner shows its month locked rather than
// letting an edit rewrite a payment that already moved money.
export type PlannedInvoice = {
  id: string;
  // "2026-09" — the month the invoice belongs to, which is what the planner
  // keys its rows by.
  monthKey: string;
  date: Date;
  amount: number;
  paid: boolean;
  // The account the money leaves from. Kept so reopening the planner
  // defaults to the account the user picked last time instead of the first
  // one in the list.
  accountId: string;
};

export type CardInvoicePlans = Record<string, PlannedInvoice[]>;

// Every card invoice from the start of the current month onwards, grouped by
// the card it belongs to.
//
// The floor is the 1st of this month rather than today: an invoice already
// paid earlier this month still has to show up, otherwise the planner would
// offer to schedule a second one for a month that is settled.
//
// Invoices live as expenses on the account that PAYS them (see
// Transaction.invoiceForAccountId), so this reads them by that link and
// never by accountId.
export async function getCardInvoicePlans(userId: string): Promise<CardInvoicePlans> {
  const today = startOfTodayUTC();
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const rows = await prisma.transaction.findMany({
    where: { userId, invoiceForAccountId: { not: null }, date: { gte: from } },
    select: {
      id: true,
      date: true,
      amount: true,
      balanceApplied: true,
      accountId: true,
      invoiceForAccountId: true,
    },
    orderBy: { date: "asc" },
  });

  const plans: CardInvoicePlans = {};
  for (const row of rows) {
    const cardId = row.invoiceForAccountId;
    if (!cardId) continue;
    (plans[cardId] ??= []).push({
      id: row.id,
      monthKey: monthKeyOf(row.date),
      date: row.date,
      amount: row.amount,
      paid: row.balanceApplied,
      accountId: row.accountId,
    });
  }
  return plans;
}
