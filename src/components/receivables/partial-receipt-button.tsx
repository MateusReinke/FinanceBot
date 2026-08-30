"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { CircleDollarSign, Undo2 } from "lucide-react";
import { settlePartialAmount, undoPartialSettlement } from "@/app/actions/transactions";
import { Modal } from "@/components/ui/modal";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { PartialReceipt } from "@/lib/queries/receivables";

// "Recebi só uma parte" — the second half of marking money as received.
//
// "Recebi" next to it covers the whole-amount case in one click; this is for
// the far more common real one, where João hands over R$ 200 of the R$ 500 he
// owes. The one number the user cares about after typing is what is still
// missing, so the form works it out live instead of making them wait for the
// page to come back and tell them.

// Accepts both what the number input produces ("120.5") and what someone
// pasting from their bank app types ("1.200,50"): a comma present means it is
// the decimal separator and the dots are thousands.
function currencyValue(raw: string) {
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function PartialReceiptButton({
  id,
  description,
  remaining,
  received,
  partials,
  type = "income",
}: {
  id: string;
  description: string;
  // What is still open on the entry — already net of `received`.
  remaining: number;
  received: number;
  partials: PartialReceipt[];
  type?: string;
}) {
  const [open, setOpen] = useState(false);
  const isIncome = type === "income";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={isIncome ? "Registrar um recebimento parcial" : "Registrar um pagamento parcial"}
        className={cn(
          "bg-card hover:border-border-strong hover:text-foreground inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
          // A row that already has money against it says so on the button
          // too, so the progress line in the list is not the only place it
          // shows. Written as one branch rather than an appended override:
          // `cn` is plain clsx, so two competing text-* classes would be
          // settled by their order in the stylesheet, not in this list.
          received > 0 ? "border-success/30 text-success" : "border-border text-muted-foreground"
        )}
      >
        <CircleDollarSign className="h-3.5 w-3.5 shrink-0" />
        Parcial
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={isIncome ? "Recebi uma parte" : "Paguei uma parte"}
        description={description}
        icon={CircleDollarSign}
      >
        <PartialReceiptBody
          id={id}
          remaining={remaining}
          received={received}
          partials={partials}
          isIncome={isIncome}
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

function PartialReceiptBody({
  id,
  remaining,
  received,
  partials,
  isIncome,
  onSuccess,
}: {
  id: string;
  remaining: number;
  received: number;
  partials: PartialReceipt[];
  isIncome: boolean;
  onSuccess: () => void;
}) {
  const [state, action] = useActionState(settlePartialAmount, undefined);
  const [raw, setRaw] = useState("");
  const amountId = useId();

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  const typed = currencyValue(raw);
  const entered = typed !== null && typed > 0 ? Math.min(typed, remaining) : 0;
  const original = remaining + received;
  const left = remaining - entered;
  const tooHigh = typed !== null && typed > remaining;

  return (
    <div className="space-y-4">
      <div className="border-border bg-muted/40 space-y-2 rounded-lg border p-3">
        <SummaryLine label="Valor total" value={formatCurrency(original)} />
        {received > 0 ? (
          <SummaryLine
            label={isIncome ? "Já recebido" : "Já pago"}
            value={formatCurrency(received)}
            className="text-success"
          />
        ) : null}
        <SummaryLine
          label="Falta"
          value={formatCurrency(remaining)}
          className="text-foreground font-semibold"
        />
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={id} />

        <div className="space-y-1.5">
          <Label htmlFor={amountId}>
            {isIncome ? "Quanto você recebeu agora?" : "Quanto você pagou agora?"}
          </Label>
          <Input
            id={amountId}
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            max={remaining}
            inputMode="decimal"
            placeholder="0,00"
            autoFocus
            required
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            invalid={tooHigh || !!state?.errors?.amount}
          />
          <FieldError messages={state?.errors?.amount} />

          {/* The whole point of the screen: what is still missing, recomputed
              as the number is typed instead of after a round-trip. */}
          {tooHigh ? (
            <p className="text-danger text-xs" role="alert">
              Esse valor é maior do que os {formatCurrency(remaining)} que faltam.
            </p>
          ) : entered > 0 ? (
            <p className="text-muted-foreground text-xs">
              {left === 0 ? (
                <>Quita o lançamento — ele sai da lista de {isIncome ? "a receber" : "a pagar"}.</>
              ) : (
                <>
                  Ainda vão faltar{" "}
                  <span className="text-foreground font-semibold tabular-nums">
                    {formatCurrency(left)}
                  </span>
                  .
                </>
              )}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Metade seria {formatCurrency(Math.round((remaining / 2) * 100) / 100)}.
            </p>
          )}
        </div>

        {state?.message ? (
          <p className="text-danger text-sm" role="alert">
            {state.message}
          </p>
        ) : null}

        <div className="flex justify-end pt-1">
          <PartialSubmit disabled={entered <= 0 || tooHigh} />
        </div>
      </form>

      {/* Outside the form above on purpose: a <form> nested inside another is
          invalid HTML and the browser silently drops the inner one, so each
          undo gets its own form as a sibling instead. */}
      {partials.length > 0 ? (
        <div className="border-border space-y-2 border-t pt-3">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {isIncome ? "Recebimentos anteriores" : "Pagamentos anteriores"}
          </p>
          <ul className="space-y-1">
            {partials.map((partial) => (
              <li
                key={partial.id}
                className="text-muted-foreground flex items-center justify-between gap-2 text-xs"
              >
                <span>{formatDate(partial.date)}</span>
                <span className="flex items-center gap-1.5">
                  <span className="text-success font-semibold tabular-nums">
                    {formatCurrency(partial.amount)}
                  </span>
                  <UndoPartialForm id={partial.id} isIncome={isIncome} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function PartialSubmit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending || disabled}>
      {pending ? "Salvando..." : "Registrar"}
    </Button>
  );
}

function UndoPartialForm({ id, isIncome }: { id: string; isIncome: boolean }) {
  const label = isIncome ? "Desfazer este recebimento" : "Desfazer este pagamento";
  return (
    <form action={undoPartialSettlement} className="contents">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        title={label}
        aria-label={label}
        className="text-muted-foreground hover:bg-muted hover:text-danger cursor-pointer rounded-md p-1 transition-colors"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

function SummaryLine({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={cn("text-sm tabular-nums", className)}>{value}</span>
    </div>
  );
}
