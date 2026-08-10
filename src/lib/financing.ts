import "server-only";
import { prisma } from "@/lib/prisma";
import { addIntervalUTC, type Frequency } from "@/lib/recurrence";
import { signedAmount } from "@/lib/utils";

export type ScheduledInstallment = {
  installmentNumber: number;
  date: Date;
  amount: number;
  balanceApplied: boolean;
};

// Pure: computes the N installment dates from the first due date, one per
// `frequency` step (monthly, a cada 15 dias, ...), and marks each one as
// already-applied if its date is due (<= now) at schedule-build time.
//
// `autoSettle: false` is the "eu confirmo cada pagamento" mode — nothing is
// ever pre-applied for it, not even a backdated occurrence, since the whole
// point is that the money only moves when the user says it moved. For
// autoSettle: true, a backdated first payment can legitimately mean
// installments 1, 2 and 3 are all already due on day one, which mirrors the
// rule reconcileDueInstallments uses for everything that comes due later.
export function buildInstallmentSchedule(
  firstDueDate: Date,
  installmentCount: number,
  installmentAmount: number,
  frequency: Frequency,
  autoSettle = true
): ScheduledInstallment[] {
  const now = new Date();
  return Array.from({ length: installmentCount }, (_, i) => {
    const date = addIntervalUTC(firstDueDate, frequency, i);
    return {
      installmentNumber: i + 1,
      date,
      amount: installmentAmount,
      balanceApplied: autoSettle && date <= now,
    };
  });
}

// How one installment reads in the transactions list. A recurring gasto
// fixo has no meaningful "3 de 360", so it just carries its own name.
export function installmentDescription(
  description: string,
  isRecurring: boolean,
  installmentNumber: number,
  installmentCount: number
) {
  return isRecurring ? description : `Parcela ${installmentNumber}/${installmentCount} — ${description}`;
}

// Applies the balance effect of any installment that has become due since it
// was created, and marks it applied so it's never double-counted. Cheap
// no-op in the common case (nothing due). There's no cron in this app, so
// this is called from verifySession() — the one function every page and
// server action already awaits first — rather than relying on a layout,
// since Next renders layouts and pages in parallel with no happens-before
// guarantee between them.
//
// Only installments of an autoSettle financing are swept up here. One with
// autoSettle: false is a bill the user pays by hand: it stays pending past
// its due date (that's exactly what makes it show as "atrasada") until
// payInstallmentNow confirms it.
export async function reconcileDueInstallments(userId: string) {
  const due = await prisma.transaction.findMany({
    where: {
      userId,
      financingId: { not: null },
      balanceApplied: false,
      date: { lte: new Date() },
      financing: { autoSettle: true },
    },
    select: { id: true, accountId: true, amount: true, type: true },
  });

  if (due.length === 0) return;

  // Signed, so a receita fixa (salário) credits the account and a gasto
  // fixo debits it, through the exact same path.
  const deltaByAccount = new Map<string, number>();
  for (const t of due) {
    deltaByAccount.set(t.accountId, (deltaByAccount.get(t.accountId) ?? 0) + signedAmount(t.amount, t.type));
  }

  await prisma.$transaction([
    ...Array.from(deltaByAccount.entries()).map(([accountId, delta]) =>
      prisma.account.update({ where: { id: accountId }, data: { balance: { increment: delta } } })
    ),
    prisma.transaction.updateMany({
      where: { id: { in: due.map((t) => t.id) } },
      data: { balanceApplied: true },
    }),
  ]);
}
