import "server-only";
import { prisma } from "@/lib/prisma";
import { monthRangeUTC } from "@/lib/utils";

export async function getBudgetsPageData(userId: string, month: number, year: number) {
  const range = monthRangeUTC(year, month);
  const [categories, budgets, spend] = await Promise.all([
    prisma.category.findMany({ where: { userId, type: "expense" }, orderBy: { name: "asc" } }),
    prisma.budget.findMany({ where: { userId, month, year } }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, type: "expense", date: range },
      _sum: { amount: true },
    }),
  ]);

  const spendMap = new Map(
    spend.filter((s) => s.categoryId).map((s) => [s.categoryId as string, s._sum.amount ?? 0])
  );
  const budgetMap = new Map(budgets.map((b) => [b.categoryId, b]));

  const rows = categories.map((c) => ({
    category: c,
    budget: budgetMap.get(c.id) ?? null,
    spent: spendMap.get(c.id) ?? 0,
  }));

  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = rows.reduce((sum, r) => sum + r.spent, 0);

  return { rows, totalBudget, totalSpent };
}

export type BudgetsPageData = Awaited<ReturnType<typeof getBudgetsPageData>>;
