import type { PluggyItem } from "@prisma/client";
import { Landmark } from "lucide-react";
import { ConnectBankButton } from "./connect-button";
import { SyncButton } from "./sync-button";
import { DisconnectButton } from "./disconnect-button";
import { getPluggyStatusMeta, NEEDS_RECONNECT_STATUSES } from "@/lib/pluggy-status";
import { cn } from "@/lib/utils";

function relativeSync(date: Date | null) {
  if (!date) return "Nunca sincronizado";
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "Sincronizado agora";
  if (minutes < 60) return `Sincronizado há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Sincronizado há ${hours}h`;
  const days = Math.round(hours / 24);
  return `Sincronizado há ${days}d`;
}

export function OpenFinanceSection({
  pluggyItems,
  clientUserId,
  includeSandbox,
}: {
  pluggyItems: PluggyItem[];
  clientUserId?: string;
  includeSandbox: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Open Finance</h2>
          <p className="text-sm text-muted-foreground">
            Conecte suas contas bancárias para importar transações automaticamente.
          </p>
        </div>
        <ConnectBankButton clientUserId={clientUserId} includeSandbox={includeSandbox} />
      </div>

      {pluggyItems.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pluggyItems.map((item) => {
            const statusMeta = getPluggyStatusMeta(item.status);
            const needsReconnect = NEEDS_RECONNECT_STATUSES.has(item.status);
            return (
              <div key={item.id} className="flex flex-col gap-3 surface p-4">
                <div className="flex items-center gap-3">
                  {item.connectorImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.connectorImageUrl}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full border border-border object-contain bg-white"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Landmark className="h-4 w-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{item.connectorName}</p>
                    <p className="text-xs text-muted-foreground">{relativeSync(item.lastSyncedAt)}</p>
                  </div>
                </div>

                <span
                  className={cn(
                    "w-fit rounded-full px-2 py-0.5 text-xs font-medium",
                    statusMeta.tone === "success" && "bg-success-bg text-success",
                    statusMeta.tone === "warning" && "bg-warning-bg text-warning",
                    statusMeta.tone === "danger" && "bg-danger-bg text-danger"
                  )}
                >
                  {statusMeta.label}
                </span>

                <div className="flex items-center gap-1 border-t border-border pt-2">
                  {needsReconnect ? (
                    <ConnectBankButton
                      clientUserId={clientUserId}
                      includeSandbox={includeSandbox}
                      itemId={item.pluggyItemId}
                      label="Reautenticar"
                      variant="outline"
                      size="sm"
                    />
                  ) : (
                    <SyncButton pluggyItemId={item.id} />
                  )}
                  <DisconnectButton pluggyItemId={item.id} connectorName={item.connectorName} />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
