import "server-only";
import { prisma } from "@/lib/prisma";
import { monthKey } from "@/lib/card-invoices";

// How far the window reaches on each side of the month being viewed.
export const CASHFLOW_BACK = 6;
export const CASHFLOW_FORWARD = 6;
export const CASHFLOW_MONTHS = CASHFLOW_BACK + 1 + CASHFLOW_FORWARD;

export type CashflowPoint = {
  key: string;
  month: number;
  year: number;
  // Money that actually moved (Transaction.balanceApplied), which is the
  // same flag the account balances are built from.
  expenseRealized: number;
  incomeRealized: number;
  // Scheduled and not yet settled. In a past month this is what is still
  // owed from it, not a forecast — the model makes no distinction, and
  // neither should the chart.
  expenseScheduled: number;
  incomeScheduled: number;
  // Relative to the month being viewed, so the chart can mark where the
  // record stops and the plan starts.
  offset: number;
};

// One row per (month, type, settled?) across the whole window.
type Bucket = { year: number; month: number; type: string; settled: boolean; total: number };

// Thirteen months of cash flow — six behind, the month itself, six ahead —
// in a single scan.
//
// The alternative shapes were all worse: Prisma's groupBy cannot group on a
// date truncation, so the month buckets have to come from SQL; and splitting
// realizado from previsto into two queries would walk the same rows of the
// same index twice to produce halves of one chart. Grouping on
// `balanceApplied` alongside the month costs nothing and returns both.
//
// EXTRACT is safe to bucket on: Transaction.date is TIMESTAMP(3), i.e.
// timezone-naive, and every date in this app is written at UTC midnight — so
// EXTRACT reads back the same calendar month the rest of the app computed,
// with no session-timezone conversion in between.
export async function getCashflowSeries(
  userId: string,
  month: number,
  year: number
): Promise<CashflowPoint[]> {
  const months = Array.from({ length: CASHFLOW_MONTHS }, (_, i) => {
    const offset = i - CASHFLOW_BACK;
    const cursor = new Date(Date.UTC(year, month - 1 + offset, 1));
    return {
      offset,
      year: cursor.getUTCFullYear(),
      month: cursor.getUTCMonth() + 1,
    };
  });

  const start = new Date(Date.UTC(months[0].year, months[0].month - 1, 1));
  const end = new Date(Date.UTC(months[months.length - 1].year, months[months.length - 1].month, 1));

  const rows = await prisma.$queryRaw<Bucket[]>`
    SELECT
      EXTRACT(YEAR FROM "date")::int  AS year,
      EXTRACT(MONTH FROM "date")::int AS month,
      "type",
      "balanceApplied" AS settled,
      COALESCE(SUM("amount"), 0)::float8 AS total
    FROM "Transaction"
    WHERE "userId" = ${userId}
      AND "type" IN ('income', 'expense')
      AND "date" >= ${start}
      AND "date" <  ${end}
    GROUP BY year, month, "type", "balanceApplied"
  `;

  const totals = new Map(
    rows.map((r) => [`${r.year}-${r.month}-${r.type}-${r.settled}`, Number(r.total)])
  );
  const at = (y: number, m: number, type: string, settled: boolean) =>
    totals.get(`${y}-${m}-${type}-${settled}`) ?? 0;

  return months.map(({ offset, year: y, month: m }) => ({
    key: monthKey(y, m),
    month: m,
    year: y,
    offset,
    expenseRealized: at(y, m, "expense", true),
    incomeRealized: at(y, m, "income", true),
    expenseScheduled: at(y, m, "expense", false),
    incomeScheduled: at(y, m, "income", false),
  }));
}
