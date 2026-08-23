import type { Metadata } from "next";
import Link from "next/link";
import { Landmark, ArrowLeftRight, BarChart3 } from "lucide-react";
import { verifySession, getCurrentUser } from "@/lib/dal";
import { getDashboardData } from "@/lib/queries/dashboard";
import { getBillsSummary } from "@/lib/queries/bills";
import { getGuideProgress } from "@/lib/queries/onboarding";
import { formatCurrency, formatDate, formatMonthYear, getCurrentMonthYear, cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/ui/category-icon";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { transactionStatus } from "@/lib/transaction-status";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CashflowChart } from "@/components/charts/cashflow-chart";
import { CategoryBarChart } from "@/components/charts/category-bar-chart";
import { MonthSelector } from "@/components/ui/month-selector";
import { Alert } from "@/components/ui/alert";
import { UpcomingBills, UpcomingBillsEmpty } from "@/components/dashboard/upcoming-bills";
import { BalanceHero } from "@/components/dashboard/balance-hero";
import { DueAlerts } from "@/components/dashboard/due-alerts";
import { GettingStarted } from "@/components/dashboard/getting-started";

export const metadata: Metadata = { title: "Painel — FinanceBot" };

// Charts render an axis grid even with nothing to plot, which reads as
// broken rather than empty. This replaces them outright when there is no
// data for the period.
function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
      <BarChart3 className="h-7 w-7 text-muted-foreground" />
      <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

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

  const [data, bills, guide, user] = await Promise.all([
    getDashboardData(userId, month, year),
    getBillsSummary(userId),
    getGuideProgress(userId),
    getCurrentUser(),
  ]);
  // Half of this page is month-scoped (the stat cards, the charts, the
  // budgets) and half is inherently about today (the balance in your
  // accounts, what is overdue, what is coming due). Nothing said which was
  // which, so picking an older month left the biggest blocks on screen
  // unchanged and the month selector read as broken.
  //
  // The fix is to stop mixing the two on the same screen: on another month
  // this becomes a report about that month, and the today-only blocks step
  // aside rather than quietly showing today's numbers under a July heading.
  const isCurrentMonth = month === current.month && year === current.year;
  // Three ways the checklist goes away: everything done, the user hid it, or
  // they are reading a past month (where "set this up" is beside the point).
  const showGuide = !guide.complete && !user?.guideDismissedAt && isCurrentMonth;
  const monthLabel = formatMonthYear(month, year);
  const hasBills = bills.overdue.length > 0 || bills.upcoming.length > 0;
  const hasCashflow = data.cashflow.some(
    (point) =>
      point.expenseRealized > 0 ||
      point.expenseScheduled > 0 ||
      point.incomeRealized > 0 ||
      point.incomeScheduled > 0
  );
  // The month just before the one being viewed, which the cashflow window
  // already contains — no extra read to compare against it.
  const previous = data.cashflow.find((point) => point.offset === -1);
  const incomeDelta = previous ? percentChange(data.income, previous.incomeRealized) : undefined;
  const expenseDelta = previous ? percentChange(data.expense, previous.expenseRealized) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel"
        description={
          isCurrentMonth
            ? "Realizado é o que já entrou ou saiu de verdade; previsto inclui o que ainda está agendado para o mês."
            : `Resumo de ${monthLabel.toLowerCase()}. Saldo e vencimentos são sempre de hoje, então ficam de fora deste mês.`
        }
        actions={<MonthSelector month={month} year={year} basePath="/dashboard" />}
      />

      {isCurrentMonth ? null : (
        <Alert
          tone="info"
          title={`Você está vendo ${monthLabel}`}
          action={{ href: "/dashboard", label: `Voltar para ${formatMonthYear(current.month, current.year)}` }}
        >
          Os números abaixo são desse mês. Saldo das contas, próximos vencimentos e cobranças
          continuam valendo para hoje, por isso não aparecem aqui.
        </Alert>
      )}

      {showGuide ? <GettingStarted progress={guide} /> : null}

      {/* Nothing below here has anything to plot until there is an account to
          plot it against, and the checklist above already says so — a wall of
          zeroed cards would just repeat it less clearly. The short version
          below covers the case where the checklist is hidden, so the painel
          is never a page with only a heading on it. */}
      {data.accountCount === 0 ? (
        showGuide ? null : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-10 text-center">
            <Landmark className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Comece criando uma conta para acompanhar seus gastos e receitas.
            </p>
            <Link href="/accounts" className="text-sm font-medium text-primary hover:underline">
              Ir para Contas →
            </Link>
          </div>
        )
      ) : (
        <>
          {/* Above the balance on purpose: an overdue bill is the one thing
              the user needs to know before anything else on this page. Both
              this and the hero are about today, so they are shown only while
              today is what you are looking at. */}
          {isCurrentMonth ? (
            <>
              <DueAlerts bills={bills} />
              <BalanceHero
                totalBalance={data.totalBalance}
                forecastBalance={bills.forecastBalance}
                accounts={data.accountSummaries}
              />
            </>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={isCurrentMonth ? "Entradas no mês" : `Entradas em ${monthLabel.split(" de ")[0].toLowerCase()}`}
              value={formatCurrency(data.income)}
              hint={
                data.scheduledIncome > 0
                  ? `+ ${formatCurrency(data.scheduledIncome)} a receber`
                  : undefined
              }
              valueClassName="text-success"
              delta={
                incomeDelta !== undefined
                  ? { percent: incomeDelta, tone: incomeDelta >= 0 ? "success" : "danger" }
                  : undefined
              }
            />
            <StatCard
              label={isCurrentMonth ? "Saídas no mês" : `Saídas em ${monthLabel.split(" de ")[0].toLowerCase()}`}
              value={formatCurrency(data.expense)}
              valueClassName="text-danger"
              hint={
                data.scheduledExpense > 0
                  ? `+ ${formatCurrency(data.scheduledExpense)} a pagar`
                  : undefined
              }
              delta={
                expenseDelta !== undefined
                  ? { percent: expenseDelta, tone: expenseDelta <= 0 ? "success" : "danger" }
                  : undefined
              }
            />
            <StatCard
              label={isCurrentMonth ? "Sobrou no mês" : `Sobrou em ${monthLabel.split(" de ")[0].toLowerCase()}`}
              value={formatCurrency(data.net)}
              valueClassName={data.net >= 0 ? "text-success" : "text-danger"}
              hint={
                data.forecastNet !== data.net
                  ? `${formatCurrency(data.forecastNet)} previsto`
                  : undefined
              }
            />
            {/* Promoted to a card of its own: money other people owe you is
                the easiest kind to lose track of, precisely because nothing
                reminds you of it. Today-scoped like the hero, so it sits out
                on other months. */}
            {isCurrentMonth ? (
            <StatCard
              label="A receber"
              value={formatCurrency(bills.toReceiveTotal)}
              valueClassName={bills.toReceiveTotal > 0 ? "text-success" : undefined}
              href="/receivables"
              hint={
                bills.overdueReceiveTotal > 0
                  ? `${formatCurrency(bills.overdueReceiveTotal)} atrasado — cobrar`
                  : bills.toReceiveTotal > 0
                    ? "Ver quem deve"
                    : "Ninguém te devendo"
              }
              hintClassName={bills.overdueReceiveTotal > 0 ? "text-danger" : undefined}
            />
            ) : null}
          </div>

          {isCurrentMonth ? (hasBills ? <UpcomingBills bills={bills} /> : <UpcomingBillsEmpty />) : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <Card className="surface-chart lg:col-span-3">
              <CardHeader className="flex-col items-start gap-0.5">
                <CardTitle>Gastos — 6 meses atrás, 6 à frente</CardTitle>
                <p className="text-xs text-muted-foreground">
                  A barra cheia é o que já saiu da conta; a clara é o que está agendado e ainda
                  vai sair.
                </p>
              </CardHeader>
              <CardContent>
                {hasCashflow ? (
                  <CashflowChart data={data.cashflow} />
                ) : (
                  <EmptyChart message="Sem histórico ainda. Assim que houver lançamentos — ou faturas programadas —, os 13 meses aparecem aqui." />
                )}
              </CardContent>
            </Card>

            <Card className="surface-chart lg:col-span-2">
              <CardHeader>
                <CardTitle>Gastos por categoria</CardTitle>
              </CardHeader>
              <CardContent>
                {data.expenseBreakdown.length === 0 ? (
                  <EmptyChart message="Nenhuma despesa realizada neste mês." />
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
                <CardTitle>Lançamentos recentes</CardTitle>
                <Link
                  href={`/transactions?month=${month}&year=${year}`}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Ver todos
                </Link>
              </CardHeader>
              <CardContent>
                {data.recentTransactions.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <ArrowLeftRight className="h-6 w-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Nenhum lançamento neste mês.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.recentTransactions.map((t) => {
                      const isExpense = t.type === "expense";
                      const status = transactionStatus(t);
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
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-medium text-foreground">
                                {t.description}
                              </p>
                              {status === "paid" ? null : (
                                <StatusBadge status={status} type={t.type} />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(t.date)}
                              {t.account ? ` · ${t.account.name}` : null}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 text-sm font-semibold",
                              status !== "paid"
                                ? "text-muted-foreground"
                                : isExpense
                                  ? "text-danger"
                                  : "text-success"
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
