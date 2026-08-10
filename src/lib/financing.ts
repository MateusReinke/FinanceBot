import "server-only";
import { prisma } from "@/lib/prisma";
import { addIntervalUTC, type Frequency } from "@/lib/recurrence";

export type ScheduledInstallment = {
  installmentNumber: number;
  date: Date;
  amount: number;
  balanceApplied: boolean;
};

// Pure: computes the N installment dates from the first due date, one per
// `frequency` step (monthly, a cada 15 dias, ...), and marks
// each one as already-applied if its date is due (<= now) at schedule-build
// time. Used both when creating a Financing (a backdated first payment can
// mean installments 1, 2, and 3 are all already due on day one, not just
// the first one) and implicitly mirrors the rule reconcileDueInstallments
// uses for everything that becomes due later.
export function buildInstallmentSchedule(
  firstDueDate: Date,
  installmentCount: number,
  installmentAmount: number,
  frequency: Frequency
): ScheduledInstallment[] {
  const now = new Date();
  return Array.from({ length: installmentCount }, (_, i) => {
    const date = addIntervalUTC(firstDueDate, frequency, i);
    return {
      installmentNumber: i + 1,
      date,
      amount: installmentAmount,
      balanceApplied: date <= now,
    };
  });
}

// Applies the balance effect of any financing installment that has become
// due since it was created, and marks it applied so it's never double-
// counted. Cheap no-op in the common case (nothing due). There's no cron in
// this app, so this is called from verifySession() — the one function every
// page and server action already awaits first — rather than relying on a
// layout, since Next renders layouts and pages in parallel with no
// happens-before guarantee between them.
export async function reconcileDueInstallments(userId: string) {
  const due = await prisma.transaction.findMany({
    where: { userId, financingId: { not: null }, balanceApplied: false, date: { lte: new Date() } },
    select: { id: true, accountId: true, amount: true },
  });

  if (due.length === 0) return;

  const deltaByAccount = new Map<string, number>();
  for (const t of due) {
    deltaByAccount.set(t.accountId, (deltaByAccount.get(t.accountId) ?? 0) + t.amount);
  }

  await prisma.$transaction([
    ...Array.from(deltaByAccount.entries()).map(([accountId, sum]) =>
      prisma.account.update({ where: { id: accountId }, data: { balance: { decrement: sum } } })
    ),
    prisma.transaction.updateMany({
      where: { id: { in: due.map((t) => t.id) } },
      data: { balanceApplied: true },
    }),
  ]);
}
