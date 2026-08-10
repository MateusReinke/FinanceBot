"use client";

import { useActionState, useEffect, useState } from "react";
import type { Transaction } from "@prisma/client";
import { CheckCircle2, SkipForward } from "lucide-react";
import { payInstallmentNow, skipInstallment } from "@/app/actions/financing";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input, Label, FieldError } from "@/components/ui/input";
import type { Frequency } from "@/lib/recurrence";
import { formatCurrency, formatDate, formatMonthYear, toDateInputValue, cn } from "@/lib/utils";

export function InstallmentTable({
  financingId,
  installments,
  installmentCount,
  scheduledAmount,
  isRecurring = false,
  frequency = "monthly",
  isIncome = false,
}: {
  financingId: string;
  installments: Transaction[];
  installmentCount: number;
  scheduledAmount: number;
  isRecurring?: boolean;
  frequency?: Frequency;
  isIncome?: boolean;
}) {
  // A monthly gasto fixo reads better as "Agosto de 2026" than as an exact
  // day. Anything that repeats more than once a month (quinzenal, semanal)
  // would collapse two different charges into the same label, so those
  // keep the full date.
  const byMonthLabel = isRecurring && frequency === "monthly";
  const [payingId, setPayingId] = useState<string | null>(null);
  const paying = installments.find((i) => i.id === payingId) ?? null;
  // Compared as a calendar date in UTC, like every other date here: due
  // today is not late.
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {isRecurring ? null : <th className="px-3 py-2">Parcela</th>}
              <th className="px-3 py-2">Vencimento</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2 text-right">Status</th>
              <th className="px-3 py-2 text-right">
                <span className="sr-only">Ação</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {installments.map((inst) => {
              const savings = inst.balanceApplied ? scheduledAmount - inst.amount : 0;
              return (
                <tr key={inst.id} className="border-b border-border last:border-0">
                  {isRecurring ? null : (
                    <td className="px-3 py-2.5 text-foreground">
                      {inst.installmentNumber}/{installmentCount}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {byMonthLabel
                      ? formatMonthYear(new Date(inst.date).getUTCMonth() + 1, new Date(inst.date).getUTCFullYear())
                      : formatDate(inst.date)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-foreground">
                    <div className="flex items-center justify-end gap-1.5">
                      {formatCurrency(inst.amount)}
                      {savings > 0.01 ? (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium text-success">
                          <CheckCircle2 className="h-3 w-3" /> economizou {formatCurrency(savings)}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        inst.balanceApplied
                          ? "bg-success-bg text-success"
                          : new Date(inst.date) < today
                            ? "bg-danger-bg text-danger"
                            : "bg-warning-bg text-warning"
                      )}
                    >
                      {inst.balanceApplied
                        ? isIncome
                          ? "Recebida"
                          : "Paga"
                        : new Date(inst.date) < today
                          ? "Atrasada"
                          : "Pendente"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {!inst.balanceApplied ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => setPayingId(inst.id)}>
                          {isIncome ? "Recebi" : "Paguei"}
                        </Button>
                        {isRecurring ? (
                          <form
                            action={skipInstallment}
                            onSubmit={(e) => {
                              if (!confirm("Pular esta cobrança? Ela some do mês, e as próximas continuam normalmente."))
                                e.preventDefault();
                            }}
                          >
                            <input type="hidden" name="transactionId" value={inst.id} />
                            <Button type="submit" variant="outline" size="sm" title="Pular esta">
                              <SkipForward className="h-4 w-4" />
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Cada parcela também aparece na sua lista de Transações e pode ser editada ou excluída por
        lá se precisar de um ajuste pontual.
      </p>

      <Modal
        open={paying !== null}
        onClose={() => setPayingId(null)}
        title={isIncome ? "Confirmar recebimento" : "Confirmar pagamento"}
      >
        {paying ? (
          <PayInstallmentForm
            financingId={financingId}
            transaction={paying}
            scheduledAmount={scheduledAmount}
            isIncome={isIncome}
            onSuccess={() => setPayingId(null)}
          />
        ) : null}
      </Modal>
    </>
  );
}

function PayInstallmentForm({
  financingId,
  transaction,
  scheduledAmount,
  isIncome,
  onSuccess,
}: {
  financingId: string;
  transaction: Transaction;
  scheduledAmount: number;
  isIncome: boolean;
  onSuccess: () => void;
}) {
  const [state, action] = useActionState(payInstallmentNow, undefined);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="financingId" value={financingId} />
      <input type="hidden" name="transactionId" value={transaction.id} />

      <p className="text-sm text-muted-foreground">
        Vencimento {formatDate(transaction.date)} · previsto {formatCurrency(scheduledAmount)}
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="paidAmount">{isIncome ? "Valor recebido (R$)" : "Valor pago (R$)"}</Label>
        <Input
          id="paidAmount"
          name="paidAmount"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={transaction.amount}
          required
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          {isIncome
            ? "Veio diferente do previsto? Informe o valor real que caiu na conta."
            : "Pagou menos que o previsto (ex: amortização ou desconto)? Informe o valor real — a diferença fica registrada como economia."}
        </p>
        <FieldError messages={state?.errors?.paidAmount} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="paidDate">{isIncome ? "Recebi no dia" : "Paguei no dia"}</Label>
        <Input
          id="paidDate"
          name="paidDate"
          type="date"
          defaultValue={toDateInputValue(transaction.date)}
        />
        <p className="text-xs text-muted-foreground">
          Pagou atrasado? Ajuste aqui para o lançamento cair no dia certo.
        </p>
        <FieldError messages={state?.errors?.paidDate} />
      </div>

      {state?.message ? (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">
        {isIncome ? "Confirmar recebimento" : "Confirmar pagamento"}
      </SubmitButton>
    </form>
  );
}
