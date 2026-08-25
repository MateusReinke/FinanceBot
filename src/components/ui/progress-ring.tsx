import { cn } from "@/lib/utils";

// The one circular meter in the app, reserved for a single figure per
// screen that deserves more weight than a bar — currently the dashboard's
// month budget usage. Coloured at the call site via `tone`, never hard-coded
// to brand blue: what the ring is measuring decides whether it reads as "on
// track" or "over," the same way --success/--danger decide everywhere else
// in the app, and the glow follows that colour rather than being decoration
// on its own.
export function ProgressRing({
  percent,
  size = 128,
  strokeWidth = 10,
  tone = "primary",
  className,
  children,
}: {
  // 0-100+. Values past 100 still draw a closed ring — it's on the caller
  // to pass a tone (usually "danger") that makes "full and then some" read
  // correctly rather than looking like the goal was hit.
  percent: number;
  size?: number;
  strokeWidth?: number;
  tone?: "primary" | "success" | "danger";
  className?: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);
  const toneClass =
    tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-primary";

  return (
    <div
      className={cn(
        "shadow-glow relative inline-flex shrink-0 items-center justify-center rounded-full",
        toneClass,
        className
      )}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="none"
          className="text-border-strong"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      {children ? (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      ) : null}
    </div>
  );
}
