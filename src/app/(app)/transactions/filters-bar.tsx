import Link from "next/link";
import type { Account, Category } from "@prisma/client";
import { Select, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function FiltersBar({
  accounts,
  categories,
  filters,
}: {
  accounts: Account[];
  categories: Category[];
  filters: {
    accountId?: string;
    categoryId?: string;
    type?: string;
    status?: string;
    from?: string;
    to?: string;
    q?: string;
  };
}) {
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <form method="get" className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3 lg:grid-cols-7">
      <div className="col-span-2 sm:col-span-1">
        <Select name="type" defaultValue={filters.type ?? ""}>
          <option value="">Todos os tipos</option>
          <option value="expense">Despesas</option>
          <option value="income">Receitas</option>
        </Select>
      </div>
      <div>
        <Select name="status" defaultValue={filters.status ?? ""}>
          <option value="">Toda situação</option>
          <option value="paid">Realizados</option>
          <option value="pending">A pagar/receber</option>
          <option value="overdue">Atrasados</option>
        </Select>
      </div>
      <div>
        <Select name="accountId" defaultValue={filters.accountId ?? ""}>
          <option value="">Todas as contas</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Select name="categoryId" defaultValue={filters.categoryId ?? ""}>
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <Input type="date" name="from" defaultValue={filters.from ?? ""} aria-label="Data inicial" />
      <Input type="date" name="to" defaultValue={filters.to ?? ""} aria-label="Data final" />
      <Input
        type="search"
        name="q"
        placeholder="Buscar descrição..."
        defaultValue={filters.q ?? ""}
        className="col-span-2 sm:col-span-3 lg:col-span-1"
      />
      <div className="col-span-2 flex items-center gap-4 sm:col-span-3 lg:col-span-6">
        <Button type="submit" variant="secondary" size="sm">
          Filtrar
        </Button>
        {hasFilters ? (
          <Link href="/transactions" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
            Limpar filtros
          </Link>
        ) : null}
      </div>
    </form>
  );
}
