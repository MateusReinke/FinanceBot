import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { getFinancingDetail } from "@/lib/queries/financing";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FinancingHeader } from "./financing-header";

export const metadata: Metadata = { title: "Financiamento — FinanceBot" };

export default async function FinancingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await verifySession();
  const financing = await getFinancingDetail(userId, id);
  if (!financing) notFound();

  const pct =
    financing.totalAmount > 0 ? Math.min(100, (financing.paidTotal / financing.totalAmount) * 100) : 0;

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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Parcela</th>
                  <th className="px-3 py-2">Vencimento</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {financing.installments.map((inst) => (
                  <tr key={inst.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5 text-foreground">
                      {inst.installmentNumber}/{financing.installmentCount}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{formatDate(inst.date)}</td>
                    <td className="px-3 py-2.5 text-right text-foreground">
                      {formatCurrency(inst.amount)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          inst.balanceApplied ? "bg-success-bg text-success" : "bg-warning-bg text-warning"
                        )}
                      >
                        {inst.balanceApplied ? "Paga" : "Pendente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Cada parcela também aparece na sua lista de Transações e pode ser editada ou excluída
            por lá se precisar de um ajuste pontual.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
