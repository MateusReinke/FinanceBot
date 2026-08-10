import type { Metadata } from "next";
import Link from "next/link";
import { Landmark, ArrowLeftRight } from "lucide-react";
import { verifySession } from "@/lib/dal";
import { getDashboardData } from "@/lib/queries/dashboard";
import { getBillsSummary } from "@/lib/queries/bills";
import { formatCurrency, formatDate, getCurrentMonthYear, cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/ui/category-icon";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TrendChart } from "@/components/charts/trend-chart";
import { CategoryBarChart } from "@/components/charts/category-bar-chart";
import { MonthSelector } from "@/components/ui/month-selector";
import { UpcomingBills, UpcomingBillsEmpty } from "@/components/dashboard/upcoming-bills";

export const metadata: Metadata = { title: "Painel — FinanceBot" };

function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { userId } = await verifySession();
  const sp = await searchParams;
  const current = getCurrentMonthYear();
  const month = Number(sp.month) || current.month;
  const year = Number(sp.year) || current.year;

  const [data, bills] = await Promise.all([
    getDashboardData(userId, month, year),
    getBillsSummary(userId),
  ]);
  const hasBills = bills.overdue.length > 0 || bills.upcoming.length > 0;
  const previous = data.trend[data.trend.length - 2];
  const incomeDelta = previous ? percentChange(data.income, previous.income) : undefined;
  const expenseDelta = previous ? percentChange(data.expense, previous.expense) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Painel</h1>
        <MonthSelector month={month} year={year} basePath="/dashboard" />
      </div>

      {data.accountCount === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-10 text-center">
          <Landmark className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Comece criando uma conta para acompanhar seus gastos e receitas.
          </p>
          <Link href="/accounts" className="text-sm font-medium text-primary hover:underline">
            Ir para Contas →
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Saldo total" value={formatCurrency(data.totalBalance)} />
            <StatCard
              label="Receitas no mês"
              value={formatCurrency(data.income)}
              valueClassName="text-success"
              delta={
                incomeDelta !== undefined
                  ? { percent: incomeDelta, tone: incomeDelta >= 0 ? "success" : "danger" }
                  : undefined
              }
            />
            <StatCard
              label="Despesas no mês"
              value={formatCurrency(data.expense)}
              valueClassName="text-danger"
              delta={
                expenseDelta !== undefined
                  ? { percent: expenseDelta, tone: expenseDelta <= 0 ? "success" : "danger" }
                  : undefined
              }
            />
            <StatCard
              label="Saldo do mês"
              value={formatCurrency(data.net)}
              valueClassName={data.net >= 0 ? "text-success" : "text-danger"}
            />
          </div>

          {hasBills ? <UpcomingBills bills={bills} /> : <UpcomingBillsEmpty />}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Receitas x despesas — últimos 6 meses</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart data={data.trend} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Gastos por categoria</CardTitle>
              </CardHeader>
              <CardContent>
                {data.expenseBreakdown.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Nenhuma despesa neste mês.
                  </p>
                ) : (
                  <CategoryBarChart
                    data={data.expenseBreakdown.slice(0, 7).map((c) => ({
                      name: c.name,
                      amount: c.amount,
                      color: c.color,
                    }))}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Transações recentes</CardTitle>
                <Link href="/transactions" className="text-xs font-medium text-primary hover:underline">
                  Ver todas
                </Link>
              </CardHeader>
              <CardContent>
                {data.recentTransactions.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <ArrowLeftRight className="h-6 w-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Nenhuma transação neste mês.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.recentTransactions.map((t) => {
                      const isExpense = t.type === "expense";
                      return (
                        <li key={t.id} className="flex items-center gap-3 py-2.5">
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                            style={{
                              backgroundColor: `${t.category?.color ?? "#94a3b8"}20`,
                              color: t.category?.color ?? "#94a3b8",
                            }}
                          >
                            <CategoryIcon icon={t.category?.icon} className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {t.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(t.date)} · {t.account.name}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 text-sm font-semibold",
                              isExpense ? "text-danger" : "text-success"
                            )}
                          >
                            {isExpense ? "-" : "+"}
                            {formatCurrency(t.amount)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Orçamentos do mês</CardTitle>
                <Link href="/budgets" className="text-xs font-medium text-primary hover:underline">
                  Gerenciar
                </Link>
              </CardHeader>
              <CardContent>
                {data.budgetProgress.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      Você ainda não definiu orçamentos para este mês.
                    </p>
                    <Link href="/budgets" className="text-sm font-medium text-primary hover:underline">
                      Definir orçamento →
                    </Link>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {data.budgetProgress.map((b) => {
                      const pct = b.amount > 0 ? Math.min(100, (b.spent / b.amount) * 100) : 0;
                      const over = b.spent > b.amount;
                      return (
                        <li key={b.id}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium text-foreground">{b.category.name}</span>
                            <span className={cn("text-xs", over ? "text-danger" : "text-muted-foreground")}>
                              {formatCurrency(b.spent)} / {formatCurrency(b.amount)}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn("h-full rounded-full", over ? "bg-danger" : "bg-primary")}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
