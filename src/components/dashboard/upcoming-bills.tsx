import Link from "next/link";
import { CalendarClock, User } from "lucide-react";
import type { BillsSummary } from "@/lib/queries/bills";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CategoryIcon } from "@/components/ui/category-icon";
import { DueChip, urgencyRail } from "@/components/ui/due-chip";
import { ConfirmButton } from "@/components/transactions/confirm-buttons";
import { urgencyOf } from "@/lib/due-dates";
import { formatCurrency, cn } from "@/lib/utils";

const ROW_LIMIT = 7;

// The "contas a pagar / a receber" panel every finance app leads with: what
// slipped past its due date, what lands next, and where the balance ends up
// once the month clears. All of it reads from occurrences that already exist
// as pending Transaction rows — nothing is projected on the fly.
//
// Every row carries its own confirm button. Seeing that rent is overdue and
// having to go to another screen to say "I paid it" was the panel's biggest
// flaw: it reported problems it couldn't help you close.
export function UpcomingBills({ bills }: { bills: BillsSummary }) {
  // Late first, then by date — the order the user has to act in.
  const rows = [...bills.overdue, ...bills.upcoming].slice(0, ROW_LIMIT);
  const hidden = bills.overdue.length + bills.upcoming.length - rows.length;
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Próximos vencimentos</CardTitle>
        <Link
          href="/transactions?status=pending"
          className="text-primary text-xs font-medium hover:underline"
        >
          Ver todos
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="border-border overflow-hidden rounded-lg border">
          {rows.map((t) => {
            const urgency = urgencyOf(t.date);
            const isIncome = t.type === "income";
            const color = t.category?.color ?? "#94a3b8";
            return (
              <li
                key={t.id}
                className={cn(
                  "border-border flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2.5 last:border-b-0",
                  urgencyRail(urgency),
                  urgency === "overdue" && "bg-danger-bg/25"
                )}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  <CategoryIcon icon={t.category?.icon} className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">{t.description}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {t.account.name}
                    {t.counterparty ? (
                      <span>
                        {" · "}
                        <User className="mr-0.5 inline h-3 w-3 align-[-1px]" />
                        {t.counterparty}
                      </span>
                    ) : null}
                  </p>
                </div>

                {/* Own line on a phone: the description is what identifies
                    the bill, and it lost that fight against three controls
                    competing for 390px. */}
                <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                  <DueChip date={t.date} type={t.type} />

                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      isIncome ? "text-success" : "text-foreground"
                    )}
                  >
                    {isIncome ? "+" : "−"}
                    {formatCurrency(t.amount)}
                  </span>

                  <ConfirmButton id={t.id} type={t.type} />
                </div>
              </li>
            );
          })}
        </ul>

        {hidden > 0 ? (
          <Link
            href="/transactions?status=pending"
            className="text-primary block text-center text-xs font-medium hover:underline"
          >
            +{hidden} {hidden === 1 ? "outro vencimento" : "outros vencimentos"}
          </Link>
        ) : null}

        <div className="border-border grid gap-3 border-t pt-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground text-xs">A pagar em {bills.upcomingDays} dias</p>
            <p className="text-foreground font-semibold tabular-nums">
              {formatCurrency(bills.upcomingPayTotal)}
            </p>
            {bills.overdueTotal > 0 ? (
              <p className="text-danger text-xs">+ {formatCurrency(bills.overdueTotal)} atrasado</p>
            ) : null}
          </div>
          <div>
            <p className="text-muted-foreground text-xs">A receber</p>
            <p className="text-success font-semibold tabular-nums">
              {formatCurrency(bills.toReceiveTotal)}
            </p>
            {bills.overdueReceiveTotal > 0 ? (
              <Link href="/receivables" className="text-danger text-xs hover:underline">
                {formatCurrency(bills.overdueReceiveTotal)} atrasado — cobrar
              </Link>
            ) : null}
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Saldo previsto no fim do mês</p>
            <p
              className={cn(
                "font-semibold tabular-nums",
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
        <CalendarClock className="text-muted-foreground h-7 w-7" />
        <p className="text-muted-foreground max-w-sm text-sm">
          Cadastre seus gastos fixos (aluguel, assinaturas) e o salário para ver aqui o que vence
          nos próximos dias e como o saldo termina o mês.
        </p>
        <Link href="/financings" className="text-primary text-sm font-medium hover:underline">
          Cadastrar lançamento fixo →
        </Link>
      </CardContent>
    </Card>
  );
}
