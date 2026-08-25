"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { Account } from "@prisma/client";
import { ArrowDown, CalendarRange, Lock } from "lucide-react";
import { saveCardInvoicePlan } from "@/app/actions/accounts";
import type { PlannedInvoice } from "@/lib/queries/card-invoices";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input, Label, FieldError, Select } from "@/components/ui/input";
import { invoicePlanMonths, suggestedInvoiceAmount } from "@/lib/card-invoices";
import { formatCurrency, formatMonthShort } from "@/lib/utils";

// "Faturas futuras" — one row per month, so the user fills in what each of
// the next twelve invoices is going to be worth instead of repeating a
// single guess across all of them.
export function InvoicePlannerButton({
  account,
  sourceAccounts,
  plan,
}: {
  account: Account;
  sourceAccounts: Account[];
  plan: PlannedInvoice[];
}) {
  const [open, setOpen] = useState(false);

  // Nowhere for the money to come from means nothing to plan. The card
  // itself can never pay its own invoice.
  if (sourceAccounts.length === 0) return null;

  return (
    <>
      <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
        <CalendarRange className="h-4 w-4" /> Faturas futuras
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Faturas futuras — ${account.name}`}
        className="max-w-lg"
      >
        <InvoicePlannerForm
          account={account}
          sourceAccounts={sourceAccounts}
          plan={plan}
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

// "10/09" — enough to confirm the vencimento without repeating the month
// name already sitting next to it.
function dueLabel(date: Date) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function InvoicePlannerForm({
  account,
  sourceAccounts,
  plan,
  onSuccess,
}: {
  account: Account;
  sourceAccounts: Account[];
  plan: PlannedInvoice[];
  onSuccess: () => void;
}) {
  const [state, action] = useActionState(saveCardInvoicePlan, undefined);
  const [dueDay, setDueDay] = useState(account.dueDay ?? 10);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  // The same helper the action schedules from, so what the rows say is the
  // schedule and not an approximation of it. Only the dates depend on
  // dueDay — the months themselves don't move — which is why editing the
  // vencimento never loses what the user has already typed.
  const months = useMemo(() => invoicePlanMonths(dueDay), [dueDay]);

  // A month with a settled invoice is history: shown, but locked. A disabled
  // input is also not submitted, so the action never even sees those months.
  const byMonth = useMemo(() => {
    const map = new Map<string, PlannedInvoice>();
    for (const invoice of plan) {
      const current = map.get(invoice.monthKey);
      if (!current || invoice.paid) map.set(invoice.monthKey, invoice);
    }
    return map;
  }, [plan]);

  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const invoice of plan) {
      if (!invoice.paid) initial[invoice.monthKey] = String(invoice.amount);
    }
    // Nothing planned yet and the card is already carrying debt: that debt
    // is the honest guess for the first invoice, offered filled in so the
    // common case is one click. Every other month stays blank — inventing
    // twelve of them would be a forecast made of nothing.
    if (Object.keys(initial).length === 0) {
      const suggestion = suggestedInvoiceAmount(account.balance);
      const first = invoicePlanMonths(account.dueDay ?? 10, 1)[0];
      if (suggestion && first) initial[first.key] = String(suggestion);
    }
    return initial;
  });

  function setAmount(key: string, value: string) {
    setAmounts((prev) => ({ ...prev, [key]: value }));
  }

  // "Repetir para baixo": the same value for every later month that isn't
  // already settled. Filling twelve equal invoices — the old behavior — is
  // this one click, and a single month is still a single month.
  function repeatDown(fromIndex: number) {
    const value = amounts[months[fromIndex].key] ?? "";
    setAmounts((prev) => {
      const next = { ...prev };
      for (const month of months.slice(fromIndex + 1)) {
        if (!byMonth.get(month.key)?.paid) next[month.key] = value;
      }
      return next;
    });
  }

  const filled = months.filter((m) => !byMonth.get(m.key)?.paid && Number(amounts[m.key]) > 0);
  const total = filled.reduce((sum, m) => sum + Number(amounts[m.key]), 0);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="accountId" value={account.id} />

      <p className="text-muted-foreground text-sm">
        Preencha quanto você espera pagar em cada mês. Cada valor entra como uma fatura{" "}
        <span className="text-foreground font-medium">prevista</span> em Próximos vencimentos e no
        saldo previsto, e só mexe no saldo quando você confirmar o pagamento.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="invoiceSource">Qual conta vai pagar?</Label>
          <Select
            id="invoiceSource"
            name="sourceAccountId"
            defaultValue={
              sourceAccounts.find((a) => a.id === plan.find((p) => !p.paid)?.accountId)?.id ??
              sourceAccounts[0]?.id
            }
            required
          >
            {sourceAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <FieldError messages={state?.errors?.sourceAccountId} />
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
        <Label>Valor de cada fatura (R$)</Label>
        <ul className="border-border max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">
          {months.map((month, index) => {
            const existing = byMonth.get(month.key);
            const locked = existing?.paid ?? false;
            return (
              <li key={month.key} className="flex items-center gap-2">
                <div className="w-20 shrink-0">
                  <p className="text-foreground text-sm font-medium">
                    {formatMonthShort(month.month, month.year)} {month.year}
                  </p>
                  {/* A paid invoice keeps the date it was actually paid on; only
                      the months still open follow the vencimento being edited. */}
                  <p className="text-muted-foreground text-xs">
                    vence {dueLabel(locked ? existing!.date : month.dueDate)}
                  </p>
                </div>
                {locked ? (
                  <div className="border-border bg-muted/40 flex h-10 flex-1 items-center justify-between rounded-lg border px-3">
                    <span className="text-muted-foreground text-sm tabular-nums">
                      {formatCurrency(existing!.amount)}
                    </span>
                    <span className="text-success flex items-center gap-1 text-xs">
                      <Lock className="h-3 w-3" /> paga
                    </span>
                  </div>
                ) : (
                  <Input
                    aria-label={`Fatura de ${formatMonthShort(month.month, month.year)} de ${month.year}`}
                    name={`amount-${month.key}`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={amounts[month.key] ?? ""}
                    onChange={(e) => setAmount(month.key, e.target.value)}
                    className="flex-1"
                  />
                )}
                <button
                  type="button"
                  onClick={() => repeatDown(index)}
                  disabled={locked || index === months.length - 1}
                  title="Repetir este valor nos meses seguintes"
                  aria-label={`Repetir o valor de ${formatMonthShort(month.month, month.year)} nos meses seguintes`}
                  className="text-muted-foreground hover:bg-muted shrink-0 cursor-pointer rounded-md p-1.5 disabled:pointer-events-none disabled:opacity-30"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-muted-foreground text-xs">
          Deixe em branco os meses que você ainda não sabe. Apagar um valor remove aquela fatura
          programada; meses já pagos ficam bloqueados.
        </p>
        <FieldError messages={state?.errors?.months} />
      </div>

      <div className="border-border bg-muted/40 flex items-center justify-between rounded-lg border p-3 text-sm">
        <span className="text-muted-foreground">
          {filled.length} {filled.length === 1 ? "fatura prevista" : "faturas previstas"}
        </span>
        <span className="text-foreground font-semibold tabular-nums">{formatCurrency(total)}</span>
      </div>

      {state?.message ? (
        <p className="text-danger text-sm" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">Salvar faturas</SubmitButton>
    </form>
  );
}
