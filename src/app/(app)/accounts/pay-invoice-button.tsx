"use client";

import { useActionState, useEffect, useState } from "react";
import type { Account } from "@prisma/client";
import { payCardInvoice } from "@/app/actions/accounts";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input, Label, FieldError, Select } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

export function PayInvoiceButton({
  account,
  sourceAccounts,
}: {
  account: Account;
  sourceAccounts: Account[];
}) {
  const [open, setOpen] = useState(false);
  const invoiceAmount = Math.max(0, -account.balance);

  if (invoiceAmount <= 0) return null;

  return (
    <>
      <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
        Marcar fatura como paga
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Marcar fatura como paga">
        <PayInvoiceForm
          account={account}
          sourceAccounts={sourceAccounts}
          invoiceAmount={invoiceAmount}
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

function PayInvoiceForm({
  account,
  sourceAccounts,
  invoiceAmount,
  onSuccess,
}: {
  account: Account;
  sourceAccounts: Account[];
  invoiceAmount: number;
  onSuccess: () => void;
}) {
  const [state, action] = useActionState(payCardInvoice, undefined);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="accountId" value={account.id} />

      <p className="text-sm text-muted-foreground">
        Fatura atual de {account.name}:{" "}
        <span className="font-medium text-foreground">{formatCurrency(invoiceAmount)}</span>
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="payAmount">Valor pago (R$)</Label>
        <Input
          id="payAmount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={invoiceAmount}
          required
          autoFocus
        />
        <FieldError messages={state?.errors?.amount} />
      </div>

      {sourceAccounts.length > 0 ? (
        <div className="space-y-1.5">
          <Label htmlFor="sourceAccountId">Pagar com qual conta? (opcional)</Label>
          <Select id="sourceAccountId" name="sourceAccountId" defaultValue="">
            <option value="">Não registrar de onde saiu o dinheiro</option>
            {sourceAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            Se escolher uma conta, o valor sai de lá como uma despesa também.
          </p>
          <FieldError messages={state?.errors?.sourceAccountId} />
        </div>
      ) : null}

      {state?.message ? (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">Confirmar pagamento</SubmitButton>
    </form>
  );
}
