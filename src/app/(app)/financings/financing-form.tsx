"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { Account, Category } from "@prisma/client";
import { createFinancing } from "@/app/actions/financing";
import { Input, Label, FieldError, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatCurrency, toDateInputValue, monthsBetweenUTC, cn } from "@/lib/utils";

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
  const [countMode, setCountMode] = useState<"count" | "endDate">("count");
  const [count, setCount] = useState("");
  const [amount, setAmount] = useState("");
  const [firstDueDate, setFirstDueDate] = useState(toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  const computedCount = useMemo(() => {
    if (countMode === "count") return Number(count) || 0;
    if (!endDate) return 0;
    return monthsBetweenUTC(new Date(`${firstDueDate}T00:00:00Z`), new Date(`${endDate}T00:00:00Z`));
  }, [countMode, count, endDate, firstDueDate]);

  const total = useMemo(() => {
    const v = Number(amount) || 0;
    return computedCount * v;
  }, [computedCount, amount]);

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
          value={firstDueDate}
          onChange={(e) => setFirstDueDate(e.target.value)}
          required
        />
        <FieldError messages={state?.errors?.firstDueDate} />
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

      <div className="space-y-2">
        <input type="hidden" name="installmentCount" value={computedCount || ""} />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCountMode("count")}
            className={cn(
              "rounded-lg border py-2 text-sm font-medium cursor-pointer transition-colors",
              countMode === "count"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            Quantidade de parcelas
          </button>
          <button
            type="button"
            onClick={() => setCountMode("endDate")}
            className={cn(
              "rounded-lg border py-2 text-sm font-medium cursor-pointer transition-colors",
              countMode === "endDate"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            Data final (conta fixa)
          </button>
        </div>

        {countMode === "count" ? (
          <div className="space-y-1.5">
            <Label htmlFor="installmentCountInput">Quantidade de parcelas</Label>
            <Input
              id="installmentCountInput"
              type="number"
              step="1"
              min="1"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              required
            />
            <FieldError messages={state?.errors?.installmentCount} />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="endDateInput">Última cobrança prevista</Label>
            <Input
              id="endDateInput"
              type="date"
              min={firstDueDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              {computedCount > 0
                ? `${computedCount} cobrança${computedCount > 1 ? "s" : ""}, no mesmo dia do mês da primeira`
                : "Para uma conta fixa (assinatura, plano, aluguel) com data de validade conhecida"}
            </p>
            <FieldError messages={state?.errors?.installmentCount} />
          </div>
        )}
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
