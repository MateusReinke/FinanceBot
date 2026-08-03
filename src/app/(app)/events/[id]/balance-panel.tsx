import { ArrowRight } from "lucide-react";
import { suggestSettlements, type Balance } from "@/lib/events";
import { displayName } from "@/lib/display-name";
import { formatCurrency, cn } from "@/lib/utils";

type BalanceRow = Balance & { user: { id: string; name: string; email: string }; active: boolean };

export function BalancePanel({
  balanceRows,
  currentUserId,
}: {
  balanceRows: BalanceRow[];
  currentUserId: string;
}) {
  const settlements = suggestSettlements(balanceRows);
  const nameById = new Map(balanceRows.map((b) => [b.userId, displayName(b.user, currentUserId)]));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {balanceRows.map((b) => (
          <div key={b.userId} className="flex items-center justify-between text-sm">
            <span className="text-foreground">
              {displayName(b.user, currentUserId)}
              {!b.active ? <span className="ml-1 text-xs text-muted-foreground">(saiu)</span> : null}
            </span>
            <span
              className={cn(
                "font-semibold",
                b.net > 0.005 ? "text-success" : b.net < -0.005 ? "text-danger" : "text-muted-foreground"
              )}
            >
              {b.net > 0.005 ? `+${formatCurrency(b.net)}` : b.net < -0.005 ? formatCurrency(b.net) : "Quitado"}
            </span>
          </div>
        ))}
      </div>

      {settlements.length > 0 ? (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Para quitar
          </p>
          {settlements.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 text-sm text-foreground">
              <span className="truncate">{nameById.get(s.from)}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{nameById.get(s.to)}</span>
              <span className="ml-auto shrink-0 font-semibold">{formatCurrency(s.amount)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
