import type { BillsSummary } from "@/lib/queries/bills";
import { Alert } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/utils";

// The alerts that open the dashboard. Ordered by how much trouble each one
// represents, and capped at what genuinely needs saying — three stacked
// banners is a wall the user learns to scroll past, which is worse than one
// they read.
//
// Nothing is invented here: every number comes from getBillsSummary, so an
// alert can never claim something the list below it contradicts.
export function DueAlerts({ bills }: { bills: BillsSummary }) {
  const overdueExpenses = bills.overdue.filter((t) => t.type === "expense");
  const overdueIncome = bills.overdue.filter((t) => t.type === "income");

  const alerts: React.ReactNode[] = [];

  // 1. Bills you are late on. The only alert that pulses, because it is the
  //    only one where waiting costs money.
  if (overdueExpenses.length > 0) {
    alerts.push(
      <Alert
        key="overdue"
        tone="danger"
        pulse
        title={`${overdueExpenses.length === 1 ? "1 conta atrasada" : `${overdueExpenses.length} contas atrasadas`} · ${formatCurrency(bills.overdueTotal)}`}
        action={{ href: "/transactions?status=overdue", label: "Ver contas" }}
      >
        {overdueExpenses.length === 1
          ? `${overdueExpenses[0].description} venceu e ainda não foi paga.`
          : "Essas contas passaram do vencimento e ainda não foram pagas."}
      </Alert>
    );
  }

  // 2. Money that should have reached you and didn't — the other side of
  //    being late, and the one people forget to chase.
  if (overdueIncome.length > 0) {
    alerts.push(
      <Alert
        key="overdue-income"
        tone="warning"
        title={`${overdueIncome.length === 1 ? "1 recebimento atrasado" : `${overdueIncome.length} recebimentos atrasados`} · ${formatCurrency(bills.overdueReceiveTotal)}`}
        action={{ href: "/receivables", label: "Cobrar" }}
      >
        Esse dinheiro já deveria ter entrado.
      </Alert>
    );
  }

  // 3. What is about to come due. Skipped when something is already late —
  //    "you are late" and "something is coming" at the same time buries the
  //    more urgent of the two.
  if (alerts.length === 0 && bills.dueSoonCount > 0) {
    const today = bills.dueTodayCount;
    alerts.push(
      <Alert
        key="soon"
        tone="warning"
        title={
          today > 0
            ? `${today === 1 ? "1 conta vence hoje" : `${today} contas vencem hoje`}`
            : `${bills.dueSoonCount === 1 ? "1 conta vence" : `${bills.dueSoonCount} contas vencem`} nos próximos ${bills.soonDays} dias`
        }
        action={{ href: "/transactions?status=pending", label: "Ver contas" }}
      >
        {formatCurrency(bills.dueSoonTotal)} a pagar até {bills.soonDays} dias.
      </Alert>
    );
  }

  if (alerts.length === 0) return null;

  return <div className="space-y-2">{alerts}</div>;
}
