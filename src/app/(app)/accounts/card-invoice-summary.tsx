"use client";

import { useMemo, useState } from "react";
import type { Account } from "@prisma/client";
import type { CardInvoicePlans } from "@/lib/queries/card-invoices";
import { INVOICE_PLAN_MONTHS, monthKey } from "@/lib/card-invoices";
import { startOfTodayUTC } from "@/lib/transaction-status";
import { Select } from "@/components/ui/input";
import { formatCurrency, formatMonthYear } from "@/lib/utils";

// The month the balance-based view is shown under, rather than a real month
// key — "fatura atual" is what the cards owe right now, which is not a
// forecast and has no month of its own.
const CURRENT = "current";

export function CardInvoiceSummary({
  accounts,
  plans,
}: {
  accounts: Account[];
  plans: CardInvoicePlans;
}) {
  const cards = accounts.filter((a) => a.type === "credit_card" && !a.archived);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(cards.map((c) => c.id)));
  const [month, setMonth] = useState(CURRENT);

  // Plain calendar months from this one on, independent of any single card's
  // vencimento: this panel compares cards, and cards that close on different
  // days still have a "fatura de setembro".
  const months = useMemo(() => {
    const today = startOfTodayUTC();
    return Array.from({ length: INVOICE_PLAN_MONTHS }, (_, i) => {
      const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i, 1));
      const year = cursor.getUTCFullYear();
      const monthNumber = cursor.getUTCMonth() + 1;
      return { key: monthKey(year, monthNumber), label: formatMonthYear(monthNumber, year) };
    });
  }, []);

  if (cards.length < 2) return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === cards.length ? new Set() : new Set(cards.map((c) => c.id))));
  }

  // What a card is worth in the chosen view: its current debt, or the sum of
  // the invoices planned for that month (a month can legitimately hold more
  // than one, and null is "nada preenchido" rather than R$ 0).
  function invoiceOf(cardId: string, balance: number) {
    if (month === CURRENT) return Math.max(0, -balance);
    const planned = (plans[cardId] ?? []).filter((invoice) => invoice.monthKey === month);
    if (planned.length === 0) return null;
    return planned.reduce((sum, invoice) => sum + invoice.amount, 0);
  }

  const total = cards
    .filter((c) => selected.has(c.id))
    .reduce((sum, c) => sum + (invoiceOf(c.id, c.balance) ?? 0), 0);

  return (
    <div className="surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Resumo das faturas</h2>
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs text-primary hover:underline cursor-pointer"
        >
          {selected.size === cards.length ? "Desmarcar todos" : "Selecionar todos"}
        </button>
      </div>
      <Select
        aria-label="Mês da fatura"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        className="mb-3"
      >
        <option value={CURRENT}>Fatura atual</option>
        {months.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label}
          </option>
        ))}
      </Select>
      <div className="space-y-1">
        {cards.map((c) => {
          const invoiceAmount = invoiceOf(c.id, c.balance);
          return (
            <label
              key={c.id}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-muted"
            >
              <span className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                {c.name}
              </span>
              <span
                className={
                  invoiceAmount === null
                    ? "text-sm text-muted-foreground"
                    : "text-sm font-medium text-foreground"
                }
              >
                {invoiceAmount === null ? "não preenchida" : formatCurrency(invoiceAmount)}
              </span>
            </label>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="text-muted-foreground">
          Total selecionado ({selected.size} {selected.size === 1 ? "cartão" : "cartões"})
        </span>
        <span className="text-base font-semibold text-foreground">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}
