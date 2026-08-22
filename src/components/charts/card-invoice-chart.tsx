"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { InvoiceMonthPoint } from "@/lib/queries/card-invoices";
import { formatCurrency, formatCompactCurrency, formatMonthShort, formatMonthYear } from "@/lib/utils";
import { ChartTable } from "./chart-table";
import { FutureBand } from "./future-band";

// What the cards cost per month — six months of invoices already paid, then
// six months of what the planner says is coming.
//
// Stacked by card rather than as one total, because the question this answers
// on the Contas page is "qual cartão está pesando em novembro", and a single
// column cannot say. Each card keeps the colour it wears everywhere else in
// the app, so the legend, the tiles below and the columns all agree — and
// identity never rests on hue alone: the legend names every card, the tooltip
// breaks the column down by name, and the table repeats all of it.
//
// Six cards is the cap. Past that the tail folds into "Outros" instead of
// inventing more colours nobody can tell apart.
// Handed to Recharts and to the forecast band alike, so the two agree on
// where the plot actually starts and ends.
const AXIS_WIDTH = 72;
const MARGIN_RIGHT = 8;
const LEGEND_HEIGHT = 30;

const MAX_SERIES = 6;
const OTHER_COLOR = "#94a3b8";

type Card = { id: string; name: string; color: string };

function axisLabel(month: number, year: number) {
  const short = formatMonthShort(month, year);
  return month === 1 ? `${short}/${String(year).slice(2)}` : short;
}

export function CardInvoiceChart({
  series,
  cards,
  onSelectMonth,
  selectedMonth,
}: {
  series: InvoiceMonthPoint[];
  cards: Card[];
  // Clicking a column moves the breakdown below to that month — the chart is
  // the filter, rather than a picture sitting next to one.
  onSelectMonth?: (key: string) => void;
  selectedMonth?: string;
}) {
  // Which cards actually appear in the window, biggest first, so the stack
  // order is stable and the tail is genuinely the tail.
  const shown = useMemo(() => {
    const totals = new Map<string, number>();
    for (const point of series) {
      for (const [cardId, value] of Object.entries(point.byCard)) {
        totals.set(cardId, (totals.get(cardId) ?? 0) + value);
      }
    }
    const ranked = cards
      .filter((c) => (totals.get(c.id) ?? 0) > 0)
      .sort((a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0));
    return {
      head: ranked.slice(0, MAX_SERIES),
      tail: ranked.slice(MAX_SERIES),
    };
  }, [series, cards]);

  const rows = useMemo(() => {
    return series.map((point) => {
      const row: Record<string, string | number> = {
        key: point.key,
        label: axisLabel(point.month, point.year),
        monthLabel: formatMonthYear(point.month, point.year),
        offset: point.offset,
        total: point.total,
      };
      for (const card of shown.head) row[card.name] = point.byCard[card.id] ?? 0;
      if (shown.tail.length > 0) {
        row.Outros = shown.tail.reduce((sum, c) => sum + (point.byCard[c.id] ?? 0), 0);
      }
      return row;
    });
  }, [series, shown]);

  const stacks = [
    ...shown.head.map((c) => ({ name: c.name, color: c.color })),
    ...(shown.tail.length > 0 ? [{ name: "Outros", color: OTHER_COLOR }] : []),
  ];

  const lastKey = stacks[stacks.length - 1]?.name;

  if (stacks.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="relative">
        <FutureBand
          firstFutureIndex={rows.findIndex((r) => Number(r.offset) > 0)}
          count={rows.length}
          axisWidth={AXIS_WIDTH}
          marginRight={MARGIN_RIGHT}
          bottomInset={stacks.length > 1 ? LEGEND_HEIGHT : 0}
        />
        <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={rows}
          margin={{ top: 24, right: MARGIN_RIGHT, left: 0, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />

          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            interval={0}
            tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
            tickFormatter={(v) => formatCompactCurrency(Number(v))}
            width={AXIS_WIDTH}
          />

          <Tooltip
            content={<InvoiceTooltip stacks={stacks} />}
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          />
          {stacks.length > 1 ? (
            <Legend
              formatter={(value) => (
                <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{value}</span>
              )}
            />
          ) : null}

          {stacks.map((s) => (
            <Bar
              key={s.name}
              dataKey={s.name}
              stackId="faturas"
              fill={s.color}
              // Painted in the chart's own surface colour: the 2px gap that
              // separates touching segments, not an outline around them.
              stroke="var(--chart-surface)"
              strokeWidth={2}
              maxBarSize={22}
              radius={s.name === lastKey ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              className={onSelectMonth ? "cursor-pointer" : undefined}
            >
              {/* Picking a month in the breakdown below dims the rest, so the
                  column and the list are visibly the same month. Emphasis by
                  opacity, never by repainting: a card keeps its colour. */}
              {rows.map((r) => (
                <Cell
                  key={String(r.key)}
                  opacity={selectedMonth && selectedMonth !== r.key ? 0.35 : 1}
                  // Bound per cell rather than on the chart: the chart-level
                  // click event reports an index that does not track the
                  // column actually under the pointer, while the cell already
                  // knows which month it is.
                  onClick={onSelectMonth ? () => onSelectMonth(String(r.key)) : undefined}
                />
              ))}
            </Bar>
          ))}
        </BarChart>
        </ResponsiveContainer>
      </div>

      <ChartTable
        caption="Faturas por mês e por cartão"
        columns={["Mês", ...stacks.map((s) => s.name), "Total"]}
        rows={rows.map((r) => [
          String(r.monthLabel),
          ...stacks.map((s) => formatCurrency(Number(r[s.name] ?? 0))),
          formatCurrency(Number(r.total)),
        ])}
      />
    </div>
  );
}

function InvoiceTooltip({
  active,
  payload,
  stacks,
}: {
  active?: boolean;
  payload?: { payload?: Record<string, string | number> }[];
  stacks?: { name: string; color: string }[];
}) {
  if (!active || !payload?.length || !stacks) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const lines = stacks
    .map((s) => ({ ...s, value: Number(row[s.name] ?? 0) }))
    .filter((l) => l.value > 0);

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-overlay">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        {row.monthLabel}
        {Number(row.offset) > 0 ? " · previsto" : null}
      </p>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma fatura neste mês.</p>
      ) : (
        <div className="space-y-1">
          {lines.map((l) => (
            <div key={l.name} className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
              <span className="font-semibold tabular-nums text-foreground">
                {formatCurrency(l.value)}
              </span>
              <span className="text-muted-foreground">{l.name}</span>
            </div>
          ))}
          {lines.length > 1 ? (
            <p className="border-t border-border pt-1.5 text-xs text-muted-foreground">
              Total {formatCurrency(Number(row.total))}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
