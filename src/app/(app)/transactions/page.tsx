import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { TransactionFiltersSchema } from "@/lib/validation/transactions";
import { FiltersBar } from "./filters-bar";
import { AddTransactionButton } from "./add-transaction-button";
import { TransactionRow } from "./transaction-row";
import { ArrowLeftRight } from "lucide-react";

export const metadata: Metadata = { title: "Transações — FinanceBot" };

const PAGE_SIZE = 25;

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
    from: asString(rawParams.from),
    to: asString(rawParams.to),
    q: asString(rawParams.q),
    page: asString(rawParams.page),
  });
  const filters = parsed.success ? parsed.data : { page: 1 };

  const where: Prisma.TransactionWhereInput = { userId };
  if (filters.accountId) where.accountId = filters.accountId;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.type) where.type = filters.type;
  if (filters.q) where.description = { contains: filters.q };
  if (filters.from || filters.to) {
    where.date = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}),
    };
  }

  const [accounts, categories, total, transactions] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: { account: true, category: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageParams = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (key === "page") continue;
    const v = asString(value);
    if (v) pageParams.set(key, v);
  }
  const buildPageHref = (page: number) => {
    const params = new URLSearchParams(pageParams);
    params.set("page", String(page));
    return `/transactions?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Transações</h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "transação encontrada" : "transações encontradas"}
          </p>
        </div>
        <AddTransactionButton accounts={accounts} categories={categories} />
      </div>

      <FiltersBar accounts={accounts} categories={categories} filters={filters} />

      {transactions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-10 text-center">
          <ArrowLeftRight className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {accounts.length === 0
              ? "Crie uma conta antes de registrar transações."
              : "Nenhuma transação encontrada."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-3">Data</th>
                <th className="px-3 py-3">Descrição</th>
                <th className="px-3 py-3">Categoria</th>
                <th className="px-3 py-3">Conta</th>
                <th className="px-3 py-3 text-right">Valor</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <TransactionRow key={t.id} transaction={t} accounts={accounts} categories={categories} />
              ))}
            </tbody>
          </table>
        </div>
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
            Página {filters.page} de {totalPages}
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
