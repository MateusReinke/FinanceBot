// The one place that turns a due date into "how worried should I be".
//
// transaction-status.ts already answers *whether* something is settled;
// this answers *how urgent* the unsettled ones are. They are deliberately
// separate: status is a fact about the row, urgency is a fact about today.
//
// Every countdown, chip and alert in the app reads from here, so a bill can
// never say "vence amanhã" on the dashboard and "vence em 2 dias" in the
// list — a real bug in the first cut of the bills panel, which compared a
// UTC date against a local `new Date()`.

import { startOfTodayUTC } from "@/lib/transaction-status";

export type Urgency = "overdue" | "today" | "soon" | "upcoming";

// "soon" ends here. Three days is what fits the actual decision: it is long
// enough to still do something about a boleto (bank transfers clear next
// business day) and short enough that the list doesn't cry wolf.
export const SOON_DAYS = 3;

// Whole calendar days from today to `date` — negative for the past. Both
// sides are normalized to UTC midnight first, so the answer is a count of
// dates and never a fraction of a day that rounds the wrong way near
// midnight.
export function daysUntil(date: Date | string, today = startOfTodayUTC()) {
  const target = new Date(date);
  const targetMidnight = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate()
  );
  return Math.round((targetMidnight - today.getTime()) / 86_400_000);
}

export function urgencyOf(date: Date | string, today = startOfTodayUTC()): Urgency {
  const days = daysUntil(date, today);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  return days <= SOON_DAYS ? "soon" : "upcoming";
}

// Reads as a person would say it out loud. "Vence" for money going out,
// "recebe" for money coming in — an income that is late is not "atrasada
// para pagar", it is money someone still owes you.
export function dueLabel(date: Date | string, type: string, today = startOfTodayUTC()) {
  const days = daysUntil(date, today);
  const isIncome = type === "income";

  if (days < 0) {
    const late = Math.abs(days);
    const suffix = late === 1 ? "1 dia" : `${late} dias`;
    return isIncome ? `Atrasado ${suffix}` : `Venceu há ${suffix}`;
  }
  if (days === 0) return isIncome ? "Recebe hoje" : "Vence hoje";
  if (days === 1) return isIncome ? "Recebe amanhã" : "Vence amanhã";
  return isIncome ? `Recebe em ${days} dias` : `Vence em ${days} dias`;
}

// Short form for a dense list, where the row already says what it is.
export function dueLabelShort(date: Date | string, today = startOfTodayUTC()) {
  const days = daysUntil(date, today);
  if (days < 0) return `${Math.abs(days)}d atrás`;
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  return `${days}d`;
}

// Filled chips: used where the urgency is the point (the alert strip, the
// due column of a bills list).
export const URGENCY_TONE: Record<Urgency, string> = {
  overdue: "bg-danger-bg text-danger",
  today: "bg-warning-bg text-warning",
  soon: "bg-warning-bg text-warning",
  upcoming: "bg-muted text-muted-foreground",
};

// The matching left-border accent, for rows that need to read as urgent at
// a glance without a chip on every line.
export const URGENCY_ACCENT: Record<Urgency, string> = {
  overdue: "border-l-danger",
  today: "border-l-warning",
  soon: "border-l-warning",
  upcoming: "border-l-transparent",
};

// Only "overdue" and "today" earn a chip in dense lists — marking
// everything urgent is the same as marking nothing.
export function isPressing(urgency: Urgency) {
  return urgency === "overdue" || urgency === "today";
}

// Splits pending rows into the buckets every "contas a pagar" screen shows.
// Takes already-filtered pending rows; it never decides what is pending,
// which stays with transactionStatus.
export function bucketByUrgency<T extends { date: Date }>(rows: T[], today = startOfTodayUTC()) {
  const buckets: Record<Urgency, T[]> = { overdue: [], today: [], soon: [], upcoming: [] };
  for (const row of rows) buckets[urgencyOf(row.date, today)].push(row);
  return buckets;
}
