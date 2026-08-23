import "server-only";
import { prisma } from "@/lib/prisma";
import { signedAmount } from "@/lib/utils";
import { startOfTodayUTC } from "@/lib/transaction-status";
import { SOON_DAYS, urgencyOf } from "@/lib/due-dates";

const UPCOMING_DAYS = 30;

// Everything scheduled and not yet realized, split the way every "contas a
// pagar" screen splits it: what's late, what's coming up, and what the
// balance will look like once the month clears.
//
// Reads every pending transaction, whether it came from a recurring
// schedule or was entered on its own as "ainda não paguei" — they are the
// same thing to the balance, so they are the same thing here.
//
// A recurring entry set to debit automatically can never show up as late:
// reconcileDueInstallments applies it the moment it comes due, and that
// runs in verifySession, before this query.
export async function getBillsSummary(userId: string) {
  const today = startOfTodayUTC();
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + UPCOMING_DAYS);
  const endOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));

  const [pending, accounts] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, balanceApplied: false, date: { lt: horizon } },
      include: {
        account: true,
        category: true,
        financing: { select: { isRecurring: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.account.findMany({ where: { userId, archived: false }, select: { balance: true } }),
  ]);

  const overdue = pending.filter((t) => t.date < today);
  const upcoming = pending.filter((t) => t.date >= today);
  // What needs attention *today* — due today or inside the next few days.
  // This is what the dashboard's alert banner counts, and keeping it here
  // rather than in the component is what stops the banner and the list from
  // disagreeing about which bills are pressing.
  const dueSoon = upcoming.filter((t) => {
    const urgency = urgencyOf(t.date, today);
    return urgency === "today" || urgency === "soon";
  });
  const dueToday = upcoming.filter((t) => urgencyOf(t.date, today) === "today");

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
    dueSoon,
    overdueTotal: totalOf(overdue, "expense"),
    // Deliberately split in three. The old single "toPayTotal" mixed
    // overdue into a figure labelled "a pagar em 30 dias", so a bill from
    // last month was being reported as something due in the next 30 days —
    // the number was right for "what I owe", wrong for what it was called.
    upcomingPayTotal: totalOf(upcoming, "expense"),
    upcomingReceiveTotal: totalOf(upcoming, "income"),
    // Everything still owed, late or not — what the user actually has to
    // find the money for.
    toPayTotal: totalOf([...overdue, ...upcoming], "expense"),
    toReceiveTotal: totalOf([...overdue, ...upcoming], "income"),
    overdueReceiveTotal: totalOf(overdue, "income"),
    dueSoonTotal: totalOf(dueSoon, "expense"),
    dueTodayCount: dueToday.length,
    dueSoonCount: dueSoon.length,
    currentBalance,
    forecastBalance: currentBalance + restOfMonth,
    upcomingDays: UPCOMING_DAYS,
    soonDays: SOON_DAYS,
  };
}

export type BillsSummary = Awaited<ReturnType<typeof getBillsSummary>>;
