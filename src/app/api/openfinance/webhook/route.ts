import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncPluggyItem } from "@/lib/pluggy-sync";

type PluggyWebhookPayload = {
  event?: string;
  itemId?: string;
};

// Verifies the call really came from Pluggy before acting on it. Two
// accepted proofs, in order of preference:
//
//  1. PLUGGY_WEBHOOK_SECRET set -> HMAC-SHA256 of the raw body must match
//     the x-signature header. This is the real check.
//  2. PLUGGY_WEBHOOK_TOKEN set -> a shared secret in the URL query string,
//     for setups where only the webhook URL is configurable.
//
// With neither configured the endpoint refuses to do any work at all. That
// is deliberate: this route triggers outbound API calls and database writes
// for an arbitrary itemId, so leaving it open lets anyone who can guess or
// observe an item id drive traffic through someone else's connection.
function verifySignature(request: Request, rawBody: string): boolean {
  const secret = process.env.PLUGGY_WEBHOOK_SECRET;
  if (secret) {
    const provided = request.headers.get("x-signature") ?? "";
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  const urlToken = process.env.PLUGGY_WEBHOOK_TOKEN;
  if (urlToken) {
    const provided = new URL(request.url).searchParams.get("token") ?? "";
    const a = Buffer.from(provided);
    const b = Buffer.from(urlToken);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  return false;
}

// Pluggy calls this endpoint (no user session available) whenever a linked
// item changes — new transactions, a status change, MFA required, etc. We
// acknowledge with 200 on anything we accept so Pluggy doesn't keep
// retrying, and resolve the item by its own opaque id rather than trusting
// anything else in the body.
export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!verifySignature(request, rawBody)) {
    // 401 rather than a silent 200: a misconfigured secret should be loud
    // in Pluggy's delivery log instead of looking like success.
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  let payload: PluggyWebhookPayload | null = null;
  try {
    payload = JSON.parse(rawBody) as PluggyWebhookPayload;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const itemId = payload?.itemId;
  if (!itemId) {
    return NextResponse.json({ ok: true });
  }

  try {
    const pluggyItem = await prisma.pluggyItem.findUnique({ where: { pluggyItemId: itemId } });
    if (!pluggyItem) {
      return NextResponse.json({ ok: true });
    }

    if (payload.event === "item/deleted") {
      await prisma.pluggyItem.delete({ where: { id: pluggyItem.id } });
    } else if (payload.event === "item/error" || payload.event === "item/login_error") {
      // Nothing to sync — record why so the Contas screen can tell the user
      // to reconnect instead of silently going stale.
      await prisma.pluggyItem.update({
        where: { id: pluggyItem.id },
        data: {
          status: payload.event === "item/login_error" ? "LOGIN_ERROR" : "ERROR",
          lastSyncError: "O banco pediu uma nova autenticação.",
        },
      });
    } else {
      await syncPluggyItem(pluggyItem.id);
    }
  } catch (error) {
    console.error("Falha ao processar webhook do Pluggy", error);
  }

  return NextResponse.json({ ok: true });
}
