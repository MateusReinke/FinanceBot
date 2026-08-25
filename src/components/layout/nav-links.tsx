"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "./nav-config";

export function NavLinks({
  onNavigate,
  badges,
  variant = "list",
}: {
  onNavigate?: () => void;
  // Overdue counts, keyed by the href they belong to. Passed in rather than
  // fetched here because this is a client component, and the layout already
  // has the data.
  badges?: Record<string, number>;
  // "list": icon + label, grouped under headings — the mobile drawer, where
  // there's room to spell everything out. "rail": icon-only column for the
  // desktop sidebar, with the label moved into a hover tooltip and the
  // group heading collapsed to a plain divider since there's no room to set
  // it in type at this width.
  variant?: "list" | "rail";
}) {
  const pathname = usePathname();

  if (variant === "rail") {
    return (
      <nav className="flex flex-1 flex-col items-center gap-1">
        {NAV_GROUPS.map((group, i) => (
          <div
            key={group.label ?? `group-${i}`}
            className={cn(
              "flex w-full flex-col items-center gap-1",
              i > 0 && "border-border mt-1 border-t pt-2"
            )}
          >
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              const badge = badges?.[href] ?? 0;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  aria-label={label}
                  className={cn(
                    "group relative flex h-11 w-11 items-center justify-center rounded-lg transition-colors duration-150",
                    active
                      ? "bg-primary-soft text-primary shadow-glow"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {badge > 0 ? (
                    <span
                      aria-label={`${badge} em atraso`}
                      className="bg-danger text-background absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums"
                    >
                      {badge}
                    </span>
                  ) : null}
                  {/* Pure CSS tooltip — the rail traded the label away for
                      width, so hover is the only place it still exists. */}
                  <span
                    role="tooltip"
                    className="bg-card text-foreground border-border shadow-raised pointer-events-none absolute left-full z-50 ml-3 rounded-md border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-1 flex-col gap-5">
      {NAV_GROUPS.map((group, i) => (
        <div key={group.label ?? `group-${i}`} className="flex flex-col gap-1">
          {group.label ? (
            <p className="text-muted-foreground/70 px-3 pb-1 text-[11px] font-semibold tracking-[0.08em] uppercase">
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
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                  // A tint plus a colour change on the label, rather than a
                  // filled pill: the sidebar is a map, not the point of the
                  // screen, and a saturated block in it drags the eye off
                  // the content every time the page loads.
                  active
                    ? "bg-primary-soft text-primary"
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
                    // text-background so the count stays legible against
                    // --danger, which is a deep red in the light theme and a
                    // light rose in the dark one.
                    className="bg-danger text-background flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums"
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
