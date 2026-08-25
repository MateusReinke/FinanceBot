import { AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { dueLabel, urgencyOf, URGENCY_TONE, isPressing, type Urgency } from "@/lib/due-dates";

// "Vence hoje", "Venceu há 3 dias", "Recebe em 2 dias" — the countdown that
// turns a due date into something you act on. StatusBadge says *what* a row
// is (a pagar / atrasado); this says *when*, which is the part that decides
// whether the user does something about it today.
export function DueChip({
  date,
  type,
  className,
  showIcon = true,
}: {
  date: Date | string;
  type: string;
  className?: string;
  showIcon?: boolean;
}) {
  const urgency = urgencyOf(date);
  const pressing = isPressing(urgency);
  const Icon = urgency === "overdue" ? AlertTriangle : Clock;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        URGENCY_TONE[urgency],
        className
      )}
    >
      {showIcon && pressing ? <Icon className="h-3 w-3 shrink-0" /> : null}
      {dueLabel(date, type)}
    </span>
  );
}

// The coloured rail down the left of a row. Carries the same information as
// the chip for people scanning a long list, without repeating the words on
// every line.
export function urgencyRail(urgency: Urgency) {
  return cn(
    "border-l-2",
    urgency === "overdue" && "border-l-danger",
    urgency === "today" && "border-l-warning",
    urgency === "soon" && "border-l-warning/50",
    urgency === "upcoming" && "border-l-transparent"
  );
}
