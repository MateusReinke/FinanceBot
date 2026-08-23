"use client";

import { useState } from "react";
import Link from "next/link";
import type { Account, Category } from "@prisma/client";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Select, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Search is always visible because it is what people reach for; the six
// dropdowns are folded behind "Filtros" and only expand when something is
// actually filtered. The old bar put all seven controls on screen at all
// times and pushed the list itself below the fold.
export function FiltersBar({
  accounts,
  categories,
  filters,
  month,
  year,
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
  month: number;
  year: number;
}) {
  const advanced = ["accountId", "categoryId", "type", "status", "from", "to"] as const;
  const activeCount = advanced.filter((k) => filters[k]).length;
  const [open, setOpen] = useState(activeCount > 0);
  const hasAny = activeCount > 0 || Boolean(filters.q);

  return (
    <form method="get" className="space-y-3">
      {/* Keeps the browsed month across a search submit. */}
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="year" value={year} />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            type="search"
            name="q"
            placeholder="Buscar em todos os meses..."
            defaultValue={filters.q ?? ""}
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          variant={activeCount > 0 ? "secondary" : "outline"}
          onClick={() => setOpen((v) => !v)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
          {activeCount > 0 ? (
            <span className="bg-primary text-primary-foreground ml-1 rounded-full px-1.5 text-xs">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </div>

      {open ? (
        <div className="surface grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
          <Select name="type" defaultValue={filters.type ?? ""} aria-label="Tipo">
            <option value="">Todos os tipos</option>
            <option value="expense">Despesas</option>
            <option value="income">Receitas</option>
          </Select>
          <Select name="status" defaultValue={filters.status ?? ""} aria-label="Situação">
            <option value="">Toda situação</option>
            <option value="paid">Realizados</option>
            <option value="pending">A pagar/receber</option>
            <option value="overdue">Atrasados</option>
          </Select>
          <Select name="accountId" defaultValue={filters.accountId ?? ""} aria-label="Conta">
            <option value="">Todas as contas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Select name="categoryId" defaultValue={filters.categoryId ?? ""} aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input type="date" name="from" defaultValue={filters.from ?? ""} aria-label="De" />
          <Input type="date" name="to" defaultValue={filters.to ?? ""} aria-label="Até" />

          <div className="col-span-2 flex items-center gap-3 sm:col-span-3">
            <Button type="submit" variant="secondary" size="sm">
              Aplicar
            </Button>
            {hasAny ? (
              <Link
                href="/transactions"
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
              >
                <X className="h-3.5 w-3.5" /> Limpar
              </Link>
            ) : null}
            <p className="text-muted-foreground ml-auto text-xs">
              Um período preenchido aqui substitui o mês selecionado.
            </p>
          </div>
        </div>
      ) : null}
    </form>
  );
}
