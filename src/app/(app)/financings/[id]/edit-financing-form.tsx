"use client";

import { useActionState, useEffect, useState } from "react";
import type { Category } from "@prisma/client";
import { updateFinancing } from "@/app/actions/financing";
import { Input, Label, FieldError, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { FREQUENCIES, FREQUENCY_OPTION_LABEL, type Frequency } from "@/lib/recurrence";
import { toDateInputValue } from "@/lib/utils";

export function EditFinancingForm({
  id,
  description,
  categories,
  categoryId,
  installmentAmount,
  frequency,
  autoSettle,
  nextDueDate,
  remainingCount,
  isRecurring,
  onSuccess,
}: {
  id: string;
  description: string;
  categories: Category[];
  categoryId: string | null;
  installmentAmount: number;
  frequency: Frequency;
  autoSettle: boolean;
  nextDueDate: Date | null;
  remainingCount: number;
  isRecurring: boolean;
  onSuccess: () => void;
}) {
  const [state, action] = useActionState(updateFinancing, undefined);
  const [changeDate, setChangeDate] = useState(false);
  // An unchecked checkbox posts nothing at all, which would be
  // indistinguishable from "field absent" — and absent has to keep meaning
  // the schema default (true) for older payloads. So the value is carried
  // by a hidden input that always posts an explicit "true"/"false".
  const [autoSettleOn, setAutoSettleOn] = useState(autoSettle);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />

      <p className="border-border bg-muted/50 text-muted-foreground rounded-lg border p-3 text-xs">
        As alterações valem para as {remainingCount} cobranças que ainda não foram pagas. As já
        pagas ficam como estão — é assim que um reajuste de aluguel fica certo no histórico.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="description">Descrição</Label>
        <Input id="description" name="description" defaultValue={description} required autoFocus />
        <FieldError messages={state?.errors?.description} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="installmentAmount">Novo valor (R$)</Label>
        <Input
          id="installmentAmount"
          name="installmentAmount"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={installmentAmount}
          required
        />
        <FieldError messages={state?.errors?.installmentAmount} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="categoryId">Categoria</Label>
        <Select id="categoryId" name="categoryId" defaultValue={categoryId ?? ""}>
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
        <Label htmlFor="frequency">Repete</Label>
        <Select id="frequency" name="frequency" defaultValue={frequency}>
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {FREQUENCY_OPTION_LABEL[f]}
            </option>
          ))}
        </Select>
        <FieldError messages={state?.errors?.frequency} />
      </div>

      <div className="space-y-2">
        <label className="text-foreground flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--primary)]"
            checked={changeDate}
            onChange={(e) => setChangeDate(e.target.checked)}
          />
          Mudar a data das próximas cobranças
        </label>
        {changeDate ? (
          <div className="space-y-1.5">
            <Label htmlFor="nextDate">Próxima cobrança em</Label>
            <Input
              id="nextDate"
              name="nextDate"
              type="date"
              defaultValue={nextDueDate ? toDateInputValue(nextDueDate) : ""}
              required
            />
            <p className="text-muted-foreground text-xs">
              As cobranças seguintes são recalculadas a partir dessa data.
            </p>
            <FieldError messages={state?.errors?.nextDate} />
          </div>
        ) : null}
      </div>

      <input type="hidden" name="autoSettle" value={autoSettleOn ? "true" : "false"} />
      <label className="text-foreground flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={autoSettleOn}
          onChange={(e) => setAutoSettleOn(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
        />
        <span>
          Debita sozinho na conta
          <span className="text-muted-foreground block text-xs">
            Desmarque se você paga na mão — aí {isRecurring ? "cada cobrança" : "cada parcela"} fica
            esperando você confirmar, e aparece como atrasada se passar do vencimento.
          </span>
        </span>
      </label>

      {state?.message ? (
        <p className="text-danger text-sm" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">Salvar</SubmitButton>
    </form>
  );
}
