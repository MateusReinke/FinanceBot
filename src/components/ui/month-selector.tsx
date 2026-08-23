import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonthYear } from "@/lib/utils";

export function MonthSelector({
  month,
  year,
  basePath,
}: {
  month: number;
  year: number;
  basePath: string;
}) {
  const prev = month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
  const next = month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year };

  // basePath may already carry query params (the transactions list keeps its
  // active filters while you page through months), so the separator has to
  // be chosen rather than assumed.
  const sep = basePath.includes("?") ? "&" : "?";
  const href = (m: number, y: number) => `${basePath}${sep}month=${m}&year=${y}`;

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
      <Link
        href={href(prev.month, prev.year)}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>
      <span className="min-w-36 text-center text-sm font-medium text-foreground">
        {formatMonthYear(month, year)}
      </span>
      <Link
        href={href(next.month, next.year)}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
