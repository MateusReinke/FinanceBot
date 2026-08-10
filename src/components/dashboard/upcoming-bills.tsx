import Link from "next/link";
import { AlertCircle, CalendarClock } from "lucide-react";
import type { BillsSummary } from "@/lib/queries/bills";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

// The "contas a pagar / a receber" panel every finance app leads with: what slipped
// past its due date, what lands next, and where the balance ends up once
// the month clears. All of it reads from occurrences that already exist as
// pending Transaction rows — nothing is projected on the fly.
export function UpcomingBills({ bills }: { bills: BillsSummary }) {
  const rows = [...bills.overdue, ...bills.upcoming].slice(0, 6);
  if (rows.length === 0) return null;

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Próximos vencimentos</CardTitle>
        <Link href="/financings" className="text-xs font-medium text-primary hover:underline">
          Ver todas
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {bills.overdueTotal > 0 ? (
          <div className="flex items-center gap-2 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              {bills.overdue.length === 1 ? "1 conta atrasada" : `${bills.overdue.length} contas atrasadas`} ·{" "}
              {formatCurrency(bills.overdueTotal)}
            </span>
          </div>
        ) : null}

        <ul className="divide-y divide-border">
          {rows.map((t) => {
            const late = t.date < today;
            const isIncome = t.type === "income";
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{t.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.account.name} · {formatDate(t.date)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {late ? (
                    <span className="rounded-full bg-danger-bg px-2 py-0.5 text-xs font-medium text-danger">
                      Atrasada
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      isIncome ? "text-success" : "text-foreground"
                    )}
                  >
                    {isIncome ? "+" : "−"}
                    {formatCurrency(t.amount)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        <div
          className={cn(
            "grid gap-3 border-t border-border pt-3 text-sm",
            bills.toReceiveTotal > 0 ? "grid-cols-3" : "grid-cols-2"
          )}
        >
          <div>
            <p className="text-muted-foreground">A pagar em {bills.upcomingDays} dias</p>
            <p className="font-semibold text-foreground">{formatCurrency(bills.toPayTotal)}</p>
          </div>
          {bills.toReceiveTotal > 0 ? (
            <div>
              <p className="text-muted-foreground">A receber</p>
              <p className="font-semibold text-success">{formatCurrency(bills.toReceiveTotal)}</p>
            </div>
          ) : null}
          <div>
            <p className="text-muted-foreground">Saldo previsto no fim do mês</p>
            <p
              className={cn(
                "font-semibold",
                bills.forecastBalance < 0 ? "text-danger" : "text-foreground"
              )}
            >
              {formatCurrency(bills.forecastBalance)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Shown in place of the panel when the user has no schedules at all, so the
// feature is discoverable instead of silently absent.
export function UpcomingBillsEmpty() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <CalendarClock className="h-7 w-7 text-muted-foreground" />
        <p className="max-w-sm text-sm text-muted-foreground">
          Cadastre seus gastos fixos (aluguel, assinaturas) e o salário para ver aqui o que vence
          nos próximos dias e como o saldo termina o mês.
        </p>
        <Link href="/financings" className="text-sm font-medium text-primary hover:underline">
          Cadastrar lançamento fixo →
        </Link>
      </CardContent>
    </Card>
  );
}
