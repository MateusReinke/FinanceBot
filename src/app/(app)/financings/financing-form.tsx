"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { Account, Category } from "@prisma/client";
import { createFinancing } from "@/app/actions/financing";
import { Input, Label, FieldError, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatCurrency, toDateInputValue } from "@/lib/utils";

export function FinancingForm({
  accounts,
  categories,
  onSuccess,
}: {
  accounts: Account[];
  categories: Category[];
  onSuccess: () => void;
}) {
  const [state, action] = useActionState(createFinancing, undefined);
  const [count, setCount] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  const total = useMemo(() => {
    const n = Number(count) || 0;
    const v = Number(amount) || 0;
    return n * v;
  }, [count, amount]);

  const eligibleAccounts = accounts.filter((a) => !a.archived && !a.pluggyItemId);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="description">Descrição</Label>
        <Input
          id="description"
          name="description"
          placeholder="Ex: Financiamento do carro"
          required
          autoFocus
        />
        <FieldError messages={state?.errors?.description} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="accountId">Conta</Label>
        <Select id="accountId" name="accountId" defaultValue="" required>
          <option value="" disabled>
            Selecione uma conta
          </option>
          {eligibleAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <FieldError messages={state?.errors?.accountId} />
        {eligibleAccounts.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma conta manual disponível — contas conectadas via Open Finance não podem
            receber um financiamento manual.
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="categoryId">Categoria (opcional)</Label>
        <Select id="categoryId" name="categoryId" defaultValue="">
          <option value="">Sem categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <FieldError messages={state?.errors?.categoryId} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="firstDueDate">Data do primeiro pagamento</Label>
        <Input
          id="firstDueDate"
          name="firstDueDate"
          type="date"
          defaultValue={toDateInputValue(new Date())}
          required
        />
        <FieldError messages={state?.errors?.firstDueDate} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="installmentCount">Quantidade de parcelas</Label>
          <Input
            id="installmentCount"
            name="installmentCount"
            type="number"
            step="1"
            min="1"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            required
          />
          <FieldError messages={state?.errors?.installmentCount} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="installmentAmount">Valor de cada parcela (R$)</Label>
          <Input
            id="installmentAmount"
            name="installmentAmount"
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <FieldError messages={state?.errors?.installmentAmount} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
        <span className="text-muted-foreground">Total do financiamento: </span>
        <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
      </div>

      {state?.message ? (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">Criar financiamento</SubmitButton>
    </form>
  );
}
