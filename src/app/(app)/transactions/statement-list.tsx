"use client";

import { useState } from "react";
import type { Account, Category, Transaction } from "@prisma/client";
import { Pencil, Trash2, Check } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { TransactionForm } from "./transaction-form";
import { deleteTransaction, confirmTransaction } from "@/app/actions/transactions";
import { CategoryIcon } from "@/components/ui/category-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { transactionStatus, startOfTodayUTC } from "@/lib/transaction-status";
import { formatCurrency, cn } from "@/lib/utils";

type Row = Transaction & { account: Account; category: Category | null };

// Grouped by day like a bank statement, instead of a six-column table that
// repeated the same date and account on every line and needed 720px of
// horizontal scroll on a phone. The date becomes a heading (with its own
// daily total), and each entry reads as one line.
const dayFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

function dayKey(date: Date) {
  return new Date(date).toISOString().slice(0, 10);
}

function dayLabel(date: Date, today: Date) {
  const diff = Math.round((new Date(dayKey(date)).getTime() - today.getTime()) / 86_400_000);
  const label = dayFormatter.format(new Date(date));
  const pretty = label.charAt(0).toUpperCase() + label.slice(1);
  if (diff === 0) return `Hoje · ${pretty}`;
  if (diff === -1) return `Ontem · ${pretty}`;
  if (diff === 1) return `Amanhã · ${pretty}`;
  return pretty;
}

export function StatementList({
  transactions,
  accounts,
  categories,
}: {
  transactions: Row[];
  accounts: Account[];
  categories: Category[];
}) {
  const [editing, setEditing] = useState<Row | null>(null);
  const today = startOfTodayUTC();

  const groups: { key: string; date: Date; rows: Row[] }[] = [];
  for (const t of transactions) {
    const key = dayKey(t.date);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.rows.push(t);
    else groups.push({ key, date: t.date, rows: [t] });
  }

  return (
    <>
      <div className="space-y-5">
        {groups.map((group) => {
          const dayNet = group.rows.reduce(
            (sum, t) => sum + (t.type === "expense" ? -t.amount : t.amount),
            0
          );
          return (
            <section key={group.key}>
              <header className="flex items-baseline justify-between gap-3 px-1 pb-1.5">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {dayLabel(group.date, today)}
                </h3>
                <span
                  className={cn(
                    "text-xs font-medium tabular-nums",
                    dayNet < 0 ? "text-muted-foreground" : "text-success"
                  )}
                >
                  {dayNet > 0 ? "+" : ""}
                  {formatCurrency(dayNet)}
                </span>
              </header>

              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {group.rows.map((t) => {
                  const status = transactionStatus(t, today);
                  const isExpense = t.type === "expense";
                  const color = t.category?.color ?? "#94a3b8";
                  return (
                    <li key={t.id} className="group flex items-center gap-3 px-3 py-3 sm:px-4">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${color}20`, color }}
                      >
                        <CategoryIcon icon={t.category?.icon} className="h-4 w-4" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {t.description}
                          </p>
                          {status === "paid" ? null : <StatusBadge status={status} type={t.type} />}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {t.category?.name ?? "Sem categoria"} · {t.account.name}
                        </p>
                      </div>

                      <span
                        className={cn(
                          "shrink-0 text-sm font-semibold tabular-nums",
                          status !== "paid"
                            ? "text-muted-foreground"
                            : isExpense
                              ? "text-danger"
                              : "text-success"
                        )}
                      >
                        {isExpense ? "−" : "+"}
                        {formatCurrency(t.amount)}
                      </span>

                      {/* Revealed on hover/focus so the list stays calm, but
                          always present for keyboard and touch users. */}
                      <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        {status !== "paid" ? (
                          <form action={confirmTransaction}>
                            <input type="hidden" name="id" value={t.id} />
                            <button
                              type="submit"
                              className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-success-bg hover:text-success"
                              title={isExpense ? "Confirmar pagamento" : "Confirmar recebimento"}
                              aria-label={isExpense ? "Confirmar pagamento" : "Confirmar recebimento"}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          </form>
                        ) : null}
                        <button
                          onClick={() => setEditing(t)}
                          className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                          aria-label="Editar lançamento"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <form
                          action={deleteTransaction}
                          onSubmit={(e) => {
                            if (!confirm("Excluir este lançamento?")) e.preventDefault();
                          }}
                        >
                          <input type="hidden" name="id" value={t.id} />
                          <button
                            type="submit"
                            className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-danger-bg hover:text-danger"
                            aria-label="Excluir lançamento"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Editar lançamento">
        {editing ? (
          <TransactionForm
            transaction={editing}
            accounts={accounts}
            categories={categories}
            onSuccess={() => setEditing(null)}
          />
        ) : null}
      </Modal>
    </>
  );
}
