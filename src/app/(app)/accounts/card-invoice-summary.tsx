"use client";

import { useState } from "react";
import type { Account } from "@prisma/client";
import { formatCurrency } from "@/lib/utils";

export function CardInvoiceSummary({ accounts }: { accounts: Account[] }) {
  const cards = accounts.filter((a) => a.type === "credit_card" && !a.archived);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(cards.map((c) => c.id)));

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

  const total = cards
    .filter((c) => selected.has(c.id))
    .reduce((sum, c) => sum + Math.max(0, -c.balance), 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
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
      <div className="space-y-1">
        {cards.map((c) => {
          const invoiceAmount = Math.max(0, -c.balance);
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
              <span className="text-sm font-medium text-foreground">{formatCurrency(invoiceAmount)}</span>
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
