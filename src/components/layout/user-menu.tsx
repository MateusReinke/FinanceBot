"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { LogOut, User, ShieldCheck, Compass, Settings } from "lucide-react";
import { logout } from "@/app/actions/auth";

export function UserMenu({ name, email, role }: { name: string; email: string; role: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="bg-primary text-primary-foreground flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-sm font-semibold"
        aria-label="Menu do usuário"
      >
        {initials || <User className="h-4 w-4" />}
      </button>
      {open ? (
        <div className="border-border bg-card shadow-overlay absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border">
          <div className="border-border border-b px-3 py-2.5">
            <p className="text-foreground truncate text-sm font-medium">{name}</p>
            <p className="text-muted-foreground truncate text-xs">{email}</p>
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="text-foreground hover:bg-muted flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm"
          >
            <Settings className="h-4 w-4" />
            Configurações
          </Link>
          {/* The way back into the first-run guide. Somebody who skipped it
              on day one, or who wants to re-read what "previsto" means, has
              no other route to it — the redirect only fires once. */}
          <Link
            href="/bem-vindo"
            onClick={() => setOpen(false)}
            className="text-foreground hover:bg-muted flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm"
          >
            <Compass className="h-4 w-4" />
            Primeiros passos
          </Link>
          {role === "admin" ? (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="text-foreground hover:bg-muted flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm"
            >
              <ShieldCheck className="h-4 w-4" />
              Painel admin
            </Link>
          ) : null}
          <form action={logout} className="border-border border-t">
            <button
              type="submit"
              className="text-danger hover:bg-muted flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
