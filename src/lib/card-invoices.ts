// Projecting a credit card's next invoices.
//
// A card in this app carries a running balance (negative = owed) plus the
// two dates that actually govern it: closingDay, when the current invoice
// stops accepting purchases, and dueDay, when it has to be paid. Until now
// those two were collected at signup and then only ever printed back at the
// user — nothing scheduled anything from them.
//
// Everything here is pure date arithmetic so it can be reasoned about (and
// reused by the form's preview) without touching the database.

import { addMonthsUTC } from "@/lib/utils";
import { startOfTodayUTC } from "@/lib/transaction-status";

// A card's day fields are 1-31, and February exists. Clamping to the real
// last day of the target month is what addMonthsUTC already does for
// schedules, so invoices land on the 28th of February rather than rolling
// into March.
export function invoiceDateFor(year: number, month: number, day: number) {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

// The next `count` due dates for a card, starting with the first one that
// has not passed yet. A card whose invoice is due on the 10th, consulted on
// the 15th, starts at next month's 10th — the current one is already out of
// the user's hands.
export function nextInvoiceDueDates(dueDay: number, count: number, today = startOfTodayUTC()) {
  const first = invoiceDateFor(today.getUTCFullYear(), today.getUTCMonth(), dueDay);
  const start = first < today ? addMonthsUTC(first, 1) : first;
  return Array.from({ length: count }, (_, i) => addMonthsUTC(start, i));
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

// What the invoice being scheduled is likely to be worth, offered as the
// form's default so the common case is one click.
//
// The card's current debt is the honest starting guess: it is real money
// already spent and not yet paid. Falls back to null (an empty field the
// user fills in) rather than 0, which would schedule a meaningless R$ 0
// bill and quietly clutter the forecast.
export function suggestedInvoiceAmount(balance: number) {
  const owed = Math.max(0, -balance);
  return owed > 0 ? Math.round(owed * 100) / 100 : null;
}
