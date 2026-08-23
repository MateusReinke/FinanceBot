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
      <aside className="surface-shell hidden w-64 shrink-0 flex-col border-r border-border p-4 lg:flex">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 px-2 py-3 text-lg font-semibold tracking-tight text-foreground"
        >
          <span className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground shadow-brand">
            <Wallet2 className="h-5 w-5" />
          </span>
          FinanceBot
        </Link>
        <div className="mt-4 flex flex-1 flex-col">
          <NavLinks badges={badges} />
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="surface-shell absolute inset-y-0 left-0 flex w-72 flex-col border-r border-border p-4 shadow-overlay">
            <div className="flex items-center justify-between px-2 py-3">
              <span className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-foreground">
                <span className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground shadow-brand">
                  <Wallet2 className="h-5 w-5" />
                </span>
                FinanceBot
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted cursor-pointer"
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
        <header className="surface-shell sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border px-4 sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted cursor-pointer lg:hidden"
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
