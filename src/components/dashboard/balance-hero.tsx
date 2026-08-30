import Link from "next/link";
import { TrendingDown, TrendingUp, Wallet2 } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
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
  // The composition bar only answers "where is that money" when there is
  // more than one place it could be, and only counts what is actually
  // sitting there — a card's negative balance is debt, not a slice of the
  // total, and would make the bar overrun 100%.
  const positive = accounts.filter((a) => a.balance > 0);
  const positiveTotal = positive.reduce((sum, a) => sum + a.balance, 0);

  return (
    // Top of the hierarchy, earned by type size rather than decoration: the
    // balance is set larger than anything else on the page and nothing sits
    // beside it competing for the first look. The glow that used to do this
    // job made a panel of plain figures look like a promo banner.
    <div className="surface rounded-2xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Wallet2 className="text-accent h-4 w-4" /> Saldo total
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-semibold tracking-tight tabular-nums sm:text-[2.5rem] sm:leading-tight",
              totalBalance < 0 ? "text-danger" : "text-foreground"
            )}
          >
            <AnimatedNumber value={totalBalance} />
          </p>
        </div>

        {Math.abs(delta) > 0.005 ? (
          <div className="text-right">
            <p className="text-muted-foreground text-xs">Previsto no fim do mês</p>
            <p
              className={cn(
                "flex items-center justify-end gap-1 text-lg font-semibold tabular-nums",
                forecastBalance < 0 ? "text-danger" : "text-foreground"
              )}
            >
              {delta < 0 ? (
                <TrendingDown className="text-danger h-4 w-4" />
              ) : (
                <TrendingUp className="text-success h-4 w-4" />
              )}
              <AnimatedNumber value={forecastBalance} />
            </p>
            <p className={cn("text-xs tabular-nums", delta < 0 ? "text-danger" : "text-success")}>
              {delta > 0 ? "+" : ""}
              {formatCurrency(delta)} já agendado
            </p>
          </div>
        ) : null}
      </div>

      {visible.length > 0 ? (
        <div className="border-border mt-5 space-y-3 border-t pt-4">
          {/* A slice per account, proportional to what it actually holds —
              "where is that money" answered as a shape before it's answered
              as a list. */}
          {positive.length > 1 ? (
            <div
              className="bg-muted flex h-1.5 w-full overflow-hidden rounded-full"
              role="img"
              aria-label={`Composição do saldo: ${positive.map((a) => `${a.name} ${formatCurrency(a.balance)}`).join(", ")}`}
            >
              {positive.map((a) => (
                <div
                  key={a.id}
                  style={{
                    width: `${(a.balance / positiveTotal) * 100}%`,
                    backgroundColor: a.color,
                  }}
                  className="h-full transition-[width] duration-500 first:rounded-l-full last:rounded-r-full"
                  title={`${a.name} · ${formatCurrency(a.balance)}`}
                />
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {visible.map((a) => (
              <Link
                key={a.id}
                href="/accounts"
                className="border-border hover:border-primary hover:bg-muted/40 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: a.color }}
                />
                <span className="text-muted-foreground max-w-32 truncate">{a.name}</span>
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
                className="border-border text-muted-foreground hover:border-primary hover:text-foreground flex items-center rounded-lg border border-dashed px-2.5 py-1.5 text-xs transition-colors"
              >
                +{rest} {rest === 1 ? "conta" : "contas"}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
