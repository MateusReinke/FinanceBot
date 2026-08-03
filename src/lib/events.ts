export type ExpenseForBalance = {
  amount: number;
  paidById: string;
  splits: { userId: string; amount: number }[];
};

export type Balance = { userId: string; paid: number; owed: number; net: number };

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

// Splits a total into per-participant cent amounts that always sum exactly
// back to the total (the remainder cents go to the first N participants),
// avoiding the classic "33.33 x 3 = 99.99" floating point drift.
export function splitEqually(totalAmount: number, participantIds: string[]): Record<string, number> {
  const totalCents = Math.round(totalAmount * 100);
  const n = participantIds.length;
  const baseCents = Math.floor(totalCents / n);
  const remainder = totalCents - baseCents * n;

  const result: Record<string, number> = {};
  participantIds.forEach((id, i) => {
    const cents = baseCents + (i < remainder ? 1 : 0);
    result[id] = cents / 100;
  });
  return result;
}

// Keyed by userId, including anyone who ever paid or owed in this event's
// history even if they've since left — the shared ledger must stay accurate
// for them regardless of current membership.
export function computeBalances(expenses: ExpenseForBalance[]): Map<string, Balance> {
  const balances = new Map<string, { paid: number; owed: number }>();
  function ensure(id: string) {
    if (!balances.has(id)) balances.set(id, { paid: 0, owed: 0 });
    return balances.get(id)!;
  }

  for (const expense of expenses) {
    ensure(expense.paidById).paid += expense.amount;
    for (const split of expense.splits) {
      ensure(split.userId).owed += split.amount;
    }
  }

  const result = new Map<string, Balance>();
  for (const [userId, { paid, owed }] of balances) {
    result.set(userId, { userId, paid: round2(paid), owed: round2(owed), net: round2(paid - owed) });
  }
  return result;
}

export type Settlement = { from: string; to: string; amount: number };

// Greedy debt simplification: repeatedly match the biggest debtor with the
// biggest creditor. Not always the mathematically minimal transaction count,
// but simple, deterministic, and good enough for a friend group's tab.
export function suggestSettlements(balances: Balance[]): Settlement[] {
  const EPSILON = 0.005;
  const creditors = balances
    .filter((b) => b.net > EPSILON)
    .map((b) => ({ userId: b.userId, remaining: b.net }))
    .sort((a, b) => b.remaining - a.remaining);
  const debtors = balances
    .filter((b) => b.net < -EPSILON)
    .map((b) => ({ userId: b.userId, remaining: -b.net }))
    .sort((a, b) => b.remaining - a.remaining);

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].remaining, creditors[j].remaining);
    if (amount > EPSILON) {
      settlements.push({ from: debtors[i].userId, to: creditors[j].userId, amount: round2(amount) });
    }
    debtors[i].remaining -= amount;
    creditors[j].remaining -= amount;
    if (debtors[i].remaining <= EPSILON) i++;
    if (creditors[j].remaining <= EPSILON) j++;
  }
  return settlements;
}
