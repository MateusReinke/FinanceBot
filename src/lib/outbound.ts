import "server-only";
import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";

// Outbound side of the automation bridge: the app publishes what happened,
// the automation (n8n) decides what to do about it.
//
// This is deliberately NOT a WhatsApp client. The official WhatsApp Cloud
// API cannot create groups or add members at all — only an unofficial
// gateway can — so putting that call in here would hard-wire the app to
// one gateway, with its own credentials, session and ban risk. Publishing
// a signed event instead keeps that choice (and that risk) in the n8n
// flow, where it can be swapped without touching the app.
//
// Rows in OutboundEvent are the queue, moving pending -> sending ->
// delivered (or back to pending, then failed). Enqueue happens alongside
// the change it describes, so an event can never claim something that was
// rolled back; delivery happens afterwards and is allowed to fail and be
// retried.

export type OutboundEventType =
  | "event.created"
  | "event.participant_joined"
  | "event.participant_left"
  | "event.expense_created"
  | "event.deleted";

export function isOutboundConfigured() {
  return Boolean(process.env.N8N_WEBHOOK_URL);
}

// Signed the same way the app verifies Pluggy's webhooks, so the receiving
// n8n flow can prove a call really came from this deployment. Without a
// secret configured the header is simply absent — fine for an n8n instance
// on a private network, and the URL itself stays the only secret.
function sign(body: string) {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(body).digest("hex");
}

const MAX_ATTEMPTS = 5;
const BATCH = 20;
// How long a claimed row stays off-limits. If the process dies mid-send,
// the row becomes due again after this and is retried rather than stuck.
const CLAIM_TTL_MS = 120_000;
// 1min, 5min, 25min, ~2h — enough to ride out a restart of the n8n side.
const BACKOFF_MS = [60_000, 300_000, 1_500_000, 7_500_000, 7_500_000];

export async function enqueueOutboundEvent(input: {
  type: OutboundEventType;
  userId?: string | null;
  eventId?: string | null;
  payload: Record<string, unknown>;
}) {
  // Queued even when nothing is configured yet: someone who connects n8n
  // tomorrow should not find today's history missing. They expire only by
  // attempt count, never silently.
  await prisma.outboundEvent.create({
    data: {
      type: input.type,
      userId: input.userId ?? null,
      eventId: input.eventId ?? null,
      payload: input.payload as object,
    },
  });
}

// Takes exclusive ownership of a row, or returns false because someone
// else already has it.
//
// Two callers race for this queue by design: the fire-and-forget dispatch
// right after an action, and the sweep in verifySession on the next
// request. Without a claim they both read the same pending row and both
// POST it — which showed up in testing as one expense notifying the group
// twice, 5ms apart. The updateMany's `status: "pending"` filter is the
// lock: exactly one caller can flip it.
async function claim(id: string) {
  const claimed = await prisma.outboundEvent.updateMany({
    where: { id, status: "pending" },
    data: { status: "sending", nextAttemptAt: new Date(Date.now() + CLAIM_TTL_MS) },
  });
  return claimed.count === 1;
}

async function deliverOne(row: {
  id: string;
  type: string;
  eventId: string | null;
  payload: unknown;
  attempts: number;
}) {
  const url = process.env.N8N_WEBHOOK_URL!;
  const body = JSON.stringify({
    id: row.id,
    type: row.type,
    eventId: row.eventId,
    data: row.payload,
    sentAt: new Date().toISOString(),
  });
  const signature = sign(body);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // The receiver should use this to ignore a redelivery, exactly as
        // the app does with the WhatsApp provider's message id inbound.
        "X-FinanceBot-Event-Id": row.id,
        ...(signature ? { "X-FinanceBot-Signature": signature } : {}),
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    await prisma.outboundEvent.update({
      where: { id: row.id },
      data: { status: "delivered", deliveredAt: new Date(), lastError: null },
    });
  } catch (error) {
    const attempts = row.attempts + 1;
    const message = error instanceof Error ? error.message : "erro desconhecido";
    await prisma.outboundEvent.update({
      where: { id: row.id },
      data: {
        attempts,
        // Giving up is recorded, not hidden: a failed row stays queryable
        // so a stalled integration is diagnosable after the fact.
        status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        lastError: message.slice(0, 500),
        nextAttemptAt: new Date(Date.now() + (BACKOFF_MS[attempts - 1] ?? 7_500_000)),
      },
    });
  }
}

// Drains what is due. Called right after enqueueing (so the common case is
// immediate) and again from verifySession, which is what retries anything
// that failed — the same no-cron pattern the rest of the app uses.
export async function dispatchOutboundEvents() {
  if (!isOutboundConfigured()) return;

  // Rescue anything a crashed process left claimed. Safe to re-send: the
  // receiver is told to dedupe on X-FinanceBot-Event-Id, and a duplicate
  // notification beats a silently dropped one.
  await prisma.outboundEvent.updateMany({
    where: { status: "sending", nextAttemptAt: { lte: new Date() } },
    data: { status: "pending" },
  });

  const due = await prisma.outboundEvent.findMany({
    where: { status: "pending", nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: BATCH,
    select: { id: true, type: true, eventId: true, payload: true, attempts: true },
  });

  // Sequential on purpose: these are notifications, and a burst of parallel
  // posts is a good way to get rate-limited by the gateway downstream.
  for (const row of due) {
    if (await claim(row.id)) await deliverOne(row);
  }
}

// Fire-and-forget wrapper for use inside a Server Action: the user's action
// must not wait on (or fail because of) an automation that is slow or down.
export function dispatchOutboundEventsInBackground() {
  if (!isOutboundConfigured()) return;
  dispatchOutboundEvents().catch((error) => {
    console.error("Falha ao despachar eventos para a automação", error);
  });
}
