import "server-only";
import { prisma } from "@/lib/prisma";
import { monthRangeUTC } from "@/lib/utils";

export async function getDashboardData(userId: string, month: number, year: number) {
  const monthRange = monthRangeUTC(year, month);
  const monthWhere = { userId, date: monthRange };
  // "Realizado" is what actually moved: the same balanceApplied flag the
  // account balance itself is built from, so the two can never disagree.
  // "Previsto" adds what is still only scheduled for this month.
  const realizedWhere = { ...monthWhere, balanceApplied: true };

  const [accounts, incomeAgg, expenseAgg, expenseByCategory, recentTransactions, budgets, scheduled] =
    await Promise.all([
      prisma.account.findMany({ where: { userId, archived: false } }),
      prisma.transaction.aggregate({
        where: { ...realizedWhere, type: "income" },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { ...realizedWhere, type: "expense" },
        _sum: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ["categoryId"],
        where: { ...realizedWhere, type: "expense" },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
      }),
      prisma.transaction.findMany({
        where: monthWhere,
        include: { account: true, category: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 8,
      }),
      prisma.budget.findMany({
        where: { userId, month, year },
        include: { category: true },
      }),
      // Still scheduled for this month, by category and in total — what
      // separates "gastei" from "vou gastar".
      prisma.transaction.groupBy({
        by: ["categoryId", "type"],
        where: { ...monthWhere, balanceApplied: false },
        _sum: { amount: true },
      }),
    ]);

  const categoryIds = expenseByCategory
    .map((g) => g.categoryId)
    .filter((id): id is string => Boolean(id));
  const categories = categoryIds.length
    ? await prisma.category.findMany({ where: { id: { in: categoryIds }, userId } })
    : [];
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const expenseBreakdown = expenseByCategory.map((g) => {
    const category = g.categoryId ? categoryMap.get(g.categoryId) : undefined;
    return {
      categoryId: g.categoryId,
      name: g.categoryId ? category?.name ?? "Categoria removida" : "Sem categoria",
      color: g.categoryId ? category?.color ?? "#78716c" : "#94a3b8",
      icon: g.categoryId ? category?.icon ?? null : null,
      amount: g._sum.amount ?? 0,
    };
  });

  const spendByCategoryId = new Map(
    expenseBreakdown.filter((e) => e.categoryId).map((e) => [e.categoryId as string, e.amount])
  );
  // Budgets track what was actually spent; what is merely scheduled is
  // reported alongside it rather than folded in, so a bill that hasn't been
  // paid can't make a budget look blown before the money leaves.
  const scheduledExpenseByCategoryId = new Map(
    scheduled
      .filter((g) => g.type === "expense" && g.categoryId)
      .map((g) => [g.categoryId as string, g._sum.amount ?? 0])
  );
  const budgetProgress = budgets.map((b) => ({
    ...b,
    spent: spendByCategoryId.get(b.categoryId) ?? 0,
    scheduled: scheduledExpenseByCategoryId.get(b.categoryId) ?? 0,
  }));

  const scheduledTotal = (type: string) =>
    scheduled.filter((g) => g.type === type).reduce((sum, g) => sum + (g._sum.amount ?? 0), 0);
  const scheduledIncome = scheduledTotal("income");
  const scheduledExpense = scheduledTotal("expense");

  const trendMonths = Array.from({ length: 6 }, (_, i) => {
    const offset = 5 - i;
    const d = new Date(Date.UTC(year, month - 1 - offset, 1));
    return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
  });

  // One read spanning the whole window, bucketed in memory — six months of
  // chart used to cost twelve aggregates (an income and an expense query per
  // month), all of them hitting the same index over the same rows. The
  // grouping is by (year, month) via a raw query because Prisma's groupBy
  // cannot group on a date truncation.
  //
  // Realized-only, like the cards above, so the chart and the numbers over
  // it always tell the same story.
  //
  // EXTRACT is safe to bucket on here: Transaction.date is TIMESTAMP(3),
  // i.e. timezone-naive, and every date in this app is written at UTC
  // midnight — so EXTRACT reads back the same calendar month the rest of the
  // app computed, with no session-timezone conversion in between.
  const trendStart = monthRangeUTC(trendMonths[0].year, trendMonths[0].month).gte;
  const trendEnd = monthRangeUTC(
    trendMonths[trendMonths.length - 1].year,
    trendMonths[trendMonths.length - 1].month
  ).lt;

  const trendRows = await prisma.$queryRaw<
    { year: number; month: number; type: string; total: number }[]
  >`
    SELECT
      EXTRACT(YEAR FROM "date")::int  AS year,
      EXTRACT(MONTH FROM "date")::int AS month,
      "type",
      COALESCE(SUM("amount"), 0)::float8 AS total
    FROM "Transaction"
    WHERE "userId" = ${userId}
      AND "balanceApplied" = true
      AND "type" IN ('income', 'expense')
      AND "date" >= ${trendStart}
      AND "date" <  ${trendEnd}
    GROUP BY year, month, "type"
  `;

  const trendTotals = new Map(
    trendRows.map((r) => [`${r.year}-${r.month}-${r.type}`, Number(r.total)])
  );
  const trend = trendMonths.map(({ month: m, year: y }) => ({
    month: m,
    year: y,
    income: trendTotals.get(`${y}-${m}-income`) ?? 0,
    expense: trendTotals.get(`${y}-${m}-expense`) ?? 0,
  }));

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const income = incomeAgg._sum.amount ?? 0;
  const expense = expenseAgg._sum.amount ?? 0;

  return {
    totalBalance,
    accountCount: accounts.length,
    // Fed to the hero block so "where is that money" is answered without a
    // trip to Contas. Biggest first — that is the order people scan.
    accountSummaries: [...accounts]
      .sort((a, b) => b.balance - a.balance)
      .map((a) => ({ id: a.id, name: a.name, balance: a.balance, color: a.color })),
    income,
    expense,
    net: income - expense,
    scheduledIncome,
    scheduledExpense,
    // Where the month lands if everything still scheduled happens.
    forecastIncome: income + scheduledIncome,
    forecastExpense: expense + scheduledExpense,
    forecastNet: income + scheduledIncome - (expense + scheduledExpense),
    expenseBreakdown,
    recentTransactions,
    trend,
    budgetProgress,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
