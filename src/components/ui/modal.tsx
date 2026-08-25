"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  // Subtitle under the title — for the modal where naming the field isn't
  // enough on its own (why it's asking, what happens next).
  description?: string;
  // A small tinted badge next to the title, echoing the icon of whatever
  // the modal is about. Skipped entirely when omitted, so every existing
  // call site keeps its plain text-only header.
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Every call site starts with open=false, so this never renders during SSR
  // or the initial client render — no hydration-mismatch guard needed.
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cn(
          "surface surface-strong border-border-strong/60 relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl p-5",
          className
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <span className="bg-primary-soft text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <Icon className="h-[18px] w-[18px]" />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-foreground text-lg font-semibold tracking-tight">{title}</h2>
              {description ? (
                <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
              ) : null}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 cursor-pointer rounded-md p-1"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
