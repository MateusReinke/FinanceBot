import "server-only";
import { prisma } from "@/lib/prisma";
import { monthKey, monthKeyOf } from "@/lib/card-invoices";
import { CASHFLOW_BACK, CASHFLOW_FORWARD, CASHFLOW_MONTHS } from "@/lib/queries/cashflow";
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

// One month of the invoice chart: the total per card, plus which side of
// today the month falls on.
export type InvoiceMonthPoint = {
  key: string;
  month: number;
  year: number;
  offset: number;
  // cardId -> total invoiced that month. Sparse: a card with no invoice in
  // a month is absent rather than zero, so the chart can tell "nada
  // preenchido" from "fatura de R$ 0".
  byCard: Record<string, number>;
  total: number;
};

export type CardInvoiceData = {
  plans: CardInvoicePlans;
  series: InvoiceMonthPoint[];
};

// Every card invoice in a thirteen-month window — six months of history, the
// current month, six months of what the user has planned — read once and
// shaped twice.
//
// The planner and the card tiles want it grouped by card from today forward;
// the chart wants it grouped by month across the whole window. Those are two
// views of the same few rows, so they come from one query rather than two
// scans of the same index.
//
// Invoices live as expenses on the account that PAYS them (see
// Transaction.invoiceForAccountId), so this reads them by that link and
// never by accountId.
export async function getCardInvoiceData(userId: string): Promise<CardInvoiceData> {
  const today = startOfTodayUTC();
  const currentMonth = today.getUTCMonth();
  const currentYear = today.getUTCFullYear();

  const months = Array.from({ length: CASHFLOW_MONTHS }, (_, i) => {
    const offset = i - CASHFLOW_BACK;
    const cursor = new Date(Date.UTC(currentYear, currentMonth + offset, 1));
    return { offset, year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1 };
  });

  const from = new Date(Date.UTC(currentYear, currentMonth - CASHFLOW_BACK, 1));
  const to = new Date(Date.UTC(currentYear, currentMonth + CASHFLOW_FORWARD + 1, 1));

  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      invoiceForAccountId: { not: null },
      date: { gte: from, lt: to },
    },
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
  const byMonth = new Map<string, Record<string, number>>();

  // The planner's floor is the 1st of this month rather than today: an
  // invoice already paid earlier this month still has to show up, otherwise
  // the planner would offer to schedule a second one for a settled month.
  const planFloor = new Date(Date.UTC(currentYear, currentMonth, 1));

  for (const row of rows) {
    const cardId = row.invoiceForAccountId;
    if (!cardId) continue;
    const key = monthKeyOf(row.date);

    const bucket = byMonth.get(key) ?? {};
    bucket[cardId] = (bucket[cardId] ?? 0) + row.amount;
    byMonth.set(key, bucket);

    if (row.date >= planFloor) {
      (plans[cardId] ??= []).push({
        id: row.id,
        monthKey: key,
        date: row.date,
        amount: row.amount,
        paid: row.balanceApplied,
        accountId: row.accountId,
      });
    }
  }

  const series = months.map(({ offset, year, month }) => {
    const key = monthKey(year, month);
    const cards = byMonth.get(key) ?? {};
    return {
      key,
      month,
      year,
      offset,
      byCard: cards,
      total: Object.values(cards).reduce((sum, v) => sum + v, 0),
    };
  });

  return { plans, series };
}
