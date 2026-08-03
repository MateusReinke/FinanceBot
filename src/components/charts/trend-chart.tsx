"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { formatMonthShort, formatCompactCurrency } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";

type TrendPoint = { month: number; year: number; income: number; expense: number };

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const chartData = data.map((d) => ({
    label: formatMonthShort(d.month, d.year),
    Receitas: d.income,
    Despesas: d.expense,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4} barCategoryGap="24%">
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
          tickFormatter={(v) => formatCompactCurrency(Number(v))}
          width={56}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
        <Legend
          formatter={(value) => <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{value}</span>}
          iconType="plainline"
        />
        <Bar dataKey="Receitas" fill="var(--chart-income)" radius={[4, 4, 0, 0]} barSize={24} />
        <Bar dataKey="Despesas" fill="var(--chart-expense)" radius={[4, 4, 0, 0]} barSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}
