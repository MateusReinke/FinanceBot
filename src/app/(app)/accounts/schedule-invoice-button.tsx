"use client";

import { useActionState, useEffect, useState } from "react";
import type { Account } from "@prisma/client";
import { CalendarPlus } from "lucide-react";
import { scheduleCardInvoices } from "@/app/actions/accounts";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input, Label, FieldError, Select } from "@/components/ui/input";
import { nextInvoiceDueDates, suggestedInvoiceAmount } from "@/lib/card-invoices";
import { formatCurrency, formatDate } from "@/lib/utils";

// "Programar faturas futuras" — puts the next N invoices of a card on the
// calendar as previsto, so the biggest bill of the month stops being the one
// thing the forecast doesn't know about.
export function ScheduleInvoiceButton({
  account,
  sourceAccounts,
}: {
  account: Account;
  sourceAccounts: Account[];
}) {
  const [open, setOpen] = useState(false);

  // Nowhere for the money to come from means nothing to schedule. The card
  // itself can never pay its own invoice.
  if (sourceAccounts.length === 0) return null;

  return (
    <>
      <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4" /> Programar faturas futuras
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Programar faturas futuras">
        <ScheduleInvoiceForm
          account={account}
          sourceAccounts={sourceAccounts}
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

function ScheduleInvoiceForm({
  account,
  sourceAccounts,
  onSuccess,
}: {
  account: Account;
  sourceAccounts: Account[];
  onSuccess: () => void;
}) {
  const [state, action] = useActionState(scheduleCardInvoices, undefined);
  const [months, setMonths] = useState(3);
  const [dueDay, setDueDay] = useState(account.dueDay ?? 10);
  const [amount, setAmount] = useState(suggestedInvoiceAmount(account.balance) ?? 0);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  // The same helper the server schedules from, so the preview is the
  // schedule and not an approximation of it.
  const preview = nextInvoiceDueDates(dueDay, months);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="accountId" value={account.id} />

      <p className="text-sm text-muted-foreground">
        Lança as próximas faturas de {account.name} como{" "}
        <span className="font-medium text-foreground">previstas</span>. Elas aparecem em Próximos
        vencimentos e no saldo previsto, e só mexem no saldo quando você confirmar o pagamento.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="invoiceAmount">Valor estimado (R$)</Label>
          <Input
            id="invoiceAmount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            value={amount || ""}
            onChange={(e) => setAmount(Number(e.target.value))}
            required
            autoFocus
          />
          <FieldError messages={state?.errors?.amount} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invoiceDueDay">Dia do vencimento</Label>
          <Input
            id="invoiceDueDay"
            name="dueDay"
            type="number"
            min="1"
            max="31"
            value={dueDay}
            onChange={(e) => setDueDay(Number(e.target.value))}
            required
          />
          <FieldError messages={state?.errors?.dueDay} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="invoiceMonths">Quantos meses</Label>
        <Select
          id="invoiceMonths"
          name="months"
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
        >
          {[1, 2, 3, 6, 12].map((n) => (
            <option key={n} value={n}>
              {n === 1 ? "Próxima fatura" : `Próximas ${n} faturas`}
            </option>
          ))}
        </Select>
        <FieldError messages={state?.errors?.months} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="invoiceSource">Qual conta vai pagar?</Label>
        <Select id="invoiceSource" name="sourceAccountId" defaultValue={sourceAccounts[0]?.id} required>
          {sourceAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <FieldError messages={state?.errors?.sourceAccountId} />
      </div>

      {amount > 0 ? (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Vai criar:</p>
          <ul className="space-y-1">
            {preview.map((date) => (
              <li key={date.toISOString()} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{formatDate(date)}</span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatCurrency(amount)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
            Total previsto: {formatCurrency(amount * months)}
          </p>
        </div>
      ) : null}

      {state?.message ? (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">Programar</SubmitButton>
    </form>
  );
}
