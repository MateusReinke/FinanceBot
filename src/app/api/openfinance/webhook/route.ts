import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncPluggyItem } from "@/lib/pluggy-sync";

type PluggyWebhookPayload = {
  event?: string;
  itemId?: string;
};

// Pluggy calls this endpoint (no user session available) whenever a linked
// item changes — new transactions, a status change, MFA required, etc. We
// always acknowledge with 200 so Pluggy doesn't keep retrying, and resolve
// the item by its own opaque id rather than trusting anything else in the body.
export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as PluggyWebhookPayload | null;
  const itemId = payload?.itemId;

  if (!itemId) {
    return NextResponse.json({ ok: true });
  }

  try {
    const pluggyItem = await prisma.pluggyItem.findUnique({ where: { pluggyItemId: itemId } });
    if (!pluggyItem) {
      return NextResponse.json({ ok: true });
    }

    if (payload?.event === "item/deleted") {
      await prisma.pluggyItem.delete({ where: { id: pluggyItem.id } });
    } else {
      await syncPluggyItem(pluggyItem.id);
    }
  } catch (error) {
    console.error("Falha ao processar webhook do Pluggy", error);
  }

  return NextResponse.json({ ok: true });
}
