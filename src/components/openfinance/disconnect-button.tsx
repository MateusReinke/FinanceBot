"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Unlink } from "lucide-react";

export function DisconnectButton({ pluggyItemId, connectorName }: { pluggyItemId: string; connectorName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDisconnect() {
    if (!confirm(`Desconectar "${connectorName}"? As contas e transações já importadas serão mantidas.`)) return;
    setLoading(true);
    try {
      await fetch(`/api/openfinance/items/${pluggyItemId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDisconnect}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-danger-bg hover:text-danger disabled:opacity-60 cursor-pointer"
    >
      <Unlink className="h-3.5 w-3.5" />
      Desconectar
    </button>
  );
}
