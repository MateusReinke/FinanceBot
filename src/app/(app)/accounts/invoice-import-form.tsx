"use client";

import { useEffect, useMemo, useRef, useState, useTransition, useActionState } from "react";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { analyzeInvoice, confirmInvoiceImport } from "@/app/actions/invoice-import";
import { Input, Label, FieldError, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { toDateInputValue, MONTH_NAMES } from "@/lib/utils";

type DraftItem = {
  description: string;
  amount: string;
  date: string;
  categoryId: string | null;
  isInstallment: boolean;
  installmentCurrent: string;
  installmentTotal: string;
  matchedFinancingDescription: string | null;
};

export function InvoiceImportForm({
  accountId,
  onSuccess,
}: {
  accountId: string;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [isAnalyzing, startAnalyzing] = useTransition();

  const [referenceMonth, setReferenceMonth] = useState(new Date().getUTCMonth() + 1);
  const [referenceYear, setReferenceYear] = useState(new Date().getUTCFullYear());
  const [totalAmount, setTotalAmount] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmState, confirmAction] = useActionState(confirmInvoiceImport, undefined);

  useEffect(() => {
    if (confirmState?.success) onSuccess();
  }, [confirmState?.success, onSuccess]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAnalyzeError(null);
    setFile(e.target.files?.[0] ?? null);
  }

  function handleAnalyze() {
    if (!file) return;
    setAnalyzeError(null);
    startAnalyzing(async () => {
      const formData = new FormData();
      formData.set("file", file);
      const result = await analyzeInvoice(accountId, formData);
      if ("error" in result) {
        setAnalyzeError(result.error);
        return;
      }
      setReferenceMonth(result.referenceMonth);
      setReferenceYear(result.referenceYear);
      setTotalAmount(String(result.totalAmount));
      setItems(
        result.items.map((i) => ({
          description: i.description,
          amount: String(i.amount),
          date: i.date,
          categoryId: i.categoryId,
          // Already tracked by an existing financing — default to a plain
          // import (no new schedule) so re-uploading next month's invoice
          // doesn't duplicate the remaining future installments. The user
          // can flip this back on if the match looks wrong.
          isInstallment: Boolean(
            i.installmentCurrent && i.installmentTotal && !i.matchedFinancingId
          ),
          installmentCurrent: i.installmentCurrent ? String(i.installmentCurrent) : "",
          installmentTotal: i.installmentTotal ? String(i.installmentTotal) : "",
          matchedFinancingDescription: i.matchedFinancingDescription,
        }))
      );
      setStep("review");
    });
  }

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }
  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        description: "",
        amount: "",
        date: toDateInputValue(new Date(Date.UTC(referenceYear, referenceMonth - 1, 1))),
        categoryId: null,
        isInstallment: false,
        installmentCurrent: "",
        installmentTotal: "",
        matchedFinancingDescription: null,
      },
    ]);
  }

  const itemsJson = useMemo(
    () =>
      JSON.stringify(
        items.map((item) => ({
          description: item.description,
          amount: Number(item.amount) || 0,
          date: item.date,
          categoryId: item.categoryId ?? undefined,
          installmentCurrent: item.isInstallment
            ? Number(item.installmentCurrent) || undefined
            : undefined,
          installmentTotal: item.isInstallment
            ? Number(item.installmentTotal) || undefined
            : undefined,
        }))
      ),
    [items]
  );

  const newFinancingsCount = items.filter((i) => i.isInstallment).length;

  if (step === "upload") {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Envie o PDF da fatura — a IA identifica os lançamentos do mês, incluindo compras
          parceladas (gerando as parcelas futuras automaticamente), pra você revisar antes de
          salvar.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="invoice-file">PDF da fatura</Label>
          <input
            ref={fileInputRef}
            id="invoice-file"
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="text-foreground file:bg-muted file:text-foreground block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:opacity-80"
          />
        </div>

        {analyzeError ? (
          <p className="text-danger text-sm" role="alert">
            {analyzeError}
          </p>
        ) : null}

        <Button
          type="button"
          className="w-full"
          disabled={!file || isAnalyzing}
          onClick={handleAnalyze}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Lendo fatura...
            </>
          ) : (
            "Analisar fatura"
          )}
        </Button>
      </div>
    );
  }

  return (
    <form action={confirmAction} className="space-y-4">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="referenceMonth" value={referenceMonth} />
      <input type="hidden" name="referenceYear" value={referenceYear} />
      <input type="hidden" name="totalAmount" value={totalAmount} />
      <input type="hidden" name="itemsJson" value={itemsJson} />

      <button
        type="button"
        onClick={() => setStep("upload")}
        className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Trocar arquivo
      </button>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="referenceMonthInput">Mês de referência</Label>
          <Select
            id="referenceMonthInput"
            value={referenceMonth}
            onChange={(e) => setReferenceMonth(Number(e.target.value))}
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="referenceYearInput">Ano</Label>
          <Input
            id="referenceYearInput"
            type="number"
            value={referenceYear}
            onChange={(e) => setReferenceYear(Number(e.target.value) || referenceYear)}
          />
        </div>
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        Usado para posicionar as parcelas futuras das compras parceladas — confira se a IA acertou.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="totalAmountInput">Valor total da fatura (R$)</Label>
        <Input
          id="totalAmountInput"
          type="number"
          step="0.01"
          min="0.01"
          value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value)}
          required
        />
        <p className="text-muted-foreground text-xs">
          Vira o saldo devedor desta conta ao confirmar — ajuste se não bater com o total real.
        </p>
        <FieldError messages={confirmState?.errors?.totalAmount} />
      </div>

      <div className="space-y-2">
        <Label>Lançamentos identificados ({items.length})</Label>
        <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {items.map((item, index) => (
            <div key={index} className="border-border space-y-2 rounded-lg border p-2.5">
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Descrição do item ${index + 1}`}
                  value={item.description}
                  onChange={(e) => updateItem(index, { description: e.target.value })}
                  placeholder="Descrição"
                  className="flex-1"
                />
                <Input
                  aria-label={`Valor do item ${index + 1}`}
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={item.amount}
                  onChange={(e) => updateItem(index, { amount: e.target.value })}
                  placeholder="0,00"
                  className="w-24"
                />
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-muted-foreground hover:bg-danger-bg hover:text-danger shrink-0 cursor-pointer rounded-md p-1.5"
                  aria-label={`Remover item ${index + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label className="text-muted-foreground flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={item.isInstallment}
                    onChange={(e) => updateItem(index, { isInstallment: e.target.checked })}
                    className="border-border accent-primary h-3.5 w-3.5 rounded"
                  />
                  Compra parcelada
                </label>
                {item.isInstallment ? (
                  <>
                    <input
                      aria-label={`Parcela atual do item ${index + 1}`}
                      type="number"
                      min="1"
                      value={item.installmentCurrent}
                      onChange={(e) => updateItem(index, { installmentCurrent: e.target.value })}
                      placeholder="atual"
                      className="border-border bg-background w-14 rounded-md border px-1.5 py-1 text-xs"
                    />
                    <span className="text-muted-foreground">de</span>
                    <input
                      aria-label={`Total de parcelas do item ${index + 1}`}
                      type="number"
                      min="1"
                      value={item.installmentTotal}
                      onChange={(e) => updateItem(index, { installmentTotal: e.target.value })}
                      placeholder="total"
                      className="border-border bg-background w-14 rounded-md border px-1.5 py-1 text-xs"
                    />
                    <span className="text-muted-foreground">gera as parcelas futuras</span>
                  </>
                ) : item.matchedFinancingDescription ? (
                  <span className="text-muted-foreground">
                    Já rastreada em &quot;{item.matchedFinancingDescription}&quot; — não vai
                    duplicar
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addItem}
          className="text-primary inline-flex cursor-pointer items-center gap-1 text-sm hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar item
        </button>
        {confirmState?.errors?.items ? <FieldError messages={confirmState.errors.items} /> : null}
      </div>

      {newFinancingsCount > 0 ? (
        <p className="text-muted-foreground text-xs">
          {newFinancingsCount}{" "}
          {newFinancingsCount === 1
            ? "novo financiamento será criado"
            : "novos financiamentos serão criados"}{" "}
          para as compras parceladas marcadas acima.
        </p>
      ) : null}

      {confirmState?.message ? (
        <p className="text-danger text-sm" role="alert">
          {confirmState.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">Confirmar importação</SubmitButton>
    </form>
  );
}
