"use client";

import { Receipt, Trash2, Lock } from "lucide-react";
import { deleteExpense } from "@/app/actions/events";
import { displayName } from "@/lib/display-name";
import { formatCurrency, formatDate } from "@/lib/utils";

type Person = { id: string; name: string; email: string };
type Split = { userId: string; amount: number; user: Person };
type Payment = { userId: string; amount: number; user: Person };
type Expense = {
  id: string;
  description: string;
  amount: number;
  date: Date;
  isShared: boolean;
  receiptId: string | null;
  payments: Payment[];
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
  // Reads naturally in the three shapes that actually occur: one payer,
  // two payers, or a crowd.
  const payerSummary =
    expense.payments.length === 1
      ? displayName(expense.payments[0].user, currentUserId)
      : expense.payments.length === 2
        ? expense.payments.map((p) => displayName(p.user, currentUserId)).join(" e ")
        : `${expense.payments.length} pessoas`;

  const splitSummary = !expense.isShared
    ? "só sua"
    : expense.splits.length <= 1
      ? `só para ${displayName(expense.splits[0]?.user ?? expense.payments[0]?.user, currentUserId)}`
      : `dividido entre ${expense.splits.length}`;

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-foreground truncate text-sm font-medium">{expense.description}</p>
          {!expense.isShared ? (
            <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap">
              <Lock className="h-3 w-3" /> Pessoal
            </span>
          ) : null}
        </div>
        <p className="text-muted-foreground text-xs">
          {formatDate(expense.date)} · Pago por {payerSummary} · {splitSummary}
        </p>
      </div>
      <span className="text-foreground shrink-0 text-sm font-semibold">
        {formatCurrency(expense.amount)}
      </span>
      {expense.receiptId ? (
        <a
          href={`/api/events/${eventId}/receipts/${expense.receiptId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 cursor-pointer rounded-md p-1.5"
          aria-label="Ver nota fiscal"
          title="Ver nota fiscal"
        >
          <Receipt className="h-3.5 w-3.5" />
        </a>
      ) : null}
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
          className="text-muted-foreground hover:bg-danger-bg hover:text-danger cursor-pointer rounded-md p-1.5"
          aria-label="Excluir despesa"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </form>
    </li>
  );
}
