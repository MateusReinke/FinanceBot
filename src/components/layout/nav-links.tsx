"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "./nav-config";

export function NavLinks({
  onNavigate,
  badges,
}: {
  onNavigate?: () => void;
  // Overdue counts, keyed by the href they belong to. Passed in rather than
  // fetched here because this is a client component, and the layout already
  // has the data.
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-5">
      {NAV_GROUPS.map((group, i) => (
        <div key={group.label ?? `group-${i}`} className="flex flex-col gap-1">
          {group.label ? (
            <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
          ) : null}
          {group.items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            const badge = badges?.[href] ?? 0;
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-card"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", !active && "opacity-80")} />
                <span className="flex-1">{label}</span>
                {badge > 0 ? (
                  <span
                    // The count is announced rather than left as a bare
                    // number, which a screen reader would read as part of
                    // the link label ("A receber 3").
                    aria-label={`${badge} em atraso`}
                    className={cn(
                      "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
                      // text-background so the count stays legible against
                      // --danger, which is a deep red in the light theme and
                      // a light rose in the dark one.
                      active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-danger text-background"
                    )}
                  >
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
