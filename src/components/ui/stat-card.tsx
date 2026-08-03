import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  valueClassName,
  delta,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  delta?: { percent: number; tone: "success" | "danger" };
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <p className={cn("text-2xl font-semibold text-foreground", valueClassName)}>{value}</p>
        {delta ? (
          <span
            className={cn(
              "mb-1 flex items-center gap-0.5 text-xs font-medium",
              delta.tone === "success" ? "text-success" : "text-danger"
            )}
          >
            {delta.percent >= 0 ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            {Math.abs(delta.percent).toFixed(0)}%
          </span>
        ) : null}
      </div>
    </div>
  );
}
