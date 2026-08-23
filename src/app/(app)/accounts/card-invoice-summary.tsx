"use client";

import { useMemo, useState } from "react";
import type { Account } from "@prisma/client";
import type { InvoiceMonthPoint } from "@/lib/queries/card-invoices";
import { CardInvoiceChart } from "@/components/charts/card-invoice-chart";
import { Select } from "@/components/ui/input";
import { formatCurrency, formatMonthYear } from "@/lib/utils";

// The month the balance-based view is shown under, rather than a real month
// key — "fatura atual" is what the cards owe right now, which is not a
// forecast and has no month of its own.
const CURRENT = "current";

export function CardInvoiceSummary({
  accounts,
  series,
}: {
  accounts: Account[];
  series: InvoiceMonthPoint[];
}) {
  const cards = accounts.filter((a) => a.type === "credit_card" && !a.archived);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(cards.map((c) => c.id)));
  const [month, setMonth] = useState(CURRENT);

  // The chart's own window, so the dropdown and the columns can never offer
  // different months. Past months are included: an invoice you already paid
  // in July is a fair thing to go back and look at.
  const months = useMemo(
    () => series.map((p) => ({ key: p.key, label: formatMonthYear(p.month, p.year) })),
    [series]
  );
  const byMonth = useMemo(() => new Map(series.map((p) => [p.key, p])), [series]);

  if (cards.length === 0) return null;

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
    return byMonth.get(month)?.byCard[cardId] ?? null;
  }

  const total = cards
    .filter((c) => selected.has(c.id))
    .reduce((sum, c) => sum + (invoiceOf(c.id, c.balance) ?? 0), 0);

  const hasHistory = series.some((point) => point.total > 0);
  const comparable = cards.length >= 2;
  if (!hasHistory && !comparable) return null;

  return (
    <div className="surface surface-chart space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Faturas dos cartões</h2>
          <p className="text-xs text-muted-foreground">
            Seis meses de faturas pagas e seis do que você já programou.
          </p>
        </div>
        {comparable ? (
          <button
            type="button"
            onClick={toggleAll}
            className="shrink-0 text-xs text-primary hover:underline cursor-pointer"
          >
            {selected.size === cards.length ? "Desmarcar todos" : "Selecionar todos"}
          </button>
        ) : null}
      </div>

      {hasHistory ? (
        <CardInvoiceChart
          series={series}
          cards={cards.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
          selectedMonth={month === CURRENT ? undefined : month}
          onSelectMonth={setMonth}
        />
      ) : null}

      {comparable ? (
        <div className="space-y-3 border-t border-border pt-4">
          <Select
            aria-label="Mês da fatura"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
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
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    {c.name}
                  </span>
                  <span
                    className={
                      invoiceAmount === null
                        ? "text-sm text-muted-foreground"
                        : "text-sm font-medium tabular-nums text-foreground"
                    }
                  >
                    {invoiceAmount === null ? "não preenchida" : formatCurrency(invoiceAmount)}
                  </span>
                </label>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">
              Total selecionado ({selected.size} {selected.size === 1 ? "cartão" : "cartões"})
            </span>
            <span className="text-base font-semibold tabular-nums text-foreground">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
