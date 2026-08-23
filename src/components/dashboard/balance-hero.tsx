import Link from "next/link";
import { TrendingDown, TrendingUp, Wallet2 } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";

type AccountSummary = { id: string; name: string; balance: number; color: string };

// The balance is the number people open the app for, so it gets its own
// block instead of being the first of four identical cards. It also answers
// the immediate follow-up — "where is that money, and where will it be at
// the end of the month" — without a second click.
export function BalanceHero({
  totalBalance,
  forecastBalance,
  accounts,
}: {
  totalBalance: number;
  forecastBalance: number;
  accounts: AccountSummary[];
}) {
  const delta = forecastBalance - totalBalance;
  const visible = accounts.slice(0, 4);
  const rest = accounts.length - visible.length;

  return (
    // The brightest panel on the page, and the only one that glows: this is
    // the number people opened the app for, so it gets the top of the
    // hierarchy. The two washes are decoration and nothing else — the block
    // still reads if neither of them paints.
    <div className="surface relative overflow-hidden rounded-2xl p-6 shadow-raised">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -left-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Wallet2 className="h-4 w-4 text-accent" /> Saldo total
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-semibold tracking-tight tabular-nums sm:text-[2.5rem] sm:leading-tight",
              totalBalance < 0 ? "text-danger" : "text-foreground"
            )}
          >
            {formatCurrency(totalBalance)}
          </p>
        </div>

        {Math.abs(delta) > 0.005 ? (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Previsto no fim do mês</p>
            <p
              className={cn(
                "flex items-center justify-end gap-1 text-lg font-semibold tabular-nums",
                forecastBalance < 0 ? "text-danger" : "text-foreground"
              )}
            >
              {delta < 0 ? (
                <TrendingDown className="h-4 w-4 text-danger" />
              ) : (
                <TrendingUp className="h-4 w-4 text-success" />
              )}
              {formatCurrency(forecastBalance)}
            </p>
            <p className={cn("text-xs tabular-nums", delta < 0 ? "text-danger" : "text-success")}>
              {delta > 0 ? "+" : ""}
              {formatCurrency(delta)} já agendado
            </p>
          </div>
        ) : null}
      </div>

      {visible.length > 0 ? (
        <div className="relative mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          {visible.map((a) => (
            <Link
              key={a.id}
              href="/accounts"
              className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs transition-colors hover:border-primary"
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
              <span className="max-w-32 truncate text-muted-foreground">{a.name}</span>
              <span
                className={cn(
                  "font-medium tabular-nums",
                  a.balance < 0 ? "text-danger" : "text-foreground"
                )}
              >
                {formatCurrency(a.balance)}
              </span>
            </Link>
          ))}
          {rest > 0 ? (
            <Link
              href="/accounts"
              className="flex items-center rounded-lg border border-dashed border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-foreground"
            >
              +{rest} {rest === 1 ? "conta" : "contas"}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
