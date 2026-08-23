"use client";

import { useState } from "react";
import type { Account, Category, Transaction } from "@prisma/client";
import { Pencil, Trash2, User } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { TransactionForm } from "./transaction-form";
import { deleteTransaction } from "@/app/actions/transactions";
import { CategoryIcon } from "@/components/ui/category-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { DueChip, urgencyRail } from "@/components/ui/due-chip";
import { ConfirmButton, UndoConfirmButton } from "@/components/transactions/confirm-buttons";
import { transactionStatus, startOfTodayUTC } from "@/lib/transaction-status";
import { urgencyOf } from "@/lib/due-dates";
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
  counterparties = [],
}: {
  transactions: Row[];
  accounts: Account[];
  categories: Category[];
  counterparties?: { name: string; phone: string | null }[];
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
                <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
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

              <ul className="divide-border surface divide-y overflow-hidden">
                {group.rows.map((t) => {
                  const status = transactionStatus(t, today);
                  const isExpense = t.type === "expense";
                  const color = t.category?.color ?? "#94a3b8";
                  const pending = status !== "paid";
                  return (
                    <li
                      key={t.id}
                      className={cn(
                        "group flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 sm:px-4",
                        pending && urgencyRail(urgencyOf(t.date, today)),
                        status === "overdue" && "bg-danger-bg/20"
                      )}
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${color}20`, color }}
                      >
                        <CategoryIcon icon={t.category?.icon} className="h-4 w-4" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-foreground truncate text-sm font-medium">
                            {t.description}
                          </p>
                          {pending ? <StatusBadge status={status} type={t.type} /> : null}
                          {pending ? <DueChip date={t.date} type={t.type} /> : null}
                        </div>
                        <p className="text-muted-foreground truncate text-xs">
                          {t.category?.name ?? "Sem categoria"} · {t.account.name}
                          {/* Plain inline, not inline-flex: a flex container
                              collapses the leading space of the " · " and the
                              separator ends up glued to the account name. */}
                          {t.counterparty ? (
                            <span>
                              {" · "}
                              <User className="mr-0.5 inline h-3 w-3 align-[-1px]" />
                              {t.counterparty}
                            </span>
                          ) : null}
                        </p>
                      </div>

                      {/* Amount and actions share a line that goes full-width
                          on a phone, so the description above keeps the whole
                          first line to itself. */}
                      <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                        <span
                          className={cn(
                            "shrink-0 text-sm font-semibold tabular-nums",
                            pending
                              ? "text-muted-foreground"
                              : isExpense
                                ? "text-danger"
                                : "text-success"
                          )}
                        >
                          {isExpense ? "−" : "+"}
                          {formatCurrency(t.amount)}
                        </span>

                        {/* The confirm button is always visible — it is the most
                          used action in the app and was previously hidden
                          behind a hover, which put it out of reach entirely on
                          a phone. Edit and delete stay quiet until hovered. */}
                        <div className="flex shrink-0 items-center gap-1">
                          {/* Confirm and undo are peers, and both stay at full
                            opacity: undo is a recovery action, and burying it
                            in the hover group made a mis-click on "Paguei"
                            feel permanent. Edit and delete stay quiet. */}
                          {pending ? (
                            <ConfirmButton id={t.id} type={t.type} />
                          ) : (
                            <UndoConfirmButton id={t.id} type={t.type} />
                          )}
                          <div className="flex items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <button
                              onClick={() => setEditing(t)}
                              className="text-muted-foreground hover:bg-muted cursor-pointer rounded-md p-1.5"
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
                                className="text-muted-foreground hover:bg-danger-bg hover:text-danger cursor-pointer rounded-md p-1.5"
                                aria-label="Excluir lançamento"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </form>
                          </div>
                        </div>
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
            counterparties={counterparties}
            onSuccess={() => setEditing(null)}
          />
        ) : null}
      </Modal>
    </>
  );
}
