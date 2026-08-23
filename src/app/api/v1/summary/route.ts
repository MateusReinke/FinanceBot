import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApiRequest, rateLimit } from "@/lib/api-auth";
import { getBillsSummary } from "@/lib/queries/bills";
import { getCurrentMonthYear, monthRangeUTC } from "@/lib/utils";

// A compact picture of the month, for a scheduled n8n flow that sends a
// daily or weekly digest over WhatsApp. Same realizado/previsto split the
// dashboard uses, so the message and the app can never disagree.
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const limited = rateLimit(`summary:${auth.userId}`);
  if (!limited.ok) return limited.response;

  const { month, year } = getCurrentMonthYear();
  const range = monthRangeUTC(year, month);

  const [accounts, income, expense, bills] = await Promise.all([
    prisma.account.findMany({
      where: { userId: auth.userId, archived: false },
      select: { name: true, balance: true, type: true },
    }),
    prisma.transaction.aggregate({
      where: { userId: auth.userId, type: "income", date: range, balanceApplied: true },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId: auth.userId, type: "expense", date: range, balanceApplied: true },
      _sum: { amount: true },
    }),
    getBillsSummary(auth.userId),
  ]);

  return NextResponse.json({
    month,
    year,
    balance: accounts.reduce((sum, a) => sum + a.balance, 0),
    accounts,
    realized: { income: income._sum.amount ?? 0, expense: expense._sum.amount ?? 0 },
    forecastBalance: bills.forecastBalance,
    toPay: bills.toPayTotal,
    toReceive: bills.toReceiveTotal,
    overdue: bills.overdue.map((t) => ({
      description: t.description,
      amount: t.amount,
      date: t.date,
    })),
    upcoming: bills.upcoming.slice(0, 10).map((t) => ({
      description: t.description,
      amount: t.amount,
      date: t.date,
      type: t.type,
    })),
  });
}
