"use client";

import { useState } from "react";
import Link from "next/link";
import type { Account, Category } from "@prisma/client";
import { Plus, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FinancingForm } from "./financing-form";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

type FinancingCardData = {
  id: string;
  description: string;
  account: Account;
  category: Category | null;
  installmentAmount: number;
  installmentCount: number;
  firstDueDate: Date;
  paidCount: number;
  paidTotal: number;
  remainingCount: number;
  remainingTotal: number;
  totalAmount: number;
  status: "andamento" | "concluido" | "quitado";
};

const STATUS_LABEL: Record<FinancingCardData["status"], string> = {
  andamento: "Em andamento",
  concluido: "Concluído",
  quitado: "Quitado antecipadamente",
};

const STATUS_TONE: Record<FinancingCardData["status"], string> = {
  andamento: "bg-warning-bg text-warning",
  concluido: "bg-success-bg text-success",
  quitado: "bg-success-bg text-success",
};

export function FinancingList({
  financings,
  accounts,
  categories,
}: {
  financings: FinancingCardData[];
  accounts: Account[];
  categories: Category[];
}) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Novo financiamento
        </Button>
      </div>

      {financings.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-10 text-center">
          <CalendarClock className="h-8 w-8 text-muted-foreground" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Cadastre um financiamento ou compra parcelada — a parcela de cada mês aparece
            automaticamente nos seus gastos, no mês em que vence.
          </p>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Novo financiamento
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {financings.map((f) => {
            const pct = f.totalAmount > 0 ? Math.min(100, (f.paidTotal / f.totalAmount) * 100) : 0;
            return (
              <Link
                key={f.id}
                href={`/financings/${f.id}`}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{f.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.account.name} · {formatDate(f.firstDueDate)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                      STATUS_TONE[f.status]
                    )}
                  >
                    {STATUS_LABEL[f.status]}
                  </span>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {f.paidCount}/{f.installmentCount} parcelas pagas
                    </span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                  <span className="text-muted-foreground">Total {formatCurrency(f.totalAmount)}</span>
                  <span className="font-semibold text-foreground">
                    Falta {formatCurrency(f.remainingTotal)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Novo financiamento">
        <FinancingForm accounts={accounts} categories={categories} onSuccess={() => setCreateOpen(false)} />
      </Modal>
    </div>
  );
}
