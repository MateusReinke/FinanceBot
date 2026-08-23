import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { monthRangeUTC } from "@/lib/utils";
import { statusWhere, type TransactionStatus } from "@/lib/transaction-status";

export const PAGE_SIZE = 50;

export type TransactionFilters = {
  accountId?: string;
  categoryId?: string;
  type?: "income" | "expense";
  status?: TransactionStatus;
  from?: string;
  to?: string;
  q?: string;
  page: number;
};

// The list is scoped to one month by default, like a bank statement — the
// months before and after are a click away in the month selector. Before
// this it returned every row the account had ever had, which for anyone
// with a few fixed expenses meant paging through years of future
// occurrences to find last week's groceries.
//
// Two things deliberately break out of the month: a text search and an
// explicit date range. Someone typing "netflix" wants it wherever it is,
// and the UI says out loud when it is looking outside the month.
export function isSearchingAllTime(filters: TransactionFilters) {
  return Boolean(filters.q || filters.from || filters.to);
}

export async function getTransactionsPageData(
  userId: string,
  filters: TransactionFilters,
  month: number,
  year: number
) {
  const where: Prisma.TransactionWhereInput = { userId };
  if (filters.accountId) where.accountId = filters.accountId;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.type) where.type = filters.type;
  if (filters.q) where.description = { contains: filters.q, mode: "insensitive" };
  // Merged rather than assigned: the status filter also constrains `date`
  // (an overdue row is a pending one in the past).
  if (filters.status) Object.assign(where, statusWhere(filters.status));

  const dateWhere = typeof where.date === "object" && where.date !== null ? where.date : {};
  if (isSearchingAllTime(filters)) {
    if (filters.from || filters.to) {
      where.date = {
        ...dateWhere,
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}),
      };
    }
  } else {
    const range = monthRangeUTC(year, month);
    where.date = { ...dateWhere, ...range };
  }

  const [total, transactions, totals] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: { account: true, category: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    // Totals for the whole filtered set, not just the visible page — a
    // summary that changed as you paged would be worse than none.
    prisma.transaction.groupBy({
      by: ["type", "balanceApplied"],
      where,
      _sum: { amount: true },
    }),
  ]);

  const sumOf = (type: string, applied: boolean) =>
    totals
      .filter((t) => t.type === type && t.balanceApplied === applied)
      .reduce((sum, t) => sum + (t._sum.amount ?? 0), 0);

  const income = sumOf("income", true);
  const expense = sumOf("expense", true);
  const scheduledIncome = sumOf("income", false);
  const scheduledExpense = sumOf("expense", false);

  return {
    transactions,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    summary: {
      income,
      expense,
      net: income - expense,
      scheduledIncome,
      scheduledExpense,
    },
  };
}

export type TransactionsPageData = Awaited<ReturnType<typeof getTransactionsPageData>>;
