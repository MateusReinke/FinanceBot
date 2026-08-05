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

  return (
    <div className="space-y-6">
      <FinancingHeader
        id={financing.id}
        description={financing.description}
        remainingCount={financing.remainingCount}
      />
      <p className="-mt-4 text-sm text-muted-foreground">
        {financing.account.name}
        {financing.category ? ` · ${financing.category.name}` : ""} · Primeira parcela em{" "}
        {formatDate(financing.firstDueDate)}
      </p>

      <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-3", totalSavings > 0.01 && "lg:grid-cols-4")}>
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

      <Card>
        <CardHeader>
          <CardTitle>Parcelas</CardTitle>
        </CardHeader>
        <CardContent>
          <InstallmentTable
            financingId={financing.id}
            installments={financing.installments}
            installmentCount={financing.installmentCount}
            scheduledAmount={financing.installmentAmount}
          />
        </CardContent>
      </Card>
    </div>
  );
}
