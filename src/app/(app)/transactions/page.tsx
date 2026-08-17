import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { TransactionFiltersSchema } from "@/lib/validation/transactions";
import {
  getTransactionsPageData,
  isSearchingAllTime,
  PAGE_SIZE,
} from "@/lib/queries/transactions";
import { getCounterpartySuggestions } from "@/lib/queries/receivables";
import { formatCurrency, formatMonthYear, getCurrentMonthYear, cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { MonthSelector } from "@/components/ui/month-selector";
import { FiltersBar } from "./filters-bar";
import { AddTransactionButton } from "./add-transaction-button";
import { StatementList } from "./statement-list";

export const metadata: Metadata = { title: "Lançamentos — FinanceBot" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId } = await verifySession();
  const rawParams = await searchParams;

  const asString = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const parsed = TransactionFiltersSchema.safeParse({
    accountId: asString(rawParams.accountId),
    categoryId: asString(rawParams.categoryId),
    type: asString(rawParams.type),
    status: asString(rawParams.status),
    from: asString(rawParams.from),
    to: asString(rawParams.to),
    q: asString(rawParams.q),
    page: asString(rawParams.page),
  });
  const filters = parsed.success ? parsed.data : { page: 1 };

  const current = getCurrentMonthYear();
  const month = Number(asString(rawParams.month)) || current.month;
  const year = Number(asString(rawParams.year)) || current.year;
  const allTime = isSearchingAllTime(filters);

  const [accounts, categories, data, counterparties] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    getTransactionsPageData(userId, filters, month, year),
    getCounterpartySuggestions(userId),
  ]);

  const { transactions, total, totalPages, summary } = data;

  // Every link out of here keeps the month and the active filters.
  const baseParams = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (key === "page") continue;
    const v = asString(value);
    if (v) baseParams.set(key, v);
  }
  const buildPageHref = (page: number) => {
    const params = new URLSearchParams(baseParams);
    params.set("page", String(page));
    return `/transactions?${params.toString()}`;
  };
  const monthParams = new URLSearchParams(baseParams);
  monthParams.delete("month");
  monthParams.delete("year");
  const monthBasePath = monthParams.toString()
    ? `/transactions?${monthParams.toString()}`
    : "/transactions";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lançamentos"
        actions={
          <AddTransactionButton
            accounts={accounts}
            categories={categories}
            counterparties={counterparties}
          />
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {allTime ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            <Search className="h-4 w-4" />
            Buscando em todos os meses
          </div>
        ) : (
          <MonthSelector month={month} year={year} basePath={monthBasePath} />
        )}
        <p className="text-sm text-muted-foreground">
          {total} {total === 1 ? "lançamento" : "lançamentos"}
          {allTime ? "" : ` em ${formatMonthYear(month, year).toLowerCase()}`}
        </p>
      </div>

      <SummaryStrip summary={summary} />

      <FiltersBar
        accounts={accounts}
        categories={categories}
        filters={filters}
        month={month}
        year={year}
      />

      {transactions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-12 text-center">
          <ArrowLeftRight className="h-8 w-8 text-muted-foreground" />
          <p className="max-w-sm text-sm text-muted-foreground">
            {accounts.length === 0
              ? "Crie uma conta antes de registrar lançamentos."
              : allTime
                ? "Nada encontrado com esses filtros."
                : `Nenhum lançamento em ${formatMonthYear(month, year).toLowerCase()}. Use as setas acima para ver outro mês.`}
          </p>
        </div>
      ) : (
        <StatementList
          transactions={transactions}
          accounts={accounts}
          categories={categories}
          counterparties={counterparties}
        />
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-4 text-sm">
          {filters.page > 1 ? (
            <Link href={buildPageHref(filters.page - 1)} className="text-primary hover:underline">
              Anterior
            </Link>
          ) : (
            <span className="text-muted-foreground">Anterior</span>
          )}
          <span className="text-muted-foreground">
            Página {filters.page} de {totalPages} · {PAGE_SIZE} por página
          </span>
          {filters.page < totalPages ? (
            <Link href={buildPageHref(filters.page + 1)} className="text-primary hover:underline">
              Próxima
            </Link>
          ) : (
            <span className="text-muted-foreground">Próxima</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

// Totals for everything currently filtered, not just the visible page.
function SummaryStrip({
  summary,
}: {
  summary: {
    income: number;
    expense: number;
    net: number;
    scheduledIncome: number;
    scheduledExpense: number;
  };
}) {
  const items = [
    { label: "Entradas", value: summary.income, tone: "text-success", extra: summary.scheduledIncome, extraLabel: "a receber" },
    { label: "Saídas", value: summary.expense, tone: "text-danger", extra: summary.scheduledExpense, extraLabel: "a pagar" },
    {
      label: "Saldo do período",
      value: summary.net,
      tone: summary.net >= 0 ? "text-success" : "text-danger",
      extra: 0,
      extraLabel: "",
    },
  ];

  return (
    <div className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {items.map((item) => (
        <div key={item.label} className="px-4 py-3">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className={cn("text-lg font-semibold tabular-nums", item.tone)}>
            {formatCurrency(item.value)}
          </p>
          {item.extra > 0 ? (
            <p className="text-xs text-muted-foreground">
              + {formatCurrency(item.extra)} {item.extraLabel}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
