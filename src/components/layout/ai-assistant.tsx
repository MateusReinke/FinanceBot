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
        className="text-muted-foreground hover:bg-muted cursor-pointer rounded-md p-2"
        aria-label="Assistente de IA"
        title="Lançar transação por texto"
      >
        <Sparkles className="h-5 w-5" />
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-50 flex justify-end">
              <div className="absolute inset-0 bg-black/40" onClick={close} />
              <div className="border-border bg-card shadow-overlay relative flex h-full w-full max-w-md flex-col border-l">
                <div className="border-border flex items-center justify-between border-b p-4">
                  <h2 className="text-foreground flex items-center gap-2 text-base font-semibold">
                    <Sparkles className="text-primary h-4 w-4" /> Assistente de IA
                  </h2>
                  <button
                    onClick={close}
                    className="text-muted-foreground hover:bg-muted cursor-pointer rounded-md p-1.5"
                    aria-label="Fechar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {!result ? (
                    <div className="space-y-4">
                      <p className="text-muted-foreground text-sm">
                        Descreva um lançamento em texto livre — a IA identifica valor, conta e
                        categoria pra você revisar antes de salvar.
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
                          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
                        />
                        {error ? (
                          <p className="text-danger text-sm" role="alert">
                            {error}
                          </p>
                        ) : null}
                        <Button
                          type="submit"
                          className="w-full"
                          disabled={!text.trim() || isPending}
                        >
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
                        className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1 text-sm"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" /> Editar comando
                      </button>
                      <p className="text-muted-foreground text-sm">
                        Confira os campos antes de confirmar:
                      </p>
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
