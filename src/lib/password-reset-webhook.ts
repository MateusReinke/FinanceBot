import "server-only";
import { createHmac } from "node:crypto";

// Deliberately its own webhook, separate from N8N_WEBHOOK_URL (see
// src/lib/outbound.ts) — that one feeds the n8n flow that posts into shared
// WhatsApp event groups, and a password-reset link must never be able to
// end up routed through the same flow. No email provider is configured for
// this app, so this is the actual delivery path: n8n receives the link and
// is responsible for getting it to the user privately (WhatsApp DM, etc).
export function isPasswordResetWebhookConfigured() {
  return Boolean(process.env.N8N_PASSWORD_RESET_WEBHOOK_URL);
}

function sign(body: string) {
  const secret = process.env.N8N_PASSWORD_RESET_WEBHOOK_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(body).digest("hex");
}

async function send(input: {
  name: string;
  email: string;
  phoneNumber: string | null;
  resetLink: string;
  expiresAt: Date;
}) {
  const url = process.env.N8N_PASSWORD_RESET_WEBHOOK_URL!;
  const body = JSON.stringify({
    name: input.name,
    email: input.email,
    phoneNumber: input.phoneNumber,
    resetLink: input.resetLink,
    expiresAt: input.expiresAt.toISOString(),
    sentAt: new Date().toISOString(),
  });
  const signature = sign(body);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(signature ? { "X-FinanceBot-Signature": signature } : {}),
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// Fire-and-forget, like dispatchOutboundEventsInBackground: requestPasswordReset
// always returns the same generic message regardless of delivery (to avoid
// leaking whether the e-mail exists), so there is nothing useful to await —
// a slow or down n8n instance must not make the form hang.
export function notifyPasswordResetInBackground(input: {
  name: string;
  email: string;
  phoneNumber: string | null;
  resetLink: string;
  expiresAt: Date;
}) {
  if (!isPasswordResetWebhookConfigured()) return;
  send(input).catch((error) => {
    console.error("Falha ao enviar webhook de reset de senha", error);
  });
}
