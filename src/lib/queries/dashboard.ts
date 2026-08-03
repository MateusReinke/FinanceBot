import "server-only";
import { prisma } from "@/lib/prisma";
import { monthRangeUTC } from "@/lib/utils";

export async function getDashboardData(userId: string, month: number, year: number) {
  const monthRange = monthRangeUTC(year, month);
  const monthWhere = { userId, date: monthRange };

  const [accounts, incomeAgg, expenseAgg, expenseByCategory, recentTransactions, budgets] =
    await Promise.all([
      prisma.account.findMany({ where: { userId, archived: false } }),
      prisma.transaction.aggregate({
        where: { ...monthWhere, type: "income" },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { ...monthWhere, type: "expense" },
        _sum: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ["categoryId"],
        where: { ...monthWhere, type: "expense" },
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
    ]);

  const categoryIds = expenseByCategory
    .map((g) => g.categoryId)
    .filter((id): id is string => Boolean(id));
  const categories = categoryIds.length
    ? await prisma.category.findMany({ where: { id: { in: categoryIds } } })
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
  const budgetProgress = budgets.map((b) => ({
    ...b,
    spent: spendByCategoryId.get(b.categoryId) ?? 0,
  }));

  const trendMonths = Array.from({ length: 6 }, (_, i) => {
    const offset = 5 - i;
    const d = new Date(Date.UTC(year, month - 1 - offset, 1));
    return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
  });
  const trend = await Promise.all(
    trendMonths.map(async ({ month: m, year: y }) => {
      const range = monthRangeUTC(y, m);
      const [inc, exp] = await Promise.all([
        prisma.transaction.aggregate({
          where: { userId, type: "income", date: range },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId, type: "expense", date: range },
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
    income,
    expense,
    net: income - expense,
    expenseBreakdown,
    recentTransactions,
    trend,
    budgetProgress,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
