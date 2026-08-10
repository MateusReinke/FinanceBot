import "server-only";
import { prisma } from "@/lib/prisma";
import {
  addIntervalUTC,
  recurringHorizon,
  toFrequency,
  RECURRING_HORIZON_MONTHS,
  type Frequency,
} from "@/lib/recurrence";
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

// Keeps every open-ended entry materialized exactly RECURRING_HORIZON_MONTHS
// ahead — no further, no less. Two halves:
//
//  - Extend: append the occurrences that time has brought inside the window.
//    This is what makes "sem data pra acabar" actually endless while only
//    ever holding two years of rows.
//  - Trim: drop unpaid occurrences that sit beyond the window. This is what
//    reclaims schedules created before the window existed (they ran ~30
//    years out) and it is safe for the same reason skipping is: a pending
//    occurrence never touched Account.balance.
//
// Only isRecurring entries are touched. A real parcelamento has a promised
// number of installments and the user must be able to see all of them.
// A canceled entry is skipped, or "Encerrar" would immediately be undone.
export async function maintainRecurringSchedules(userId: string) {
  const horizon = recurringHorizon();

  const financings = await prisma.financing.findMany({
    where: { userId, isRecurring: true, canceledAt: null },
    select: {
      id: true, accountId: true, categoryId: true, description: true, type: true,
      installmentAmount: true, frequency: true, firstDueDate: true,
    },
  });
  if (financings.length === 0) return;

  const ids = financings.map((f) => f.id);

  // Trim first, so the edges read below already reflect the window.
  const trimmed = await prisma.transaction.deleteMany({
    where: { financingId: { in: ids }, date: { gt: horizon }, balanceApplied: false },
  });

  // One grouped read for every entry's furthest occurrence — no per-entry
  // query. This function runs on every request, so the do-nothing path has
  // to stay two queries flat.
  const edges = await prisma.transaction.groupBy({
    by: ["financingId"],
    where: { financingId: { in: ids } },
    _max: { date: true, installmentNumber: true },
  });
  const edgeById = new Map(edges.map((e) => [e.financingId, e._max]));

  for (const f of financings) {
    const edge = edgeById.get(f.id);
    const furthest = edge?.date ?? null;
    if (furthest && furthest >= horizon) continue;

    const frequency = toFrequency(f.frequency);
    let number = edge?.installmentNumber ?? 0;
    // With nothing materialized yet (a brand-new entry, or one whose every
    // occurrence was just trimmed) the first due date is itself the next
    // occurrence; otherwise pick up one interval past the furthest one.
    let candidate = furthest ? addIntervalUTC(furthest, frequency, 1) : f.firstDueDate;

    const rows = [];
    // `<= horizon`, never `<`: appending one occurrence past the horizon
    // would be deleted by the trim at the top of the next run, and
    // re-appended by this loop, forever.
    while (candidate <= horizon && rows.length < MAX_APPEND_PER_RUN) {
      number += 1;
      rows.push({
        userId,
        accountId: f.accountId,
        categoryId: f.categoryId,
        description: f.description,
        amount: f.installmentAmount,
        date: candidate,
        type: f.type,
        installmentNumber: number,
        balanceApplied: false,
        financingId: f.id,
      });
      candidate = addIntervalUTC(candidate, frequency, 1);
    }

    if (rows.length > 0) {
      // skipDuplicates so a concurrent request that got here first (two tabs
      // loading at once) collides on (financingId, installmentNumber)
      // harmlessly instead of failing the page.
      await prisma.transaction.createMany({ data: rows, skipDuplicates: true });
      await prisma.financing.update({ where: { id: f.id }, data: { installmentCount: number } });
    }
  }

  if (trimmed.count > 0) {
    console.info(`Removidas ${trimmed.count} ocorrências além do horizonte de ${RECURRING_HORIZON_MONTHS} meses`);
  }
}

// A weekly entry needs ~110 rows to cover the whole window from scratch;
// this leaves room for that while capping a single pass.
const MAX_APPEND_PER_RUN = 130;

export { RECURRING_HORIZON_MONTHS };
