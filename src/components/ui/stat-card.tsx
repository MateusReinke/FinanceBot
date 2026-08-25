import Link from "next/link";
import { ArrowUp, ArrowDown, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  valueClassName,
  delta,
  hint,
  hintClassName,
  href,
  icon: Icon,
  iconClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  delta?: { percent: number; tone: "success" | "danger" };
  // Secondary line under the number — used for the previsto figure next to
  // the realizado one, so both are visible without a second card each.
  hint?: string;
  // For a hint that is itself the warning ("R$ 400 atrasado"), which should
  // not be muted grey like an ordinary footnote.
  hintClassName?: string;
  // Makes the whole card a link. Used where the number is a prompt to go do
  // something about it, rather than just a figure to read.
  href?: string;
  // Small badge above the label. Optional and neutral by default — a caller
  // ties its colour to what the figure means (iconClassName="bg-success-bg
  // text-success" for money coming in), the same way valueClassName already
  // works, rather than the card guessing a tone on its own.
  icon?: LucideIcon;
  iconClassName?: string;
}) {
  const body = (
    <>
      {Icon ? (
        <span
          className={cn(
            "bg-muted text-muted-foreground mb-2.5 flex h-7 w-7 items-center justify-center rounded-lg",
            iconClassName
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">{label}</p>
        {href ? (
          <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
        ) : null}
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <p
          className={cn(
            "text-foreground text-2xl font-semibold tracking-tight tabular-nums",
            valueClassName
          )}
        >
          {value}
        </p>
        {delta ? (
          <span
            className={cn(
              "mb-1 flex items-center gap-0.5 text-xs font-medium tabular-nums",
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
      {hint ? (
        <p className={cn("text-muted-foreground mt-1 text-xs", hintClassName)}>{hint}</p>
      ) : null}
    </>
  );

  const base = "surface p-4";

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          base,
          "group hover:border-border-strong hover:bg-muted/40 block transition-colors duration-150"
        )}
      >
        {body}
      </Link>
    );
  }

  return <div className={base}>{body}</div>;
}
