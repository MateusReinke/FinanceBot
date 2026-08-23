"use client";

import { formatCurrency } from "@/lib/utils";

type TooltipEntry = {
  name?: string;
  value?: number | string;
  color?: string;
};

export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-overlay">
      {label ? <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p> : null}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span
              className="h-0.5 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="font-semibold text-foreground">
              {formatCurrency(Number(entry.value ?? 0))}
            </span>
            {entry.name ? <span className="text-muted-foreground">{entry.name}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
