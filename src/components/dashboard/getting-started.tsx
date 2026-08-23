import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { dismissGuideChecklist } from "@/app/actions/onboarding";
import type { GuideProgress } from "@/lib/queries/onboarding";
import { cn } from "@/lib/utils";

// The painel's own copy of the first-run guide: what is left to set up,
// ticking itself off as the user does each thing rather than asking them to
// confirm anything. It retires on its own once everything is done, so the
// dismiss button is only there for someone who wants it gone sooner.
export function GettingStarted({ progress }: { progress: GuideProgress }) {
  const { steps, doneCount } = progress;
  // The first thing still undone. Only this one gets a button — a card with
  // four equally weighted calls to action answers "what do I do next?" with
  // "you decide", which is the question the reader had.
  const nextStep = steps.find((s) => !s.done);

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Primeiros passos</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {doneCount} de {steps.length} concluídos — o painel fica completo quando todos
            estiverem marcados.
          </p>
        </div>
        <form action={dismissGuideChecklist}>
          <button
            type="submit"
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Esconder os primeiros passos"
            title="Esconder"
          >
            <X className="h-4 w-4" />
          </button>
        </form>
      </header>

      <div className="flex gap-1 px-5 pt-4" aria-hidden>
        {steps.map((step) => (
          <span
            key={step.id}
            className={cn("h-1 flex-1 rounded-full", step.done ? "bg-success" : "bg-muted")}
          />
        ))}
      </div>

      <ol className="divide-y divide-border px-5">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start gap-3.5 py-4">
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                step.done
                  ? "border-success bg-success text-background"
                  : "border-border-strong text-transparent"
              )}
            >
              <Check className="h-3 w-3" />
              <span className="sr-only">{step.done ? "Concluído" : "Pendente"}</span>
            </span>

            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  step.done ? "text-muted-foreground line-through" : "text-foreground"
                )}
              >
                {step.title}
              </p>
              {step.done ? null : (
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              )}
            </div>

            {step.id === nextStep?.id ? (
              <Link
                href={step.href}
                className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors"
              >
                {step.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : step.done ? null : (
              <Link
                href={step.href}
                className="mt-1 shrink-0 text-xs font-medium text-primary hover:underline"
              >
                {step.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>

      <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
        Perdido? {""}
        <Link href="/bem-vindo" className="font-medium text-primary hover:underline">
          Rever o guia de primeiros passos
        </Link>
        .
      </p>
    </section>
  );
}
