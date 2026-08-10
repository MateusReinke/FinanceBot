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
  const trend = await Promise.all(
    trendMonths.map(async ({ month: m, year: y }) => {
      const range = monthRangeUTC(y, m);
      const [inc, exp] = await Promise.all([
        // Realized-only, like the cards above, so the chart and the numbers
        // over it always tell the same story.
        prisma.transaction.aggregate({
          where: { userId, type: "income", date: range, balanceApplied: true },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId, type: "expense", date: range, balanceApplied: true },
          _sum: { amount: true },
        }),
      ]);
      return { month: m, year: y, income: inc._sum.amount ?? 0, expense: exp._sum.amount ?? 0 };
    })
  );

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
