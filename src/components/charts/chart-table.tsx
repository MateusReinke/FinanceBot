"use client";

import { ChevronDown } from "lucide-react";

// Every chart in the app ships one of these.
//
// A colour and a bar height are not a reading channel everyone has: a chart
// whose only route to the numbers is hovering it is gated behind a pointer,
// a colour sense and a steady hand. The table is the same data with none of
// those requirements, and it is what makes the sub-3:1 fills and the
// red/green pair legal rather than merely pretty.
//
// Collapsed by default so it costs nothing when nobody needs it.
export function ChartTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: string[][];
}) {
  if (rows.length === 0) return null;

  return (
    <details className="group">
      <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-xs">
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        Ver os números
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-md border-collapse text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-border border-b">
              {columns.map((c, i) => (
                <th
                  key={c}
                  scope="col"
                  className={
                    i === 0
                      ? "text-muted-foreground py-1.5 pr-3 text-left font-medium"
                      : "text-muted-foreground py-1.5 pl-3 text-right font-medium"
                  }
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0]} className="border-border/60 border-b last:border-0">
                {row.map((cell, i) => (
                  <td
                    key={i}
                    className={
                      i === 0
                        ? "text-foreground py-1.5 pr-3 text-left"
                        : "text-muted-foreground py-1.5 pl-3 text-right tabular-nums"
                    }
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
