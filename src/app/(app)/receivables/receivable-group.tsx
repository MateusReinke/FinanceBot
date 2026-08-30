import { User, HelpCircle } from "lucide-react";
import type { ReceivableGroup } from "@/lib/queries/receivables";
import { CategoryIcon } from "@/components/ui/category-icon";
import { DueChip, urgencyRail } from "@/components/ui/due-chip";
import { ConfirmButton } from "@/components/transactions/confirm-buttons";
import { ChargeButton } from "@/components/receivables/charge-button";
import { PartialReceiptButton } from "@/components/receivables/partial-receipt-button";
import { urgencyOf } from "@/lib/due-dates";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

const chargedFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

// What fixes the money column: the buttons get a fixed-width track, so the
// figure in front of them always ends at the same x whatever is inside it.
//
// Without it every line ended its money wherever its own controls happened
// to end — a group with no "Cobrar" button parked its total flush against
// the card edge while the rows below stopped ~90px short of it, and a group
// with the long "Cobrar no WhatsApp" pushed its total ~85px the other way.
// A total never lined up with the column of figures it was summing.
//
// Everything is right-aligned rather than spread, so the amounts need no
// width of their own to line up — only the track after them does.
const MONEY_COL = "text-right";
const ACTION_COL = "flex shrink-0 items-center justify-end gap-2 max-sm:basis-full sm:w-44";
// The cluster keeps its own full-width line until md, where the description
// finally has room to sit beside it. Below sm the buttons take a line of
// their own (basis-full above) instead of squeezing onto the figures' line —
// which also means the money is flush right at every width, header included.
const RIGHT_CLUSTER =
  "flex w-full flex-wrap items-center justify-end gap-x-3 gap-y-2 md:w-auto md:flex-nowrap";

// One person's card: what they owe in total, every entry behind that total,
// and the three things the user actually wants to do — cobrar, mark it
// received because they finally paid, or record the part of it that arrived.
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

        {/* w-full below md so this drops to its own line instead of squeezing
            the name next to it down to an ellipsis — at 390px the amount plus
            the charge button leave nothing for the person's name, which is
            the one thing this header exists to show. */}
        <div className={RIGHT_CLUSTER}>
          <div className={MONEY_COL}>
            <p
              className={cn(
                "text-lg leading-tight font-semibold tabular-nums",
                group.overdueCount > 0 ? "text-danger" : "text-success"
              )}
            >
              {formatCurrency(group.total)}
            </p>
            {group.receivedTotal > 0 ? (
              <p className="text-muted-foreground text-[11px] tabular-nums">
                de {formatCurrency(group.originalTotal)}
              </p>
            ) : null}
          </div>
          {named ? (
            <div className={ACTION_COL}>
              <ChargeButton
                ids={ids}
                name={group.counterparty}
                phone={group.phone}
                items={items}
                senderName={senderName}
              />
            </div>
          ) : (
            // Holds the actions track open so the total beside it still lines
            // up with the amounts below. Hidden below sm, where nothing is
            // being lined up and an empty box would only push the total in
            // off the right edge.
            <div className="hidden sm:block sm:w-44" aria-hidden />
          )}
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
                  {row.received > 0 ? (
                    <span className="text-success">
                      {" · "}
                      {formatCurrency(row.received)} de {formatCurrency(row.original)} recebido
                    </span>
                  ) : null}
                </p>
              </div>

              {/* Same reason as the header above: below md the chip, the
                  amount and the buttons take their own line rather than
                  crushing the description to three characters. */}
              <div className={RIGHT_CLUSTER}>
                <DueChip date={row.date} type="income" />

                <div className={MONEY_COL}>
                  <p className="text-foreground text-sm leading-tight font-semibold tabular-nums">
                    {formatCurrency(row.amount)}
                  </p>
                  {row.received > 0 ? (
                    <p className="text-muted-foreground text-[11px]">ainda falta</p>
                  ) : null}
                </div>

                <div className={ACTION_COL}>
                  <PartialReceiptButton
                    id={row.id}
                    description={row.description}
                    remaining={row.amount}
                    received={row.received}
                    partials={row.partials}
                  />
                  <ConfirmButton id={row.id} type="income" />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {group.receivedTotal > 0 ? (
        <p className="border-border text-muted-foreground border-t px-4 py-2 text-xs">
          <span className="text-success font-semibold tabular-nums">
            {formatCurrency(group.receivedTotal)}
          </span>{" "}
          já recebido dos {formatCurrency(group.originalTotal)} originais ·{" "}
          <span className="text-foreground font-semibold tabular-nums">
            {formatCurrency(group.total)}
          </span>{" "}
          ainda faltam
        </p>
      ) : null}
    </div>
  );
}
