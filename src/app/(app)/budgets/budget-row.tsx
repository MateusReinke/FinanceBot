"use client";

import { useState } from "react";
import type { Budget, Category } from "@prisma/client";
import { Pencil, Trash2, Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { BudgetForm } from "./budget-form";
import { deleteBudget } from "@/app/actions/budgets";
import { CategoryIcon } from "@/components/ui/category-icon";
import { formatCurrency, cn } from "@/lib/utils";

export function BudgetRow({
  category,
  budget,
  spent,
  scheduled = 0,
  month,
  year,
}: {
  category: Category;
  budget: Budget | null;
  spent: number;
  // Already scheduled for this month but not paid yet — shown apart from
  // `spent` so an unpaid bill never looks like money already gone.
  scheduled?: number;
  month: number;
  year: number;
}) {
  const [open, setOpen] = useState(false);
  const pct = budget && budget.amount > 0 ? Math.min(100, (spent / budget.amount) * 100) : 0;
  const over = budget ? spent > budget.amount : false;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${category.color}20`, color: category.color }}
        >
          <CategoryIcon icon={category.icon} className="h-4 w-4" />
        </span>
        <span className="flex-1 text-sm font-medium text-foreground">{category.name}</span>

        {budget ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setOpen(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted cursor-pointer"
              aria-label="Editar orçamento"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <form
              action={deleteBudget}
              onSubmit={(e) => {
                if (!confirm(`Remover o orçamento de ${category.name}?`)) e.preventDefault();
              }}
            >
              <input type="hidden" name="id" value={budget.id} />
              <button
                type="submit"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-danger-bg hover:text-danger cursor-pointer"
                aria-label="Remover orçamento"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Definir
          </button>
        )}
      </div>

      {budget ? (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className={cn(over ? "text-danger" : "text-muted-foreground")}>
              {formatCurrency(spent)} de {formatCurrency(budget.amount)}
            </span>
            <span className={cn("font-medium", over ? "text-danger" : "text-muted-foreground")}>
              {pct.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", over ? "bg-danger" : "bg-primary")}
              style={{ width: `${pct}%` }}
            />
          </div>
          {scheduled > 0 ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              + {formatCurrency(scheduled)} já agendados para este mês
            </p>
          ) : null}
        </div>
      ) : spent > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {formatCurrency(spent)} gastos neste mês, sem orçamento definido.
        </p>
      ) : null}

      <Modal open={open} onClose={() => setOpen(false)} title="Orçamento mensal">
        <BudgetForm
          category={category}
          amount={budget?.amount}
          month={month}
          year={year}
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </div>
  );
}
