"use client";

import { useFormStatus } from "react-dom";
import { Check, Undo2 } from "lucide-react";
import { confirmTransaction, unconfirmTransaction } from "@/app/actions/transactions";
import { cn } from "@/lib/utils";

// "Marcar como pago" / "Marcar como recebido", and the way back.
//
// Two shapes, same action: a labelled button where there is room to say what
// it does (the bills panel, the a-receber list), and an icon where there is
// not (a dense statement row). The labelled one is the default — the first
// version of this was an icon everywhere, revealed on hover, which meant the
// single most-used action in the app was invisible until you happened to
// mouse over it, and unreachable on a phone.

function PendingLabel({
  children,
  pendingLabel,
}: {
  children: React.ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return <>{pending ? pendingLabel : children}</>;
}

function SubmitOnly({
  className,
  title,
  children,
}: {
  className?: string;
  title: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      title={title}
      aria-label={title}
      className={cn(className, pending && "opacity-50")}
    >
      {children}
    </button>
  );
}

export function ConfirmButton({
  id,
  type,
  variant = "full",
  className,
}: {
  id: string;
  type: string;
  variant?: "full" | "icon";
  className?: string;
}) {
  const isIncome = type === "income";
  const label = isIncome ? "Marcar como recebido" : "Marcar como pago";

  if (variant === "icon") {
    return (
      <form action={confirmTransaction} className="contents">
        <input type="hidden" name="id" value={id} />
        <SubmitOnly
          title={label}
          className="text-muted-foreground hover:bg-success-bg hover:text-success cursor-pointer rounded-md p-1.5 transition-colors"
        >
          <Check className="h-3.5 w-3.5" />
        </SubmitOnly>
      </form>
    );
  }

  return (
    <form action={confirmTransaction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        // hover:text-background rather than a fixed white — see the note in
        // charge-button.tsx: --success flips lightness between themes, so
        // only a token that flips with it stays legible in both.
        className={cn(
          "border-success/30 bg-success-bg text-success hover:bg-success hover:text-background inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
          className
        )}
      >
        <Check className="h-3.5 w-3.5 shrink-0" />
        <PendingLabel pendingLabel="Salvando...">{isIncome ? "Recebi" : "Paguei"}</PendingLabel>
      </button>
    </form>
  );
}

// The way back from a mis-click. Only rendered for rows that can actually be
// reversed — a financing installment is driven by its own schedule and is
// rejected server-side, so offering the button there would be a lie.
export function UndoConfirmButton({
  id,
  type,
  className,
}: {
  id: string;
  type: string;
  className?: string;
}) {
  const label = type === "income" ? "Desmarcar recebimento" : "Desmarcar pagamento";

  return (
    <form action={unconfirmTransaction} className="contents">
      <input type="hidden" name="id" value={id} />
      <SubmitOnly
        title={label}
        className={cn(
          "text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded-md p-1.5 transition-colors",
          className
        )}
      >
        <Undo2 className="h-3.5 w-3.5" />
      </SubmitOnly>
    </form>
  );
}
