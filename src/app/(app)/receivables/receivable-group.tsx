import { User, HelpCircle } from "lucide-react";
import type { ReceivableGroup } from "@/lib/queries/receivables";
import { CategoryIcon } from "@/components/ui/category-icon";
import { DueChip, urgencyRail } from "@/components/ui/due-chip";
import { ConfirmButton } from "@/components/transactions/confirm-buttons";
import { ChargeButton } from "@/components/receivables/charge-button";
import { urgencyOf } from "@/lib/due-dates";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

const chargedFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

// One person's card: what they owe in total, every entry behind that total,
// and the two things the user actually wants to do — cobrar, or mark it
// received because they finally paid.
export function ReceivableGroupCard({
  group,
  senderName,
}: {
  group: ReceivableGroup;
  senderName?: string;
}) {
  const named = group.counterparty !== null;
  const ids = group.rows.map((r) => r.id);
  const items = group.rows.map((r) => ({
    description: r.description,
    amount: r.amount,
    date: r.date,
  }));
  // Only mention a previous charge when every entry has already been
  // chased — "cobrado em 12/08" over a list where one row is brand new
  // would be wrong about the new one.
  const lastCharged = group.rows.every((r) => r.chargedAt)
    ? group.rows.reduce<Date | null>(
        (latest, r) => (r.chargedAt && (!latest || r.chargedAt > latest) ? r.chargedAt : latest),
        null
      )
    : null;

  return (
    <div
      className={cn(
        "bg-card shadow-card overflow-hidden rounded-xl border",
        group.overdueCount > 0 ? "border-danger/30" : "border-border"
      )}
    >
      <div
        className={cn(
          "border-border flex flex-wrap items-center gap-3 border-b px-4 py-3",
          group.overdueCount > 0 && "bg-danger-bg/40"
        )}
      >
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            named ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          {named ? <User className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-semibold">
            {group.counterparty ?? "Sem pessoa definida"}
          </p>
          <p className="text-muted-foreground text-xs">
            {group.rows.length === 1 ? "1 lançamento" : `${group.rows.length} lançamentos`}
            {group.overdueCount > 0 ? (
              <span className="text-danger font-medium">
                {" "}
                · {group.overdueCount} em atraso ({formatCurrency(group.overdueTotal)})
              </span>
            ) : null}
            {lastCharged ? (
              <span className="text-muted-foreground">
                {" "}
                · cobrado em {chargedFormatter.format(lastCharged)}
              </span>
            ) : null}
          </p>
        </div>

        {/* w-full on mobile so this drops to its own line instead of
            squeezing the name next to it down to an ellipsis — at 390px the
            amount plus the charge button leave nothing for the person's
            name, which is the one thing this header exists to show. */}
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
          <span
            className={cn(
              "text-lg font-semibold tabular-nums",
              group.overdueCount > 0 ? "text-danger" : "text-success"
            )}
          >
            {formatCurrency(group.total)}
          </span>
          {named ? (
            <ChargeButton
              ids={ids}
              name={group.counterparty}
              phone={group.phone}
              items={items}
              senderName={senderName}
            />
          ) : null}
        </div>
      </div>

      <ul className="divide-border divide-y">
        {group.rows.map((row) => {
          const urgency = urgencyOf(row.date);
          return (
            <li
              key={row.id}
              className={cn(
                "flex flex-wrap items-center gap-3 px-4 py-3",
                urgencyRail(urgency),
                urgency === "overdue" && "bg-danger-bg/20"
              )}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: `${row.categoryColor ?? "#94a3b8"}20`,
                  color: row.categoryColor ?? "#94a3b8",
                }}
              >
                <CategoryIcon icon={row.categoryIcon} className="h-4 w-4" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-medium">{row.description}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {formatDate(row.date)} · {row.accountName}
                </p>
              </div>

              {/* Same reason as the header above: on a phone the chip, the
                  amount and the button take their own line rather than
                  crushing the description to three characters. */}
              <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                <DueChip date={row.date} type="income" />

                <span className="text-foreground text-sm font-semibold tabular-nums">
                  {formatCurrency(row.amount)}
                </span>

                <ConfirmButton id={row.id} type="income" />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
