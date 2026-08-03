"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

const PLUGGY_CONNECT_SRC = "https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js";

function loadPluggyScript(): Promise<void> {
  if (typeof window !== "undefined" && window.PluggyConnect) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PLUGGY_CONNECT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar widget.")));
      return;
    }
    const script = document.createElement("script");
    script.src = PLUGGY_CONNECT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar widget."));
    document.body.appendChild(script);
  });
}

export function ConnectBankButton({
  clientUserId,
  includeSandbox,
  itemId,
  label = "Conectar banco",
  variant = "primary",
  size = "md",
}: {
  clientUserId?: string;
  includeSandbox: boolean;
  itemId?: string;
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "opening" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const handleClick = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    setStatus("opening");

    try {
      await loadPluggyScript();

      const res = await fetch("/api/openfinance/connect-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemId ? { itemId } : {}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Não foi possível iniciar a conexão.");
      }
      const { accessToken } = (await res.json()) as { accessToken: string };

      if (!window.PluggyConnect) throw new Error("Widget não carregado.");

      const widget = new window.PluggyConnect({
        connectToken: accessToken,
        includeSandbox,
        clientUserId,
        updateItem: itemId,
        onSuccess: async (itemData) => {
          setStatus("saving");
          try {
            const saveRes = await fetch("/api/openfinance/items", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ itemId: itemData.item.id }),
            });
            if (!saveRes.ok) {
              const body = await saveRes.json().catch(() => ({}));
              throw new Error(body.error ?? "Não foi possível concluir a conexão.");
            }
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Não foi possível concluir a conexão.");
          } finally {
            setStatus("idle");
            busy.current = false;
          }
        },
        onError: () => {
          setError("A conexão com o banco falhou. Tente novamente.");
          setStatus("idle");
          busy.current = false;
        },
        onClose: () => {
          setStatus((s) => (s === "opening" ? "idle" : s));
          busy.current = false;
        },
      });
      widget.init();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível iniciar a conexão.");
      setStatus("idle");
      busy.current = false;
    }
  }, [clientUserId, includeSandbox, itemId, router]);

  return (
    <div className="space-y-1.5">
      <Button type="button" variant={variant} size={size} onClick={handleClick} disabled={status !== "idle"}>
        {status !== "idle" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Landmark className="h-4 w-4" />
        )}
        {status === "saving" ? "Importando dados..." : status === "opening" ? "Abrindo..." : label}
      </Button>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
