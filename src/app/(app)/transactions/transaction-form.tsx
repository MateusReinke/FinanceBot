"use client";

import { useActionState, useEffect, useState } from "react";
import type { Account, Category, Transaction } from "@prisma/client";
import { upsertTransaction } from "@/app/actions/transactions";
import { Input, Label, FieldError, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { toDateInputValue, cn } from "@/lib/utils";

type InitialValues = {
  description?: string;
  amount?: number;
  date?: string | Date;
  type?: "income" | "expense";
  accountId?: string | null;
  categoryId?: string | null;
};

export function TransactionForm({
  transaction,
  initial,
  accounts,
  categories,
  onSuccess,
}: {
  transaction?: Transaction;
  // Seeds defaults for a brand-new transaction (e.g. from the AI
  // assistant's parsed command) — ignored when `transaction` is set,
  // since editing an existing row always wins.
  initial?: InitialValues;
  accounts: Account[];
  categories: Category[];
  onSuccess: () => void;
}) {
  const [state, action] = useActionState(upsertTransaction, undefined);
  const [type, setType] = useState<"income" | "expense">(
    (transaction?.type as "income" | "expense") ?? initial?.type ?? "expense"
  );
  // Realizado by default: the overwhelmingly common case is recording
  // something that already happened. An installment of a financing is
  // driven by its own schedule, so the switch is hidden for those.
  const isInstallment = Boolean(transaction?.financingId);
  const [paid, setPaid] = useState(transaction ? transaction.balanceApplied : true);

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
          defaultValue={transaction?.description ?? initial?.description}
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
            defaultValue={transaction?.amount ?? initial?.amount}
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
            defaultValue={toDateInputValue(transaction?.date ?? initial?.date ?? new Date())}
            required
          />
          <FieldError messages={state?.errors?.date} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="accountId">Conta</Label>
        <Select id="accountId" name="accountId" defaultValue={transaction?.accountId ?? initial?.accountId ?? ""} required>
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
        <Select id="categoryId" name="categoryId" defaultValue={transaction?.categoryId ?? initial?.categoryId ?? ""}>
          <option value="">Sem categoria</option>
          {availableCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <FieldError messages={state?.errors?.categoryId} />
      </div>

      {isInstallment ? null : (
        <div className="space-y-2">
          <input type="hidden" name="paid" value={paid ? "true" : "false"} />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaid(true)}
              className={cn(
                "rounded-lg border py-2 text-sm font-medium cursor-pointer transition-colors",
                paid
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {type === "income" ? "Já recebi" : "Já paguei"}
            </button>
            <button
              type="button"
              onClick={() => setPaid(false)}
              className={cn(
                "rounded-lg border py-2 text-sm font-medium cursor-pointer transition-colors",
                !paid
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {type === "income" ? "Ainda vou receber" : "Ainda vou pagar"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {paid
              ? "Entra no saldo agora."
              : "Fica agendado: aparece em Próximos vencimentos e só mexe no saldo quando você confirmar."}
          </p>
        </div>
      )}

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
