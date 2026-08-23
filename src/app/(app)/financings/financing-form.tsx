"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { Account, Category } from "@prisma/client";
import { createFinancing } from "@/app/actions/financing";
import { Input, Label, FieldError, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  FREQUENCIES,
  FREQUENCY_OPTION_LABEL,
  FREQUENCY_SHORT_LABEL,
  occurrencesBetweenUTC,
  recurringOccurrenceCount,
  type Frequency,
} from "@/lib/recurrence";
import { formatCurrency, toDateInputValue, cn } from "@/lib/utils";

export function FinancingForm({
  accounts,
  categories,
  onSuccess,
  initialMode = "count",
  initialType = "expense",
}: {
  accounts: Account[];
  categories: Category[];
  onSuccess: () => void;
  initialMode?: "count" | "endDate" | "recurring";
  initialType?: "expense" | "income";
}) {
  const [state, action] = useActionState(createFinancing, undefined);
  const [countMode, setCountMode] = useState<"count" | "endDate" | "recurring">(initialMode);
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [type, setType] = useState<"expense" | "income">(initialType);
  // See the same pattern in edit-financing-form: an unchecked checkbox
  // posts nothing, so the value rides on a hidden input instead.
  const [autoSettleOn, setAutoSettleOn] = useState(true);
  const [count, setCount] = useState("");
  const [amount, setAmount] = useState("");
  const [firstDueDate, setFirstDueDate] = useState(toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  const computedCount = useMemo(() => {
    if (countMode === "count") return Number(count) || 0;
    if (countMode === "recurring") return recurringOccurrenceCount(frequency);
    if (!endDate) return 0;
    return occurrencesBetweenUTC(
      new Date(`${firstDueDate}T00:00:00Z`),
      new Date(`${endDate}T00:00:00Z`),
      frequency
    );
  }, [countMode, count, endDate, firstDueDate, frequency]);

  const total = useMemo(() => {
    const v = Number(amount) || 0;
    return computedCount * v;
  }, [computedCount, amount]);

  const eligibleAccounts = accounts.filter((a) => !a.archived && !a.pluggyItemId);
  const eligibleCategories = categories.filter((c) => c.type === type);
  const isIncome = type === "income";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="type" value={type} />
      <div className="grid grid-cols-2 gap-2">
        {(["expense", "income"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={cn(
              "rounded-lg border py-2 text-sm font-medium cursor-pointer transition-colors",
              type === t
                ? t === "income"
                  ? "border-success bg-success-bg text-success"
                  : "border-danger bg-danger-bg text-danger"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {t === "income" ? "Dinheiro que entra" : "Dinheiro que sai"}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Descrição</Label>
        <Input
          id="description"
          name="description"
          placeholder={
            isIncome
              ? "Ex: Salário"
              : countMode === "recurring"
                ? "Ex: Aluguel"
                : "Ex: Financiamento do carro"
          }
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
          {eligibleCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <FieldError messages={state?.errors?.categoryId} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="firstDueDate">{isIncome ? "Data do primeiro recebimento" : "Data do primeiro pagamento"}</Label>
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
        <Label htmlFor="frequency">Repete</Label>
        <Select
          id="frequency"
          name="frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as Frequency)}
        >
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {FREQUENCY_OPTION_LABEL[f]}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">
          Sempre a partir da data acima — quinzenal cai a cada 15 dias, mensal cai sempre no
          mesmo dia do mês.
        </p>
        <FieldError messages={state?.errors?.frequency} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="installmentAmount">Valor de cada {isIncome ? "recebimento" : "cobrança"} (R$)</Label>
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
        <input type="hidden" name="isRecurring" value={countMode === "recurring" ? "true" : "false"} />
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setCountMode("count")}
            className={cn(
              "rounded-lg border py-2 text-xs font-medium cursor-pointer transition-colors sm:text-sm",
              countMode === "count"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            Quantidade de cobranças
          </button>
          <button
            type="button"
            onClick={() => setCountMode("endDate")}
            className={cn(
              "rounded-lg border py-2 text-xs font-medium cursor-pointer transition-colors sm:text-sm",
              countMode === "endDate"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            Até uma data
          </button>
          <button
            type="button"
            onClick={() => setCountMode("recurring")}
            className={cn(
              "rounded-lg border py-2 text-xs font-medium cursor-pointer transition-colors sm:text-sm",
              countMode === "recurring"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            Sem data pra acabar
          </button>
        </div>

        {countMode === "count" ? (
          <div className="space-y-1.5">
            <Label htmlFor="installmentCountInput">Quantas cobranças no total</Label>
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
        ) : countMode === "endDate" ? (
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
                ? `${FREQUENCY_SHORT_LABEL[frequency].toLowerCase()} — ${computedCount} cobrança${
                    computedCount > 1 ? "s" : ""
                  } no total`
                : "Para uma conta fixa (assinatura, plano, aluguel) com data pra terminar"}
            </p>
            <FieldError messages={state?.errors?.installmentCount} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Lança o mesmo valor {FREQUENCY_SHORT_LABEL[frequency].toLowerCase()},
            indefinidamente — pra aluguel, mensalidade, diarista ou qualquer gasto fixo sem
            previsão de acabar. Dá pra cancelar quando quiser na página do gasto.
          </p>
        )}
      </div>

      <input type="hidden" name="autoSettle" value={autoSettleOn ? "true" : "false"} />
      <label className="flex items-start gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={autoSettleOn}
          onChange={(e) => setAutoSettleOn(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
        />
        <span>
          {isIncome ? "Cai sozinho na conta" : "Debita sozinho na conta"}
          <span className="block text-xs text-muted-foreground">
            {autoSettleOn
              ? `Marcado: no dia do vencimento o valor ${isIncome ? "entra" : "sai"} do saldo automaticamente — pra débito automático, salário e afins.`
              : `Desmarcado: cada ${isIncome ? "recebimento" : "cobrança"} espera você confirmar, e aparece em "Contas a pagar" como atrasada se passar do dia.`}
          </span>
        </span>
      </label>

      <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
        {countMode === "recurring" ? (
          <>
            <span className="text-muted-foreground">{FREQUENCY_SHORT_LABEL[frequency]}: </span>
            <span className="font-semibold text-foreground">{formatCurrency(Number(amount) || 0)}</span>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">Total ({computedCount || 0}x): </span>
            <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
          </>
        )}
      </div>

      {state?.message ? (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">
        {countMode === "recurring" ? (isIncome ? "Criar receita fixa" : "Criar gasto fixo") : "Criar"}
      </SubmitButton>
    </form>
  );
}
