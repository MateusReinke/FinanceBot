import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { getFinancingDetail } from "@/lib/queries/financing";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FinancingHeader } from "./financing-header";
import { InstallmentTable } from "./installment-table";

export const metadata: Metadata = { title: "Financiamento — FinanceBot" };

export default async function FinancingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await verifySession();
  const financing = await getFinancingDetail(userId, id);
  if (!financing) notFound();

  const pct =
    financing.totalAmount > 0 ? Math.min(100, (financing.paidTotal / financing.totalAmount) * 100) : 0;

  const totalSavings = financing.installments
    .filter((i) => i.balanceApplied)
    .reduce((sum, i) => sum + Math.max(0, financing.installmentAmount - i.amount), 0);

  // A recurring "gasto fixo" schedule is a long practical cap under the
  // hood (see MAX_RECURRING_MONTHS), not a real end date — showing all of
  // it would dump hundreds of rows, and "X of 600 paid" / a completion bar
  // isn't a meaningful thing to show for it. Only a window around the
  // present is rendered instead.
  const visibleInstallments = financing.isRecurring
    ? (() => {
        const firstPendingIdx = financing.installments.findIndex((i) => !i.balanceApplied);
        const centerIdx = firstPendingIdx === -1 ? financing.installments.length - 1 : firstPendingIdx;
        const start = Math.max(0, centerIdx - 2);
        return financing.installments.slice(start, start + 6);
      })()
    : financing.installments;

  return (
    <div className="space-y-6">
      <FinancingHeader
        id={financing.id}
        description={financing.description}
        remainingCount={financing.remainingCount}
        isRecurring={financing.isRecurring}
      />
      <p className="-mt-4 text-sm text-muted-foreground">
        {financing.account.name}
        {financing.category ? ` · ${financing.category.name}` : ""} ·{" "}
        {financing.isRecurring ? "Gasto fixo desde" : "Primeira parcela em"}{" "}
        {formatDate(financing.firstDueDate)}
      </p>

      {financing.isRecurring ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard label="Valor por mês" value={formatCurrency(financing.installmentAmount)} />
          <StatCard
            label="Já pago até agora"
            value={formatCurrency(financing.paidTotal)}
            valueClassName="text-success"
          />
        </div>
      ) : (
        <>
          <div
            className={cn("grid grid-cols-1 gap-3 sm:grid-cols-3", totalSavings > 0.01 && "lg:grid-cols-4")}
          >
            <StatCard label="Total do financiamento" value={formatCurrency(financing.totalAmount)} />
            <StatCard
              label="Já pago"
              value={formatCurrency(financing.paidTotal)}
              valueClassName="text-success"
            />
            <StatCard
              label="Restante"
              value={formatCurrency(financing.remainingTotal)}
              valueClassName={financing.remainingTotal > 0 ? "text-danger" : "text-success"}
            />
            {totalSavings > 0.01 ? (
              <StatCard
                label="Economia total"
                value={formatCurrency(totalSavings)}
                valueClassName="text-success"
              />
            ) : null}
          </div>

          <Card>
            <CardContent className="pt-5">
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {financing.paidCount} de {financing.installmentCount} parcelas pagas
                </span>
                <span className="font-medium text-foreground">{pct.toFixed(0)}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{financing.isRecurring ? "Cobranças recentes e próximas" : "Parcelas"}</CardTitle>
        </CardHeader>
        <CardContent>
          <InstallmentTable
            financingId={financing.id}
            installments={visibleInstallments}
            installmentCount={financing.installmentCount}
            scheduledAmount={financing.installmentAmount}
            isRecurring={financing.isRecurring}
          />
        </CardContent>
      </Card>
    </div>
  );
}
