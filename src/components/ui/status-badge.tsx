import { cn } from "@/lib/utils";
import { statusLabel, STATUS_TONE, type TransactionStatus } from "@/lib/transaction-status";

// The single visual for realizado/previsto/atrasado, so a row reads the
// same in the transactions list, on a financing page and on the dashboard.
export function StatusBadge({
  status,
  type,
  className,
}: {
  status: TransactionStatus;
  type: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_TONE[status],
        className
      )}
    >
      {statusLabel(status, type)}
    </span>
  );
}
