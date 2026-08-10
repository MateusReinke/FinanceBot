"use client";

import { useState } from "react";
import type { Account, Category, Transaction } from "@prisma/client";
import { Pencil, Trash2, Check } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { TransactionForm } from "./transaction-form";
import { deleteTransaction, confirmTransaction } from "@/app/actions/transactions";
import { CategoryIcon } from "@/components/ui/category-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { transactionStatus } from "@/lib/transaction-status";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

type TransactionWithRelations = Transaction & {
  account: Account;
  category: Category | null;
};

export function TransactionRow({
  transaction,
  accounts,
  categories,
}: {
  transaction: TransactionWithRelations;
  accounts: Account[];
  categories: Category[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const isExpense = transaction.type === "expense";
  const status = transactionStatus(transaction);

  return (
    <tr className="border-b border-border last:border-0">
      <td className="whitespace-nowrap px-3 py-3 text-sm text-muted-foreground">
        {formatDate(transaction.date)}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{transaction.description}</p>
          {status === "paid" ? null : <StatusBadge status={status} type={transaction.type} />}
        </div>
        {transaction.notes ? (
          <p className="truncate text-xs text-muted-foreground">{transaction.notes}</p>
        ) : null}
      </td>
      <td className="whitespace-nowrap px-3 py-3">
        {transaction.category ? (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium" style={{ backgroundColor: `${transaction.category.color}20`, color: transaction.category.color }}>
            <CategoryIcon icon={transaction.category.icon} className="h-3 w-3" />
            {transaction.category.name}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Sem categoria</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-sm text-muted-foreground">
        {transaction.account.name}
      </td>
      <td
        className={cn(
          "whitespace-nowrap px-3 py-3 text-right text-sm font-semibold",
          status !== "paid" ? "text-muted-foreground" : isExpense ? "text-danger" : "text-success"
        )}
      >
        {isExpense ? "-" : "+"}
        {formatCurrency(transaction.amount)}
      </td>
      <td className="whitespace-nowrap px-3 py-3">
        <div className="flex items-center justify-end gap-1">
          {status !== "paid" ? (
            <form action={confirmTransaction}>
              <input type="hidden" name="id" value={transaction.id} />
              <button
                type="submit"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-success-bg hover:text-success cursor-pointer"
                aria-label={isExpense ? "Confirmar pagamento" : "Confirmar recebimento"}
                title={isExpense ? "Confirmar pagamento" : "Confirmar recebimento"}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </form>
          ) : null}
          <button
            onClick={() => setEditOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted cursor-pointer"
            aria-label="Editar transação"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <form
            action={deleteTransaction}
            onSubmit={(e) => {
              if (!confirm("Excluir esta transação?")) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={transaction.id} />
            <button
              type="submit"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-danger-bg hover:text-danger cursor-pointer"
              aria-label="Excluir transação"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </td>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar transação">
        <TransactionForm
          transaction={transaction}
          accounts={accounts}
          categories={categories}
          onSuccess={() => setEditOpen(false)}
        />
      </Modal>
    </tr>
  );
}
