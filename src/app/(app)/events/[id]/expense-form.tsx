"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { addExpense } from "@/app/actions/events";
import { Input, Label, FieldError, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { displayName } from "@/lib/display-name";
import { formatCurrency, toDateInputValue, cn } from "@/lib/utils";

type Participant = { userId: string; user: { id: string; name: string; email: string } };

export function ExpenseForm({
  eventId,
  participants,
  currentUserId,
  onSuccess,
}: {
  eventId: string;
  participants: Participant[];
  currentUserId: string;
  onSuccess: () => void;
}) {
  const [state, action] = useActionState(addExpense, undefined);
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [included, setIncluded] = useState<Set<string>>(
    new Set(participants.map((p) => p.userId))
  );
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  const customSum = useMemo(
    () => Object.values(customAmounts).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [customAmounts]
  );
  const totalAmount = Number(amount) || 0;
  const remaining = Math.round((totalAmount - customSum) * 100) / 100;

  function toggleParticipant(userId: string) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="splitMode" value={splitMode} />

      <div className="space-y-1.5">
        <Label htmlFor="description">Descrição</Label>
        <Input id="description" name="description" placeholder="Ex: Jantar" required autoFocus />
        <FieldError messages={state?.errors?.description} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Valor total (R$)</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <FieldError messages={state?.errors?.amount} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Data</Label>
          <Input id="date" name="date" type="date" defaultValue={toDateInputValue(new Date())} required />
          <FieldError messages={state?.errors?.date} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="paidById">Quem pagou</Label>
        <Select id="paidById" name="paidById" defaultValue={currentUserId} required>
          {participants.map((p) => (
            <option key={p.userId} value={p.userId}>
              {displayName(p.user, currentUserId)}
            </option>
          ))}
        </Select>
        <FieldError messages={state?.errors?.paidById} />
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSplitMode("equal")}
            className={cn(
              "rounded-lg border py-2 text-sm font-medium cursor-pointer transition-colors",
              splitMode === "equal"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            Dividir igualmente
          </button>
          <button
            type="button"
            onClick={() => setSplitMode("custom")}
            className={cn(
              "rounded-lg border py-2 text-sm font-medium cursor-pointer transition-colors",
              splitMode === "custom"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            Valores customizados
          </button>
        </div>

        {splitMode === "equal" ? (
          <div className="space-y-1.5 rounded-lg border border-border p-3">
            {participants.map((p) => (
              <label key={p.userId} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  name="participantIds"
                  value={p.userId}
                  checked={included.has(p.userId)}
                  onChange={() => toggleParticipant(p.userId)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                {displayName(p.user, currentUserId)}
              </label>
            ))}
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border border-border p-3">
            {participants.map((p) => (
              <div key={p.userId} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-foreground">{displayName(p.user, currentUserId)}</span>
                <Input
                  name={`customAmount_${p.userId}`}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  className="w-28"
                  value={customAmounts[p.userId] ?? ""}
                  onChange={(e) =>
                    setCustomAmounts((prev) => ({ ...prev, [p.userId]: e.target.value }))
                  }
                />
              </div>
            ))}
            <p className={cn("text-xs", Math.abs(remaining) < 0.01 ? "text-success" : "text-muted-foreground")}>
              {Math.abs(remaining) < 0.01
                ? "As partes somam o valor total."
                : `Restam ${formatCurrency(remaining)} para distribuir.`}
            </p>
          </div>
        )}
      </div>

      {state?.message ? (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">Adicionar despesa</SubmitButton>
    </form>
  );
}
