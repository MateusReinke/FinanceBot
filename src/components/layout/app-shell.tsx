"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Wallet2 } from "lucide-react";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";
import { AiAssistant } from "./ai-assistant";

export function AppShell({
  name,
  email,
  role,
  aiEnabled,
  badges,
  children,
}: {
  name: string;
  email: string;
  role: string;
  aiEnabled: boolean;
  // Overdue counts per nav href, so "3 contas atrasadas" is visible from
  // every screen rather than only on the dashboard.
  badges?: Record<string, number>;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full">
      {/* An icon rail rather than a labelled column: every destination fits
          in one screen of icons, so the label was spending 190px of width
          to repeat what the page's own title already says the moment you
          land on it. Labels move to a hover tooltip instead of disappearing
          — see NavLinks' "rail" variant. */}
      <aside className="surface-shell border-border hidden w-[76px] shrink-0 flex-col items-center border-r py-4 lg:flex">
        <Link
          href="/dashboard"
          className="bg-brand text-primary-foreground mb-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          aria-label="FinanceBot — Painel"
        >
          <Wallet2 className="h-5 w-5" />
        </Link>
        <div className="flex flex-1 flex-col items-center">
          <NavLinks badges={badges} variant="rail" />
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="surface-shell border-border shadow-overlay absolute inset-y-0 left-0 flex w-72 flex-col border-r p-4">
            <div className="flex items-center justify-between px-2 py-3">
              <span className="text-foreground flex items-center gap-2.5 text-lg font-semibold tracking-tight">
                <span className="bg-brand text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                  <Wallet2 className="h-[18px] w-[18px]" />
                </span>
                FinanceBot
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-muted-foreground hover:bg-muted cursor-pointer rounded-md p-1.5"
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 flex flex-1 flex-col">
              <NavLinks onNavigate={() => setMobileOpen(false)} badges={badges} />
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="surface-shell border-border sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b px-4 sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-muted-foreground hover:bg-muted cursor-pointer rounded-md p-2 lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <AiAssistant enabled={aiEnabled} />
          <UserMenu name={name} email={email} role={role} />
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
