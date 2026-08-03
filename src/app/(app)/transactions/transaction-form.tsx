"use client";

import { useActionState, useEffect, useState } from "react";
import type { Account, Category, Transaction } from "@prisma/client";
import { upsertTransaction } from "@/app/actions/transactions";
import { Input, Label, FieldError, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { toDateInputValue, cn } from "@/lib/utils";

export function TransactionForm({
  transaction,
  accounts,
  categories,
  onSuccess,
}: {
  transaction?: Transaction;
  accounts: Account[];
  categories: Category[];
  onSuccess: () => void;
}) {
  const [state, action] = useActionState(upsertTransaction, undefined);
  const [type, setType] = useState<"income" | "expense">(
    (transaction?.type as "income" | "expense") ?? "expense"
  );

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  const availableAccounts = accounts.filter(
    (a) => !a.archived || a.id === transaction?.accountId
  );
  const availableCategories = categories.filter((c) => c.type === type);

  return (
    <form action={action} className="space-y-4">
      {transaction ? <input type="hidden" name="id" value={transaction.id} /> : null}
      <input type="hidden" name="type" value={type} />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setType("expense")}
          className={cn(
            "rounded-lg border py-2 text-sm font-medium cursor-pointer transition-colors",
            type === "expense"
              ? "border-danger bg-danger-bg text-danger"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          Despesa
        </button>
        <button
          type="button"
          onClick={() => setType("income")}
          className={cn(
            "rounded-lg border py-2 text-sm font-medium cursor-pointer transition-colors",
            type === "income"
              ? "border-success bg-success-bg text-success"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          Receita
        </button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Descrição</Label>
        <Input
          id="description"
          name="description"
          defaultValue={transaction?.description}
          placeholder="Ex: Supermercado"
          required
          autoFocus
        />
        <FieldError messages={state?.errors?.description} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Valor (R$)</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={transaction?.amount}
            required
          />
          <FieldError messages={state?.errors?.amount} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Data</Label>
          <Input
            id="date"
            name="date"
            type="date"
            defaultValue={transaction ? toDateInputValue(transaction.date) : toDateInputValue(new Date())}
            required
          />
          <FieldError messages={state?.errors?.date} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="accountId">Conta</Label>
        <Select id="accountId" name="accountId" defaultValue={transaction?.accountId ?? ""} required>
          <option value="" disabled>
            Selecione uma conta
          </option>
          {availableAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <FieldError messages={state?.errors?.accountId} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="categoryId">Categoria</Label>
        <Select id="categoryId" name="categoryId" defaultValue={transaction?.categoryId ?? ""}>
          <option value="">Sem categoria</option>
          {availableCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <FieldError messages={state?.errors?.categoryId} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={transaction?.notes ?? ""} />
      </div>

      {state?.message ? (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">
        {transaction ? "Salvar alterações" : "Adicionar transação"}
      </SubmitButton>
    </form>
  );
}
