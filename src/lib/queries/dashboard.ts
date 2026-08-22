import "server-only";
import { prisma } from "@/lib/prisma";
import { monthRangeUTC } from "@/lib/utils";
import { getCashflowSeries } from "@/lib/queries/cashflow";

export async function getDashboardData(userId: string, month: number, year: number) {
  const monthRange = monthRangeUTC(year, month);
  const monthWhere = { userId, date: monthRange };

  // Everything this page needs, in one wave.
  //
  // It used to be three: a batch, then a categories read that depended on
  // the groupBy above it, then the chart's raw query — which depended on
  // nothing at all and was simply awaited last. Two round trips were being
  // paid for no reason. Categories are a handful of rows per user, so
  // reading all of them up front is cheaper than the dependency was.
  //
  // The month's four aggregates also collapsed into one. Income total,
  // expense total, spend-by-category and scheduled-by-category were four
  // queries walking the same rows of the same index over the same month;
  // grouping once on (categoryId, type, balanceApplied) answers all four,
  // and the splitting is a few passes over a handful of rows in memory.
  const [accounts, categories, monthGroups, recent, budgets, cashflow] = await Promise.all([
    prisma.account.findMany({ where: { userId, archived: false } }),
    prisma.category.findMany({ where: { userId } }),
    prisma.transaction.groupBy({
      by: ["categoryId", "type", "balanceApplied"],
      where: monthWhere,
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: monthWhere,
      // The relations are resolved from the maps below instead of being
      // `include`d: Prisma issues one extra query per included relation,
      // and this page has already read every account and category it could
      // possibly point at.
      select: {
        id: true,
        description: true,
        amount: true,
        date: true,
        type: true,
        balanceApplied: true,
        accountId: true,
        categoryId: true,
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.budget.findMany({ where: { userId, month, year } }),
    getCashflowSeries(userId, month, year),
  ]);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  const sumOf = (predicate: (g: (typeof monthGroups)[number]) => boolean) =>
    monthGroups.filter(predicate).reduce((total, g) => total + (g._sum.amount ?? 0), 0);

  const income = sumOf((g) => g.type === "income" && g.balanceApplied);
  const expense = sumOf((g) => g.type === "expense" && g.balanceApplied);
  const scheduledIncome = sumOf((g) => g.type === "income" && !g.balanceApplied);
  const scheduledExpense = sumOf((g) => g.type === "expense" && !g.balanceApplied);

  // Realized expense per category, biggest first — the order the chart and
  // the list both read in.
  const realizedByCategory = new Map<string | null, number>();
  for (const g of monthGroups) {
    if (g.type !== "expense" || !g.balanceApplied) continue;
    realizedByCategory.set(
      g.categoryId,
      (realizedByCategory.get(g.categoryId) ?? 0) + (g._sum.amount ?? 0)
    );
  }
  const expenseBreakdown = [...realizedByCategory.entries()]
    .map(([categoryId, amount]) => {
      const category = categoryId ? categoryMap.get(categoryId) : undefined;
      return {
        categoryId,
        name: categoryId ? category?.name ?? "Categoria removida" : "Sem categoria",
        color: categoryId ? category?.color ?? "#78716c" : "#94a3b8",
        icon: categoryId ? category?.icon ?? null : null,
        amount,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // Budgets track what was actually spent; what is merely scheduled is
  // reported alongside it rather than folded in, so a bill that hasn't been
  // paid can't make a budget look blown before the money leaves.
  const scheduledExpenseByCategoryId = new Map<string, number>();
  for (const g of monthGroups) {
    if (g.type !== "expense" || g.balanceApplied || !g.categoryId) continue;
    scheduledExpenseByCategoryId.set(
      g.categoryId,
      (scheduledExpenseByCategoryId.get(g.categoryId) ?? 0) + (g._sum.amount ?? 0)
    );
  }
  const budgetProgress = budgets
    .map((b) => ({
      ...b,
      category: categoryMap.get(b.categoryId) ?? null,
      spent: realizedByCategory.get(b.categoryId) ?? 0,
      scheduled: scheduledExpenseByCategoryId.get(b.categoryId) ?? 0,
    }))
    // A budget whose category was deleted has nothing to name it; the
    // relation is optional in memory the same way it is in the database.
    .filter((b): b is typeof b & { category: NonNullable<typeof b.category> } => b.category !== null);

  const recentTransactions = recent.map((t) => ({
    ...t,
    account: accountMap.get(t.accountId) ?? null,
    category: t.categoryId ? categoryMap.get(t.categoryId) ?? null : null,
  }));

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

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
    cashflow,
    budgetProgress,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
