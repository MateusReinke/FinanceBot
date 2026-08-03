"use client";

import { Trash2 } from "lucide-react";
import { deleteExpense } from "@/app/actions/events";
import { displayName } from "@/lib/display-name";
import { formatCurrency, formatDate } from "@/lib/utils";

type Split = { userId: string; amount: number; user: { id: string; name: string; email: string } };
type Expense = {
  id: string;
  description: string;
  amount: number;
  date: Date;
  paidBy: { id: string; name: string; email: string };
  splits: Split[];
};

export function ExpenseRow({
  eventId,
  expense,
  currentUserId,
}: {
  eventId: string;
  expense: Expense;
  currentUserId: string;
}) {
  const splitSummary =
    expense.splits.length <= 1
      ? displayName(expense.splits[0]?.user ?? expense.paidBy, currentUserId)
      : `dividido entre ${expense.splits.length} pessoas`;

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{expense.description}</p>
        <p className="text-xs text-muted-foreground">
          {formatDate(expense.date)} · Pago por {displayName(expense.paidBy, currentUserId)} ·{" "}
          {splitSummary}
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold text-foreground">
        {formatCurrency(expense.amount)}
      </span>
      <form
        action={deleteExpense}
        onSubmit={(e) => {
          if (!confirm(`Excluir a despesa "${expense.description}"?`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="expenseId" value={expense.id} />
        <button
          type="submit"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-danger-bg hover:text-danger cursor-pointer"
          aria-label="Excluir despesa"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </form>
    </li>
  );
}
