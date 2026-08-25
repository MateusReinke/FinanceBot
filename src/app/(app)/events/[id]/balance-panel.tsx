import { ArrowRight } from "lucide-react";
import { suggestSettlements, type Balance } from "@/lib/events";
import { displayName } from "@/lib/display-name";
import { formatCurrency, cn } from "@/lib/utils";

type BalanceRow = Balance & {
  user: { id: string; name: string; email: string };
  active: boolean;
  // Everything this person put in, personal spending included — shown apart
  // from the balance, which only ever counts shared expenses.
  personalTotal: number;
};

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
              {!b.active ? (
                <span className="text-muted-foreground ml-1 text-xs">(saiu)</span>
              ) : null}
              {b.userId === currentUserId && b.personalTotal > b.paid + 0.005 ? (
                <span className="text-muted-foreground ml-1 text-xs">
                  · gastou {formatCurrency(b.personalTotal)} no total
                </span>
              ) : null}
            </span>
            <span
              className={cn(
                "font-semibold",
                b.net > 0.005
                  ? "text-success"
                  : b.net < -0.005
                    ? "text-danger"
                    : "text-muted-foreground"
              )}
            >
              {b.net > 0.005
                ? `+${formatCurrency(b.net)}`
                : b.net < -0.005
                  ? formatCurrency(b.net)
                  : "Quitado"}
            </span>
          </div>
        ))}
      </div>

      {settlements.length > 0 ? (
        <div className="border-border space-y-2 border-t pt-3">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Para quitar
          </p>
          {settlements.map((s, i) => (
            <div key={i} className="text-foreground flex items-center gap-1.5 text-sm">
              <span className="truncate">{nameById.get(s.from)}</span>
              <ArrowRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{nameById.get(s.to)}</span>
              <span className="ml-auto shrink-0 font-semibold">{formatCurrency(s.amount)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
