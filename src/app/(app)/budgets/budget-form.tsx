"use client";

import { useActionState, useEffect } from "react";
import type { Category } from "@prisma/client";
import { upsertBudget } from "@/app/actions/budgets";
import { Input, Label, FieldError } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export function BudgetForm({
  category,
  amount,
  month,
  year,
  onSuccess,
}: {
  category: Category;
  amount?: number;
  month: number;
  year: number;
  onSuccess: () => void;
}) {
  const [state, action] = useActionState(upsertBudget, undefined);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="categoryId" value={category.id} />
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="year" value={year} />

      <div className="space-y-1.5">
        <Label htmlFor="amount">Orçamento mensal para {category.name} (R$)</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={amount}
          required
          autoFocus
        />
        <FieldError messages={state?.errors?.amount} />
      </div>

      {state?.message ? (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">Salvar orçamento</SubmitButton>
    </form>
  );
}
