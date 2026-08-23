// Projecting a credit card's next invoices.
//
// A card in this app carries a running balance (negative = owed) plus the
// two dates that actually govern it: closingDay, when the current invoice
// stops accepting purchases, and dueDay, when it has to be paid. Until now
// those two were collected at signup and then only ever printed back at the
// user — nothing scheduled anything from them.
//
// Everything here is pure date arithmetic so it can be reasoned about (and
// reused by the planner's preview) without touching the database.

import { startOfTodayUTC } from "@/lib/transaction-status";

// How far ahead the planner lets you fill. Beyond a year an estimated
// invoice is a guess dressed up as a bill, and the forecast is worse for
// having it.
export const INVOICE_PLAN_MONTHS = 12;

// A card's day fields are 1-31, and February exists. Clamping to the real
// last day of the target month is what addMonthsUTC already does for
// schedules, so invoices land on the 28th of February rather than rolling
// into March.
export function invoiceDateFor(year: number, month: number, day: number) {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

// "2026-09" — how one month of the plan is identified, both in the form
// field names and in the action that saves them.
//
// A month, not a date, is the unit on purpose: the same submit that fills
// the amounts can also move the card's dia do vencimento, so matching an
// existing invoice by its exact date would lose track of it the moment the
// user changes that day. "A fatura de setembro" survives the edit.
export function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthKeyOf(date: Date) {
  return monthKey(date.getUTCFullYear(), date.getUTCMonth() + 1);
}

export function parseMonthKey(key: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

// The half-open [start, end) range covering a month, for finding the
// invoices that fall inside it.
export function monthBounds(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

export type InvoiceMonth = { key: string; year: number; month: number; dueDate: Date };

// The months the planner offers, starting with the first invoice that has
// not come due yet. A card due on the 10th, consulted on the 15th, starts at
// next month's 10th — the current one is already out of the user's hands.
//
// Each due date is derived from its own month plus the raw dueDay, rather
// than by adding months to the first one: a card due on the 31st, planned
// from February, has to give Mar 31 and not the Mar 28 that carrying
// February's clamped day forward would produce.
export function invoicePlanMonths(
  dueDay: number,
  count = INVOICE_PLAN_MONTHS,
  today = startOfTodayUTC()
): InvoiceMonth[] {
  const thisMonth = invoiceDateFor(today.getUTCFullYear(), today.getUTCMonth(), dueDay);
  const offset = thisMonth < today ? 1 : 0;

  return Array.from({ length: count }, (_, i) => {
    // Passing an out-of-range month to Date.UTC is what rolls December over
    // into January of the following year for us.
    const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset + i, 1));
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    return {
      key: monthKey(year, month),
      year,
      month,
      dueDate: invoiceDateFor(year, month - 1, dueDay),
    };
  });
}

// Which month's spending an invoice covers. An invoice due on the 10th is
// settling the purchases that closed in the previous cycle, so labelling it
// by its own month ("Fatura de setembro" for one due 10/09) is what the
// card's own app does and what the user expects to read.
const referenceFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function invoiceLabel(cardName: string, dueDate: Date) {
  const reference = referenceFormatter.format(dueDate);
  return `Fatura ${cardName} — ${reference}`;
}

// What the first unfilled invoice is likely to be worth, offered as the
// planner's starting guess so the common case is one click.
//
// The card's current debt is the honest guess: it is real money already
// spent and not yet paid. Falls back to null (an empty field the user fills
// in) rather than 0, which would schedule a meaningless R$ 0 bill and
// quietly clutter the forecast.
export function suggestedInvoiceAmount(balance: number) {
  const owed = Math.max(0, -balance);
  return owed > 0 ? Math.round(owed * 100) / 100 : null;
}
