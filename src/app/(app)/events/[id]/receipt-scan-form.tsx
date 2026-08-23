"use client";

import { useEffect, useMemo, useRef, useState, useTransition, useActionState } from "react";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { extractReceiptExpenses, confirmReceiptExpenses } from "@/app/actions/events";
import { Input, Label, FieldError, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { displayName } from "@/lib/display-name";
import { formatCurrency, toDateInputValue } from "@/lib/utils";

type Participant = { userId: string; user: { id: string; name: string; email: string } };
type DraftItem = { description: string; amount: string };

export function ReceiptScanForm({
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
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [isAnalyzing, startAnalyzing] = useTransition();

  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [included, setIncluded] = useState<Set<string>>(new Set(participants.map((p) => p.userId)));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmState, confirmAction] = useActionState(confirmReceiptExpenses, undefined);

  useEffect(() => {
    if (confirmState?.success) onSuccess();
  }, [confirmState?.success, onSuccess]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setAnalyzeError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  }

  function handleAnalyze() {
    if (!file) return;
    setAnalyzeError(null);
    startAnalyzing(async () => {
      const formData = new FormData();
      formData.set("file", file);
      const result = await extractReceiptExpenses(eventId, formData);
      if ("error" in result) {
        setAnalyzeError(result.error);
        return;
      }
      setReceiptId(result.receiptId);
      setItems(result.items.map((i) => ({ description: i.description, amount: String(i.amount) })));
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
    setItems((prev) => [...prev, { description: "", amount: "" }]);
  }

  function toggleParticipant(userId: string) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  const total = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [items]
  );
  const itemsJson = useMemo(
    () =>
      JSON.stringify(
        items.map((item) => ({ description: item.description, amount: Number(item.amount) || 0 }))
      ),
    [items]
  );

  if (step === "upload") {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Envie uma foto da nota fiscal — a IA lê os itens e sugere uma despesa para cada um, pra
          você revisar antes de salvar.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="receipt-file">Foto da nota</Label>
          <input
            ref={fileInputRef}
            id="receipt-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="text-foreground file:bg-muted file:text-foreground block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:opacity-80"
          />
        </div>

        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Pré-visualização da nota fiscal"
            className="border-border max-h-64 w-full rounded-lg border object-contain"
          />
        ) : null}

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
              <Loader2 className="h-4 w-4 animate-spin" /> Lendo nota...
            </>
          ) : (
            "Analisar nota"
          )}
        </Button>
      </div>
    );
  }

  return (
    <form action={confirmAction} className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="receiptId" value={receiptId ?? ""} />
      <input type="hidden" name="itemsJson" value={itemsJson} />

      <button
        type="button"
        onClick={() => setStep("upload")}
        className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Trocar foto
      </button>

      <div className="space-y-2">
        <Label>Itens identificados</Label>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
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
          ))}
        </div>
        <button
          type="button"
          onClick={addItem}
          className="text-primary inline-flex cursor-pointer items-center gap-1 text-sm hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar item
        </button>
        <p className="text-foreground text-right text-sm font-medium">
          Total: {formatCurrency(total)}
        </p>
        {confirmState?.errors?.items ? <FieldError messages={confirmState.errors.items} /> : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="paidById">Quem pagou</Label>
          <Select id="paidById" name="paidById" defaultValue={currentUserId} required>
            {participants.map((p) => (
              <option key={p.userId} value={p.userId}>
                {displayName(p.user, currentUserId)}
              </option>
            ))}
          </Select>
          <FieldError messages={confirmState?.errors?.paidById} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Data</Label>
          <Input
            id="date"
            name="date"
            type="date"
            defaultValue={toDateInputValue(new Date())}
            required
          />
          <FieldError messages={confirmState?.errors?.date} />
        </div>
      </div>

      <div className="border-border space-y-1.5 rounded-lg border p-3">
        <Label>Dividir igualmente entre</Label>
        {participants.map((p) => (
          <label key={p.userId} className="text-foreground flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="participantIds"
              value={p.userId}
              checked={included.has(p.userId)}
              onChange={() => toggleParticipant(p.userId)}
              className="border-border accent-primary h-4 w-4 rounded"
            />
            {displayName(p.user, currentUserId)}
          </label>
        ))}
      </div>

      {confirmState?.message ? (
        <p className="text-danger text-sm" role="alert">
          {confirmState.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">
        Confirmar e salvar {items.length} {items.length === 1 ? "despesa" : "despesas"}
      </SubmitButton>
    </form>
  );
}
