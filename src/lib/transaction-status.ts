// The one place that decides whether a transaction is realizado, previsto or
// atrasado. Every screen reads from here, so a row can never be shown as
// "pendente" in one list and "atrasada" in another.
//
// The whole model rests on a single field, Transaction.balanceApplied:
//   true  → the money moved, and Account.balance already includes it
//   false → it is only scheduled; the balance has not been touched
// "Atrasada" is not a stored state, just a pending row whose date has
// passed. That means nothing has to run on a timer to make a bill go late.

export type TransactionStatus = "paid" | "pending" | "overdue";

// Calendar-date comparison in UTC, matching how every date in this app is
// stored. Something due today is not late.
export function startOfTodayUTC(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function transactionStatus(
  transaction: { balanceApplied: boolean; date: Date | string },
  today = startOfTodayUTC()
): TransactionStatus {
  if (transaction.balanceApplied) return "paid";
  return new Date(transaction.date) < today ? "overdue" : "pending";
}

// Labels depend on direction: an expense is "paga", an income is "recebida".
export function statusLabel(status: TransactionStatus, type: string) {
  const isIncome = type === "income";
  if (status === "paid") return isIncome ? "Recebido" : "Pago";
  if (status === "overdue") return "Atrasado";
  return isIncome ? "A receber" : "A pagar";
}

export const STATUS_TONE: Record<TransactionStatus, string> = {
  paid: "bg-success-bg text-success",
  pending: "bg-warning-bg text-warning",
  overdue: "bg-danger-bg text-danger",
};

// Prisma `where` fragments, so a filter and a badge can never drift apart.
export function statusWhere(status: TransactionStatus, today = startOfTodayUTC()) {
  if (status === "paid") return { balanceApplied: true };
  if (status === "overdue") return { balanceApplied: false, date: { lt: today } };
  return { balanceApplied: false, date: { gte: today } };
}
