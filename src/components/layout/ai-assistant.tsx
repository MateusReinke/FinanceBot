"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Loader2, Sparkles, X } from "lucide-react";
import { parseTransactionText, type ParseTransactionResult } from "@/app/actions/ai-assistant";
import { TransactionForm } from "@/app/(app)/transactions/transaction-form";
import { Button } from "@/components/ui/button";

type ParsedTransaction = Exclude<ParseTransactionResult, { error: string }>;

export function AiAssistant({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<ParsedTransaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  function close() {
    setOpen(false);
    setText("");
    setResult(null);
    setError(null);
  }

  function runAnalyze() {
    if (!text.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await parseTransactionText(text);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setResult(res);
    });
  }

  if (!enabled) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md p-2 text-muted-foreground hover:bg-muted cursor-pointer"
        aria-label="Assistente de IA"
        title="Lançar transação por texto"
      >
        <Sparkles className="h-5 w-5" />
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-50 flex justify-end">
              <div className="absolute inset-0 bg-black/40" onClick={close} />
              <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-xl">
                <div className="flex items-center justify-between border-b border-border p-4">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <Sparkles className="h-4 w-4 text-primary" /> Assistente de IA
                  </h2>
                  <button
                    onClick={close}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted cursor-pointer"
                    aria-label="Fechar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {!result ? (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Descreva um lançamento em texto livre — a IA identifica valor, conta e categoria pra
                        você revisar antes de salvar.
                      </p>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          runAnalyze();
                        }}
                        className="space-y-3"
                      >
                        <textarea
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              runAnalyze();
                            }
                          }}
                          placeholder='Ex: "gastei 45 reais no mercado com o nubank"'
                          rows={3}
                          autoFocus
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        {error ? (
                          <p className="text-sm text-danger" role="alert">
                            {error}
                          </p>
                        ) : null}
                        <Button type="submit" className="w-full" disabled={!text.trim() || isPending}>
                          {isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" /> Analisando...
                            </>
                          ) : (
                            "Analisar"
                          )}
                        </Button>
                      </form>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <button
                        type="button"
                        onClick={() => setResult(null)}
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" /> Editar comando
                      </button>
                      <p className="text-sm text-muted-foreground">Confira os campos antes de confirmar:</p>
                      <TransactionForm
                        accounts={result.accounts}
                        categories={result.categories}
                        initial={{
                          description: result.description,
                          amount: result.amount,
                          date: result.date,
                          type: result.type,
                          accountId: result.accountId,
                          categoryId: result.categoryId,
                        }}
                        onSuccess={close}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
