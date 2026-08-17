import "server-only";
import { prisma } from "@/lib/prisma";
import { startOfTodayUTC } from "@/lib/transaction-status";

// Counts for the little badges in the sidebar.
//
// Deliberately two counts and nothing else: this runs in the app layout, on
// every single page, so it has to stay a pair of indexed counts rather than
// anything that reads rows. Both are served by the
// (userId, balanceApplied, date) index.
//
// The point is that "3 contas atrasadas" is visible from wherever the user
// happens to be, not only when they think to visit the dashboard.
export async function getNavBadges(userId: string) {
  const today = startOfTodayUTC();
  const overdueWhere = { userId, balanceApplied: false, date: { lt: today } };

  const [overdueExpenses, overdueReceivables] = await Promise.all([
    prisma.transaction.count({ where: { ...overdueWhere, type: "expense" } }),
    prisma.transaction.count({ where: { ...overdueWhere, type: "income" } }),
  ]);

  return { overdueExpenses, overdueReceivables };
}

export type NavBadges = Awaited<ReturnType<typeof getNavBadges>>;
