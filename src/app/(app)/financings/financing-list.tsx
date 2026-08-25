"use client";

import { useState } from "react";
import Link from "next/link";
import type { Account, Category } from "@prisma/client";
import { Plus, CalendarClock, Repeat, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FinancingForm } from "./financing-form";
import { FREQUENCY_SHORT_LABEL, type Frequency } from "@/lib/recurrence";
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
  isRecurring: boolean;
  frequency: Frequency;
  type: string;
  autoSettle: boolean;
  overdueCount: number;
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
  const [createMode, setCreateMode] = useState<"count" | "recurring" | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setCreateMode("recurring")}>
          <Repeat className="h-4 w-4" /> Novo fixo
        </Button>
        <Button size="sm" onClick={() => setCreateMode("count")}>
          <Plus className="h-4 w-4" /> Novo parcelado
        </Button>
      </div>

      {financings.length === 0 ? (
        <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <CalendarClock className="text-muted-foreground h-8 w-8" />
          <p className="text-muted-foreground max-w-sm text-sm">
            Cadastre um gasto fixo (aluguel, assinatura), uma receita fixa (salário) ou uma compra
            parcelada — mensal, quinzenal, semanal ou anual. Cada cobrança aparece sozinha nos seus
            lançamentos na data em que vence.
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setCreateMode("recurring")}>
              <Repeat className="h-4 w-4" /> Novo fixo
            </Button>
            <Button size="sm" onClick={() => setCreateMode("count")}>
              <Plus className="h-4 w-4" /> Novo parcelado
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {financings.map((f) => {
            const pct = f.totalAmount > 0 ? Math.min(100, (f.paidTotal / f.totalAmount) * 100) : 0;
            return (
              <Link
                key={f.id}
                href={`/financings/${f.id}`}
                className="surface hover:border-primary flex flex-col gap-3 p-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm font-semibold">
                      {f.description}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {f.account.name} · {formatDate(f.firstDueDate)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                      f.isRecurring
                        ? f.type === "income"
                          ? "bg-success-bg text-success"
                          : "bg-primary/10 text-primary"
                        : STATUS_TONE[f.status]
                    )}
                  >
                    {f.isRecurring
                      ? f.type === "income"
                        ? "Receita fixa"
                        : "Gasto fixo"
                      : STATUS_LABEL[f.status]}
                  </span>
                </div>

                {f.overdueCount > 0 ? (
                  <span className="bg-danger-bg text-danger inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
                    <AlertCircle className="h-3 w-3" />
                    {f.overdueCount === 1 ? "1 atrasada" : `${f.overdueCount} atrasadas`}
                  </span>
                ) : null}

                {f.isRecurring ? (
                  <div className="border-border flex items-center justify-between border-t pt-3 text-sm">
                    <span className="text-muted-foreground">
                      {FREQUENCY_SHORT_LABEL[f.frequency]}
                    </span>
                    <span
                      className={cn(
                        "font-semibold",
                        f.type === "income" ? "text-success" : "text-foreground"
                      )}
                    >
                      {f.type === "income" ? "+" : ""}
                      {formatCurrency(f.installmentAmount)}
                    </span>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
                        <span>
                          {f.paidCount}/{f.installmentCount} pagas ·{" "}
                          {FREQUENCY_SHORT_LABEL[f.frequency].toLowerCase()}
                        </span>
                        <span>{pct.toFixed(0)}%</span>
                      </div>
                      <div className="bg-muted h-2 overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="border-border flex items-center justify-between border-t pt-3 text-sm">
                      <span className="text-muted-foreground">
                        Total {formatCurrency(f.totalAmount)}
                      </span>
                      <span className="text-foreground font-semibold">
                        Falta {formatCurrency(f.remainingTotal)}
                      </span>
                    </div>
                  </>
                )}
              </Link>
            );
          })}
        </div>
      )}

      <Modal
        open={createMode !== null}
        onClose={() => setCreateMode(null)}
        title={createMode === "recurring" ? "Novo lançamento fixo" : "Novo parcelamento"}
      >
        {createMode ? (
          <FinancingForm
            accounts={accounts}
            categories={categories}
            initialMode={createMode}
            onSuccess={() => setCreateMode(null)}
          />
        ) : null}
      </Modal>
    </div>
  );
}
