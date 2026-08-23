import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "danger" | "warning" | "success" | "info";

const toneClasses: Record<Tone, string> = {
  danger: "border-danger/25 bg-danger-bg text-danger",
  warning: "border-warning/25 bg-warning-bg text-warning",
  success: "border-success/25 bg-success-bg text-success",
  info: "border-border bg-muted text-muted-foreground",
};

const toneIcon: Record<Tone, typeof AlertTriangle> = {
  danger: AlertTriangle,
  warning: CalendarClock,
  success: CheckCircle2,
  info: Info,
};

// One banner treatment for everything the app needs to say out loud —
// overdue bills, invoices closing, nothing-to-do confirmations. Before this
// each screen hand-rolled its own coloured strip and they had drifted apart
// in padding, icon and whether the text was a link.
export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
  pulse = false,
}: {
  tone?: Tone;
  title: string;
  children?: React.ReactNode;
  action?: { href: string; label: string };
  className?: string;
  // Reserved for genuinely late money. See .pulse-soft in globals.css for
  // why it is deliberately subtle.
  pulse?: boolean;
}) {
  const Icon = toneIcon[tone];

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-3",
        toneClasses[tone],
        className
      )}
      role={tone === "danger" ? "alert" : undefined}
    >
      <Icon className={cn("h-5 w-5 shrink-0", pulse && "pulse-soft")} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {children ? <div className="text-sm opacity-90">{children}</div> : null}
      </div>
      {action ? (
        <Link
          href={action.href}
          className="shrink-0 rounded-lg border border-current/25 px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-75"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
