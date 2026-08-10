import type { Metadata } from "next";
import Link from "next/link";
import { PiggyBank } from "lucide-react";
import { verifySession } from "@/lib/dal";
import { getBudgetsPageData } from "@/lib/queries/budgets";
import { formatCurrency, getCurrentMonthYear, cn } from "@/lib/utils";
import { MonthSelector } from "@/components/ui/month-selector";
import { StatCard } from "@/components/ui/stat-card";
import { BudgetRow } from "./budget-row";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Orçamentos — FinanceBot" };

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { userId } = await verifySession();
  const sp = await searchParams;
  const current = getCurrentMonthYear();
  const month = Number(sp.month) || current.month;
  const year = Number(sp.year) || current.year;

  const { rows, totalBudget, totalSpent } = await getBudgetsPageData(userId, month, year);
  const remaining = totalBudget - totalSpent;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Orçamentos"
          description="Defina limites de gasto mensal por categoria."
        />
        <MonthSelector month={month} year={year} basePath="/budgets" />
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-10 text-center">
          <PiggyBank className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Crie categorias de despesa para poder definir orçamentos.
          </p>
          <Link href="/categories" className="text-sm font-medium text-primary hover:underline">
            Ir para Categorias →
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Orçamento total" value={formatCurrency(totalBudget)} />
            <StatCard label="Gasto no mês" value={formatCurrency(totalSpent)} valueClassName="text-danger" />
            <StatCard
              label="Restante"
              value={formatCurrency(remaining)}
              valueClassName={cn(remaining >= 0 ? "text-success" : "text-danger")}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <BudgetRow
                key={r.category.id}
                category={r.category}
                budget={r.budget}
                spent={r.spent}
                scheduled={r.scheduled}
                month={month}
                year={year}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
