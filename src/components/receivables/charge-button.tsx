"use client";

import { useRef } from "react";
import { MessageCircle } from "lucide-react";
import { markCounterpartyAsCharged } from "@/app/actions/transactions";
import { buildChargeMessage, whatsappUrl, type ChargeItem } from "@/lib/charge";
import { cn } from "@/lib/utils";

// "Cobrar" — opens WhatsApp with the message already written, and records
// that the charge went out.
//
// The two halves are deliberately independent: the chat opens immediately in
// a new tab (a click handler that awaits a server round-trip first would be
// eaten by the popup blocker), and the "cobrado" bookkeeping is submitted
// alongside it. If the user closes WhatsApp without sending, the worst case
// is a row marked as charged when it wasn't — recoverable, and far better
// than the reverse, which is pestering someone twice.
export function ChargeButton({
  ids,
  name,
  phone,
  items,
  senderName,
  className,
}: {
  ids: string[];
  name: string | null;
  phone: string | null;
  items: ChargeItem[];
  senderName?: string;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const message = buildChargeMessage(name, items, senderName);
  const href = whatsappUrl(phone, message);

  return (
    <form ref={formRef} action={markCounterpartyAsCharged} className="contents">
      {ids.map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => formRef.current?.requestSubmit()}
        // text-background, not text-white: --success is a dark green in the
        // light theme and a light mint in the dark one, so a fixed white
        // would be unreadable in dark mode. --background moves the opposite
        // way in each theme, which keeps the contrast high in both.
        className={cn(
          "bg-success text-background inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-opacity hover:opacity-90",
          className
        )}
      >
        <MessageCircle className="h-3.5 w-3.5 shrink-0" />
        {phone ? "Cobrar no WhatsApp" : "Cobrar"}
      </a>
    </form>
  );
}
