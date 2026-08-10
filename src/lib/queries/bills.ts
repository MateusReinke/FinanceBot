import "server-only";
import { prisma } from "@/lib/prisma";
import { signedAmount } from "@/lib/utils";

// Start of today in UTC — the same calendar-date convention every other
// date in this app uses. An occurrence due *today* is not late.
function startOfTodayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const UPCOMING_DAYS = 30;

// Everything still pending across all of the user's schedules, split the
// way every "contas a pagar" screen splits it: what's late, what's coming
// up, and what the balance will look like once the rest of this month
// clears.
//
// Only autoSettle: false schedules can ever be late — an automatic one is
// applied by reconcileDueInstallments the moment it comes due (and that
// runs in verifySession, before this query). So "atrasado" here really
// means "you told the app you'd pay this by hand, and the day passed".
export async function getBillsSummary(userId: string) {
  const today = startOfTodayUTC();
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + UPCOMING_DAYS);
  const endOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));

  const [pending, accounts] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, financingId: { not: null }, balanceApplied: false, date: { lt: horizon } },
      include: { account: true, category: true, financing: { select: { isRecurring: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.account.findMany({ where: { userId, archived: false }, select: { balance: true } }),
  ]);

  const overdue = pending.filter((t) => t.date < today);
  const upcoming = pending.filter((t) => t.date >= today);

  const signedSum = (rows: typeof pending) =>
    rows.reduce((acc, t) => acc + signedAmount(t.amount, t.type), 0);
  // "A pagar" and "a receber" are kept apart rather than netted — a month
  // with R$3.000 of bills and a R$3.000 salary coming is not the same
  // thing as a quiet month, and netting them would show both as zero.
  const totalOf = (rows: typeof pending, type: string) =>
    rows.filter((t) => t.type === type).reduce((acc, t) => acc + t.amount, 0);

  const currentBalance = accounts.reduce((acc, a) => acc + a.balance, 0);
  // Projected balance = what's in the accounts now, plus everything already
  // scheduled to land before the month is out. Overdue items are included:
  // they are still owed, so leaving them out would flatter the forecast.
  const restOfMonth = signedSum([...overdue, ...upcoming.filter((t) => t.date < endOfMonth)]);

  return {
    overdue,
    upcoming,
    overdueTotal: totalOf(overdue, "expense"),
    toPayTotal: totalOf([...overdue, ...upcoming], "expense"),
    toReceiveTotal: totalOf([...overdue, ...upcoming], "income"),
    currentBalance,
    forecastBalance: currentBalance + restOfMonth,
    upcomingDays: UPCOMING_DAYS,
  };
}

export type BillsSummary = Awaited<ReturnType<typeof getBillsSummary>>;
