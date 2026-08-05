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
  children,
}: {
  name: string;
  email: string;
  role: string;
  aiEnabled: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card p-4 lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2 px-2 py-3 text-lg font-semibold text-foreground">
          <Wallet2 className="h-6 w-6 text-primary" />
          FinanceBot
        </Link>
        <div className="mt-4 flex flex-1 flex-col">
          <NavLinks />
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-card p-4 shadow-xl">
            <div className="flex items-center justify-between px-2 py-3">
              <span className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Wallet2 className="h-6 w-6 text-primary" />
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
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
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
