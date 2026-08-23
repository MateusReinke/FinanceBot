"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CashflowPoint } from "@/lib/queries/cashflow";
import { formatCurrency, formatCompactCurrency, formatMonthShort, formatMonthYear } from "@/lib/utils";
import { ChartTable } from "./chart-table";
import { FutureBand } from "./future-band";

// Thirteen months of money out, six behind and six ahead of the month being
// viewed.
//
// The columns are the subject and carry the split that matters: what already
// left the account (realizado) stacked under what is only scheduled
// (previsto), one hue in two steps so the eye reads certainty as depth rather
// than as two unrelated things. Income is context, so it rides above as a
// single line — same axis, same unit, no second scale.
//
// The future is marked twice over: the columns switch to the light step of
// the ramp, and the ground behind them is tinted. A reader who takes in
// nothing but the shape still sees where the record stops and the plan
// starts.

type Row = {
  key: string;
  label: string;
  Realizado: number;
  Previsto: number;
  Receitas: number;
  total: number;
  offset: number;
  monthLabel: string;
  // Empty on every row but the peak — see the LabelList below.
  peakLabel: string;
};

// A 13-month window crosses at least one new year, so January carries its
// year and the rest stay short. Without it the axis silently repeats "Jan".
// Handed to Recharts and to the forecast band alike, so the two agree on
// where the plot actually starts and ends.
const AXIS_WIDTH = 72;
const MARGIN_RIGHT = 8;
const LEGEND_HEIGHT = 30;

function axisLabel(month: number, year: number) {
  const short = formatMonthShort(month, year);
  return month === 1 ? `${short}/${String(year).slice(2)}` : short;
}

export function CashflowChart({ data }: { data: CashflowPoint[] }) {
  const rows = useMemo<Row[]>(() => {
    const built = data.map((d) => ({
      key: d.key,
      label: axisLabel(d.month, d.year),
      Realizado: d.expenseRealized,
      Previsto: d.expenseScheduled,
      // Not plotted — salary dwarfs a month's spending, and putting both on
      // one axis left the subject of the chart in the bottom fifth of the
      // plot. It stays in the tooltip and the table, where it is context.
      Receitas: d.incomeRealized + d.incomeScheduled,
      total: d.expenseRealized + d.expenseScheduled,
      offset: d.offset,
      monthLabel: formatMonthYear(d.month, d.year),
      peakLabel: "",
    }));

    // The one direct label worth spending: the heaviest month still ahead is
    // the thing this chart exists to surface.
    const peak = built
      .filter((r) => r.offset > 0 && r.total > 0)
      .reduce<Row | null>((worst, r) => (!worst || r.total > worst.total ? r : worst), null);
    if (peak) peak.peakLabel = formatCompactCurrency(peak.total);

    return built;
  }, [data]);


  return (
    <div className="space-y-3">
      <div className="relative">
        <FutureBand
          firstFutureIndex={rows.findIndex((r) => r.offset > 0)}
          count={rows.length}
          axisWidth={AXIS_WIDTH}
          marginRight={MARGIN_RIGHT}
          bottomInset={LEGEND_HEIGHT}
        />
        <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={rows} margin={{ top: 24, right: MARGIN_RIGHT, left: 0, bottom: 0 }}>
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

          <Tooltip content={<CashflowTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
          {/* Written out rather than derived, so it reads bottom-up in the
              order the stack is built and never flips with the series. */}
          <Legend content={<CashflowLegend />} />

          {/* The 2px stroke is painted in the chart's own surface colour: it
              is the gap that separates the two stacked fills, not an outline
              drawn around them. */}
          <Bar
            dataKey="Realizado"
            stackId="gastos"
            fill="var(--chart-expense)"
            stroke="var(--chart-surface)"
            strokeWidth={2}
            maxBarSize={22}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="Previsto"
            stackId="gastos"
            fill="var(--chart-expense-soft)"
            stroke="var(--chart-surface)"
            strokeWidth={2}
            maxBarSize={22}
            radius={[4, 4, 0, 0]}
          >
            {/* Exactly one direct label — the heaviest month still ahead,
                which is the thing this chart exists to surface. It rides a
                data key that is empty on every other row, because a number
                over all thirteen columns is noise and goes unread; the rest
                of the values live in the tooltip and the table below. */}
            <LabelList
              dataKey="peakLabel"
              position="top"
              offset={8}
              fill="var(--muted-foreground)"
              fontSize={11}
              fontWeight={600}
            />
          </Bar>
        </ComposedChart>
        </ResponsiveContainer>
      </div>

      <ChartTable
        caption="Gastos e receitas por mês"
        columns={["Mês", "Realizado", "Previsto", "Total de gastos", "Receitas"]}
        rows={rows.map((r) => [
          r.monthLabel,
          formatCurrency(r.Realizado),
          formatCurrency(r.Previsto),
          formatCurrency(r.total),
          formatCurrency(r.Receitas),
        ])}
      />
    </div>
  );
}

function CashflowLegend() {
  const keys = [
    { label: "Realizado", color: "var(--chart-expense)" },
    { label: "Previsto", color: "var(--chart-expense-soft)" },
  ];
  return (
    <ul className="flex items-center justify-center gap-4 pt-1">
      {keys.map((k) => (
        <li key={k.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: k.color }} />
          {k.label}
        </li>
      ))}
    </ul>
  );
}

type TooltipEntry = { name?: string; value?: number; payload?: Row };

function CashflowTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const lines: { label: string; value: number; color: string }[] = [];
  if (row.Realizado > 0) lines.push({ label: "Realizado", value: row.Realizado, color: "var(--chart-expense)" });
  if (row.Previsto > 0) lines.push({ label: "Previsto", value: row.Previsto, color: "var(--chart-expense-soft)" });

  const balance = row.Receitas - row.total;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-overlay">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        {row.monthLabel}
        {row.offset > 0 ? " · previsto" : null}
      </p>
      <div className="space-y-1">
        {lines.map((l) => (
          <div key={l.label} className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
            <span className="font-semibold tabular-nums text-foreground">{formatCurrency(l.value)}</span>
            <span className="text-muted-foreground">{l.label}</span>
          </div>
        ))}
        {lines.length === 0 ? <p className="text-sm text-muted-foreground">Nada neste mês.</p> : null}
      </div>
      {row.total > 0 || row.Receitas > 0 ? (
        <div className="mt-1.5 space-y-0.5 border-t border-border pt-1.5 text-xs text-muted-foreground">
          <p>Total de gastos {formatCurrency(row.total)}</p>
          <p>
            Receitas {formatCurrency(row.Receitas)} · sobra{" "}
            <span className={balance >= 0 ? "text-success" : "text-danger"}>
              {formatCurrency(balance)}
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
