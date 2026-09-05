import { Lightbulb } from "lucide-react";
import type { Insight } from "@/lib/insights";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const DOT_TONE: Record<Insight["tone"], string> = {
  success: "bg-success",
  info: "bg-primary",
  warning: "bg-warning",
  danger: "bg-danger",
};

// Reads the numbers already on this page back as sentences, for whoever
// would rather read "você guardou 18%" than do the division themselves.
// Nothing here is computed twice — see lib/insights.ts.
export function Insights({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Lightbulb className="text-muted-foreground h-4 w-4" /> Insights do mês
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2.5">
          {insights.map((insight) => (
            <li key={insight.id} className="flex items-start gap-2.5 text-sm">
              <span
                className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", DOT_TONE[insight.tone])}
              />
              <span className="text-foreground">{insight.text}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
