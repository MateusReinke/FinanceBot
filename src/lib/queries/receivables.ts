import "server-only";
import { prisma } from "@/lib/prisma";
import { startOfTodayUTC } from "@/lib/transaction-status";
import { urgencyOf } from "@/lib/due-dates";

// "Quem me deve, quanto, e desde quando" — the receivables side of the app.
//
// Built on the same pending Transaction rows as everything else rather than
// a separate "loans" table: an amount someone owes you IS income you have
// scheduled and not yet received, and giving it its own table would have
// meant every balance, forecast and month total needed teaching about a
// second source of money.
//
// The grouping key is Transaction.counterparty. Rows without one are still
// returned, under a null group, because "a receber" that you forgot to name
// is exactly the thing you most need reminding about.

export type PartialReceipt = {
  id: string;
  amount: number;
  date: Date;
};

export type ReceivableRow = {
  id: string;
  description: string;
  // What is still owed on this entry — already net of anything received in
  // part, because a partial receipt physically takes its value out of this
  // row (see settlePartialAmount). It is "o que falta", not the original.
  amount: number;
  date: Date;
  counterparty: string | null;
  counterpartyPhone: string | null;
  chargedAt: Date | null;
  accountName: string;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  // Everything already received against this entry, and what it added up to
  // before any of it came in (`amount + received`). Both are zero/equal for
  // the ordinary entry nobody has paid a slice of.
  received: number;
  original: number;
  partials: PartialReceipt[];
};

export type ReceivableGroup = {
  // Null for the "sem nome" group, which the UI labels rather than hides.
  counterparty: string | null;
  phone: string | null;
  rows: ReceivableRow[];
  // Still owed by this person, what they have already handed over against
  // these same entries, and the two added together.
  total: number;
  receivedTotal: number;
  originalTotal: number;
  overdueTotal: number;
  overdueCount: number;
  // The nearest due date in the group — what the list sorts on, so whoever
  // needs chasing first is at the top.
  nextDate: Date;
  // True when every row in the group is already late. Reads differently from
  // "has one late row": this person has stopped paying, not slipped once.
  allOverdue: boolean;
};

export async function getReceivables(userId: string) {
  const today = startOfTodayUTC();

  const pending = await prisma.transaction.findMany({
    where: { userId, type: "income", balanceApplied: false },
    include: {
      account: { select: { name: true } },
      category: { select: { name: true, color: true, icon: true } },
      // The slices of this entry that have already been received. Cheap to
      // include (indexed on partialOfId, and empty for almost every row)
      // and it is what lets the list say "R$ 500 de R$ 1.500 já recebido"
      // instead of quietly showing a smaller number than the user lent.
      partials: {
        select: { id: true, amount: true, date: true },
        orderBy: { date: "asc" },
      },
    },
    orderBy: { date: "asc" },
  });

  const rows: ReceivableRow[] = pending.map((t) => ({
    id: t.id,
    description: t.description,
    amount: t.amount,
    date: t.date,
    counterparty: t.counterparty,
    counterpartyPhone: t.counterpartyPhone,
    chargedAt: t.chargedAt,
    accountName: t.account.name,
    categoryName: t.category?.name ?? null,
    categoryColor: t.category?.color ?? null,
    categoryIcon: t.category?.icon ?? null,
    received: sumAmounts(t.partials),
    original: t.amount + sumAmounts(t.partials),
    partials: t.partials,
  }));

  // Grouped case-insensitively so "joão" and "João" are one person, while
  // the first spelling the user typed is what gets displayed back to them.
  const byKey = new Map<string, ReceivableGroup>();
  for (const row of rows) {
    const key = row.counterparty?.trim().toLowerCase() ?? "";
    const existing = byKey.get(key);
    const overdue = urgencyOf(row.date, today) === "overdue";

    if (existing) {
      existing.rows.push(row);
      existing.total += row.amount;
      existing.receivedTotal += row.received;
      existing.originalTotal += row.original;
      if (overdue) {
        existing.overdueTotal += row.amount;
        existing.overdueCount += 1;
      } else {
        existing.allOverdue = false;
      }
      // Rows arrive date-ascending, so the first one already holds the
      // nearest date; only the phone may need filling from a later row that
      // happens to carry one.
      existing.phone ??= row.counterpartyPhone;
    } else {
      byKey.set(key, {
        counterparty: row.counterparty?.trim() || null,
        phone: row.counterpartyPhone,
        rows: [row],
        total: row.amount,
        receivedTotal: row.received,
        originalTotal: row.original,
        overdueTotal: overdue ? row.amount : 0,
        overdueCount: overdue ? 1 : 0,
        nextDate: row.date,
        allOverdue: overdue,
      });
    }
  }

  // Anyone with something late comes first, then by how soon the next one
  // lands. The unnamed group sinks to the bottom of its own tier so it never
  // pushes a real person off the top of the screen.
  const groups = [...byKey.values()].sort((a, b) => {
    if (a.overdueCount > 0 !== b.overdueCount > 0) return a.overdueCount > 0 ? -1 : 1;
    if ((a.counterparty === null) !== (b.counterparty === null)) {
      return a.counterparty === null ? 1 : -1;
    }
    return a.nextDate.getTime() - b.nextDate.getTime();
  });

  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  const overdueRows = rows.filter((r) => urgencyOf(r.date, today) === "overdue");
  // Only what came in against entries that are *still open*. A receivable
  // paid off in full leaves the list entirely, and counting its slices here
  // would turn this into a running total of income the page never showed —
  // the figure has to mean "progress on what is below", or it is noise.
  const partiallyPaid = rows.filter((r) => r.received > 0);

  return {
    groups,
    total,
    count: rows.length,
    overdueTotal: overdueRows.reduce((sum, r) => sum + r.amount, 0),
    overdueCount: overdueRows.length,
    receivedTotal: partiallyPaid.reduce((sum, r) => sum + r.received, 0),
    partialCount: partiallyPaid.length,
    // How many distinct people owe something — the headline number on the
    // page ("3 pessoas te devem R$ 1.240").
    peopleCount: groups.filter((g) => g.counterparty !== null).length,
  };
}

function sumAmounts(rows: { amount: number }[]) {
  return rows.reduce((sum, r) => sum + r.amount, 0);
}

export type ReceivablesData = Awaited<ReturnType<typeof getReceivables>>;

// Who the "de quem" field offers, from two sources merged into one list:
// people already used on a lançamento, and contacts imported from Google.
//
// People you have actually tracked come first and win on conflicts — a
// number you typed here for this purpose beats whatever is in the address
// book — while the imported contacts turn the field from an empty text box
// into a picker of real people, which is the point of importing them.
export async function getCounterpartySuggestions(userId: string) {
  const [rows, contacts] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, counterparty: { not: null } },
      select: { counterparty: true, counterpartyPhone: true },
      orderBy: { date: "desc" },
      take: 200,
    }),
    prisma.contact.findMany({
      where: { userId },
      select: { name: true, phone: true },
      orderBy: { name: "asc" },
      // A datalist the browser filters as you type stays usable at this
      // size; past it, the payload costs more than the suggestions help.
      take: 1000,
    }),
  ]);

  const seen = new Map<string, { name: string; phone: string | null }>();
  for (const row of rows) {
    const name = row.counterparty?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = seen.get(key);
    if (!existing) {
      // Rows are newest-first, so the first spelling seen is the most
      // recent one — that is the one shown back to the user.
      seen.set(key, { name, phone: row.counterpartyPhone });
    } else {
      // The newest *non-null* phone, not simply the newest row's. Lending
      // João money a second time without retyping his number would
      // otherwise blank out the number already on file, and the field this
      // feeds exists precisely so it doesn't have to be retyped.
      existing.phone ??= row.counterpartyPhone;
    }
  }
  // Added after the used-counterparty loop, so an imported contact never
  // overwrites the spelling or the number already associated with someone
  // you have lent money to before.
  for (const contact of contacts) {
    const name = contact.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = seen.get(key);
    if (!existing) seen.set(key, { name, phone: contact.phone });
    else existing.phone ??= contact.phone;
  }

  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
