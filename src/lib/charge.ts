// Turns "João owes me R$ 50, due last Friday" into a WhatsApp message the
// user only has to press send on.
//
// A wa.me link rather than the outbound webhook queue: charging someone is a
// personal message that should come from the user's own number and be edited
// before it goes out. Routing it through the automation would send it as the
// bot, to a person who never signed up for anything — the fastest way to
// make a finance app feel like a debt collector. The queue stays for what it
// is good at (group events the user opted into).
//
// Deliberately dependency-free and client-safe: the link is built in the
// browser at click time, so there is no server round-trip between "I want to
// charge João" and the chat opening.

import { normalizePhone } from "@/lib/phone";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const shortDate = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

export type ChargeItem = { description: string; amount: number; date: Date | string };

// Written to be sent as-is by someone who is mildly embarrassed to be
// asking: it opens friendly, states the facts once, and does not moralize
// about lateness. The user can edit it in WhatsApp before sending.
export function buildChargeMessage(name: string | null, items: ChargeItem[], senderName?: string) {
  const greeting = name ? `Oi, ${name.split(" ")[0]}!` : "Oi!";
  const total = items.reduce((sum, i) => sum + i.amount, 0);

  if (items.length === 1) {
    const item = items[0];
    return [
      greeting,
      "",
      `Passando pra lembrar do valor de ${currency.format(item.amount)} — ${item.description} (${shortDate.format(new Date(item.date))}).`,
      "",
      "Quando puder, me avisa? Obrigado!",
      senderName ? `\n— ${senderName}` : "",
    ]
      .join("\n")
      .trim();
  }

  const lines = items.map(
    (i) => `• ${currency.format(i.amount)} — ${i.description} (${shortDate.format(new Date(i.date))})`
  );

  return [
    greeting,
    "",
    "Passando pra lembrar destes valores:",
    ...lines,
    "",
    `Total: ${currency.format(total)}`,
    "",
    "Quando puder, me avisa? Obrigado!",
    senderName ? `\n— ${senderName}` : "",
  ]
    .join("\n")
    .trim();
}

// wa.me needs the number with no punctuation and no leading +. Without a
// number it still works: WhatsApp opens with the text ready and asks the
// user who to send it to.
export function whatsappUrl(phone: string | null, message: string) {
  const digits = phone ? normalizePhone(phone) : "";
  const text = encodeURIComponent(message);
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}
