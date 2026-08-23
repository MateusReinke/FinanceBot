"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Users, User, Check } from "lucide-react";
import { addExpense } from "@/app/actions/events";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { displayName } from "@/lib/display-name";
import { formatCurrency, toDateInputValue, cn } from "@/lib/utils";

type Participant = { userId: string; user: { id: string; name: string; email: string } };

// Three questions, asked one at a time, because answering them together is
// what made the old single-screen form confusing: "quanto custou", "quem
// pagou" and "de quem é" are independent, and conflating payer with
// beneficiary is the mistake that produces wrong balances.
const STEPS = ["O que foi", "Quem pagou", "De quem é"] as const;

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
  const [step, setStep] = useState(0);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(toDateInputValue(new Date()));

  // Defaults to "I paid all of it", which is the overwhelmingly common
  // case; the multi-payer inputs only appear when asked for.
  const [multiPayer, setMultiPayer] = useState(false);
  const [singlePayer, setSinglePayer] = useState(currentUserId);
  const [paidAmounts, setPaidAmounts] = useState<Record<string, string>>({});

  const [isShared, setIsShared] = useState(true);
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [included, setIncluded] = useState<Set<string>>(new Set(participants.map((p) => p.userId)));
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  const total = Number(amount) || 0;
  const paidSum = useMemo(
    () =>
      multiPayer
        ? Object.values(paidAmounts).reduce((sum, v) => sum + (Number(v) || 0), 0)
        : total,
    [multiPayer, paidAmounts, total]
  );
  const paidRemaining = Math.round((total - paidSum) * 100) / 100;
  const customSum = useMemo(
    () => Object.values(customAmounts).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [customAmounts]
  );
  const splitRemaining = Math.round((total - customSum) * 100) / 100;

  const step0Valid = description.trim().length > 0 && total > 0 && Boolean(date);
  const step1Valid = multiPayer ? Math.abs(paidRemaining) < 0.01 : Boolean(singlePayer);
  const canSubmit =
    step0Valid &&
    step1Valid &&
    (!isShared
      ? !multiPayer
      : splitMode === "equal"
        ? included.size > 0
        : Math.abs(splitRemaining) < 0.01);

  function toggleParticipant(userId: string) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  // A personal expense is one person's, so the multi-payer step cannot
  // apply to it — flipping to "só minha" collapses the payer back down.
  function setPersonal() {
    setIsShared(false);
    setMultiPayer(false);
  }

  const nameOf = (p: Participant) => displayName(p.user, currentUserId);

  return (
    <form action={action} className="space-y-4">
      {/* Every value is posted from here, never from the visible inputs.
          Only one step is mounted at a time, so a field that lives inside a
          step simply would not be in the FormData when the last step
          submits — which is exactly how the first version silently created
          nothing at all. */}
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="description" value={description} />
      <input type="hidden" name="amount" value={amount} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="splitMode" value={splitMode} />
      <input type="hidden" name="isShared" value={isShared ? "true" : "false"} />
      {/* The payer step always posts as amounts, single payer included, so
          the server has exactly one shape to read. */}
      {multiPayer
        ? participants.map((p) => (
            <input
              key={p.userId}
              type="hidden"
              name={`paidAmount_${p.userId}`}
              value={paidAmounts[p.userId] ?? ""}
            />
          ))
        : (
            <input type="hidden" name={`paidAmount_${singlePayer}`} value={amount} />
          )}
      {isShared && splitMode === "equal"
        ? [...included].map((id) => (
            <input key={id} type="hidden" name="participantIds" value={id} />
          ))
        : null}
      {isShared && splitMode === "custom"
        ? participants.map((p) => (
            <input
              key={p.userId}
              type="hidden"
              name={`customAmount_${p.userId}`}
              value={customAmounts[p.userId] ?? ""}
            />
          ))
        : null}

      <ol className="flex items-center gap-1.5">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-1.5">
            <button
              type="button"
              onClick={() => (i < step || step0Valid ? setStep(i) : undefined)}
              disabled={i > step && !step0Valid}
              className={cn(
                "flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                i === step
                  ? "border-primary bg-primary/10 text-primary"
                  : i < step
                    ? "cursor-pointer border-border text-muted-foreground hover:bg-muted"
                    : "border-border text-muted-foreground/60"
              )}
            >
              {i < step ? <Check className="mr-1 inline h-3 w-3" /> : `${i + 1}. `}
              {label}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Ex: Jantar"
              required
              autoFocus
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <FieldError messages={state?.errors?.description} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Valor total (R$)</Label>
              <Input
                id="amount"
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
              <Input
                id="date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <FieldError messages={state?.errors?.date} />
            </div>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-3">
          {!multiPayer ? (
            <>
              <div className="space-y-1.5">
                <Label>Quem pagou os {formatCurrency(total)}</Label>
                <div className="space-y-1 rounded-lg border border-border p-2">
                  {participants.map((p) => (
                    <label
                      key={p.userId}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted"
                    >
                      <input
                        type="radio"
                        checked={singlePayer === p.userId}
                        onChange={() => setSinglePayer(p.userId)}
                        className="h-4 w-4 accent-[var(--primary)]"
                      />
                      {nameOf(p)}
                    </label>
                  ))}
                </div>
              </div>
              {isShared ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setMultiPayer(true)}>
                  Mais de uma pessoa pagou
                </Button>
              ) : null}
            </>
          ) : (
            <div className="space-y-2">
              <Label>Quanto cada um pôs</Label>
              <div className="space-y-2 rounded-lg border border-border p-3">
                {participants.map((p) => (
                  <div key={p.userId} className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-foreground">{nameOf(p)}</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      className="w-28"
                      value={paidAmounts[p.userId] ?? ""}
                      onChange={(e) =>
                        setPaidAmounts((prev) => ({ ...prev, [p.userId]: e.target.value }))
                      }
                    />
                  </div>
                ))}
                <p
                  className={cn(
                    "text-xs",
                    Math.abs(paidRemaining) < 0.01 ? "text-success" : "text-muted-foreground"
                  )}
                >
                  {Math.abs(paidRemaining) < 0.01
                    ? "Bate com o valor total."
                    : `Faltam ${formatCurrency(paidRemaining)} para fechar os ${formatCurrency(total)}.`}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setMultiPayer(false)}>
                Foi uma pessoa só
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsShared(true)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-sm font-medium transition-colors",
                isShared
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              <Users className="h-4 w-4" />
              Compartilhada
              <span className="text-xs font-normal opacity-80">o grupo vê e divide</span>
            </button>
            <button
              type="button"
              onClick={setPersonal}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-sm font-medium transition-colors",
                !isShared
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              <User className="h-4 w-4" />
              Só minha
              <span className="text-xs font-normal opacity-80">ninguém mais vê</span>
            </button>
          </div>

          {!isShared ? (
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              Fica registrada só para quem pagou, não entra na divisão e ninguém fica devendo nada
              por ela. Serve para o que você gastou por conta própria durante o evento.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSplitMode("equal")}
                  className={cn(
                    "rounded-lg border py-2 text-sm font-medium transition-colors",
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
                    "rounded-lg border py-2 text-sm font-medium transition-colors",
                    splitMode === "custom"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  Valores diferentes
                </button>
              </div>

              {splitMode === "equal" ? (
                <div className="space-y-1 rounded-lg border border-border p-3">
                  <p className="pb-1 text-xs text-muted-foreground">
                    Desmarque quem não entra nesta despesa.
                  </p>
                  {participants.map((p) => (
                    <label
                      key={p.userId}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-1.5 text-sm text-foreground hover:bg-muted"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={included.has(p.userId)}
                          onChange={() => toggleParticipant(p.userId)}
                          className="h-4 w-4 rounded border-border accent-[var(--primary)]"
                        />
                        {nameOf(p)}
                      </span>
                      {included.has(p.userId) && included.size > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(total / included.size)}
                        </span>
                      ) : null}
                    </label>
                  ))}
                  {included.size === 0 ? (
                    <p className="text-xs text-danger">Selecione ao menos uma pessoa.</p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    Deixe em branco ou zero quem não entra nesta despesa.
                  </p>
                  {participants.map((p) => (
                    <div key={p.userId} className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-foreground">{nameOf(p)}</span>
                      <Input
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
                  <p
                    className={cn(
                      "text-xs",
                      Math.abs(splitRemaining) < 0.01 ? "text-success" : "text-muted-foreground"
                    )}
                  >
                    {Math.abs(splitRemaining) < 0.01
                      ? "As partes somam o valor total."
                      : `Restam ${formatCurrency(splitRemaining)} para distribuir.`}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      {state?.message ? (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="flex gap-2">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
            Voltar
          </Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            className="flex-1"
            disabled={step === 0 ? !step0Valid : !step1Valid}
            onClick={() => setStep(step + 1)}
          >
            Continuar
          </Button>
        ) : (
          <SubmitButton className="flex-1" disabled={!canSubmit}>
            Adicionar despesa
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
