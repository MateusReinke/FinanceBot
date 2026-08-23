"use client";

import { useState } from "react";
import type { Category } from "@prisma/client";
import { Pencil, CheckCircle2, Trash2 } from "lucide-react";
import type { Frequency } from "@/lib/recurrence";
import { deleteFinancing, settleFinancingEarly } from "@/app/actions/financing";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EditFinancingForm } from "./edit-financing-form";

export function FinancingHeader({
  id,
  description,
  remainingCount,
  isRecurring = false,
  isIncome = false,
  categories,
  categoryId,
  installmentAmount,
  frequency,
  autoSettle,
  nextDueDate,
}: {
  id: string;
  description: string;
  remainingCount: number;
  isRecurring?: boolean;
  isIncome?: boolean;
  categories: Category[];
  categoryId: string | null;
  installmentAmount: number;
  frequency: Frequency;
  autoSettle: boolean;
  nextDueDate: Date | null;
}) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <h1 className="text-foreground text-2xl font-semibold">{description}</h1>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4" /> Editar
        </Button>
        {remainingCount > 0 ? (
          <form
            action={settleFinancingEarly}
            onSubmit={(e) => {
              const message = isRecurring
                ? `Encerrar este ${isIncome ? "recebimento" : "gasto"} fixo? Ele para de ser lançado a partir de agora; o que já foi ${isIncome ? "recebido" : "pago"} continua no histórico.`
                : `Quitar antecipadamente? As ${remainingCount} parcelas futuras serão removidas; as já pagas continuam no histórico.`;
              if (!confirm(message)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={id} />
            <Button type="submit" variant="outline" size="sm">
              <CheckCircle2 className="h-4 w-4" /> {isRecurring ? "Encerrar" : "Quitar"}
            </Button>
          </form>
        ) : null}
        <form
          action={deleteFinancing}
          onSubmit={(e) => {
            if (
              !confirm(
                `Excluir "${description}"? Todas as parcelas, passadas e futuras, serão removidas.`
              )
            )
              e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="danger" size="sm">
            <Trash2 className="h-4 w-4" /> Excluir
          </Button>
        </form>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar esta e as próximas">
        <EditFinancingForm
          id={id}
          description={description}
          categories={categories}
          categoryId={categoryId}
          installmentAmount={installmentAmount}
          frequency={frequency}
          autoSettle={autoSettle}
          nextDueDate={nextDueDate}
          remainingCount={remainingCount}
          isRecurring={isRecurring}
          onSuccess={() => setEditOpen(false)}
        />
      </Modal>
    </div>
  );
}
