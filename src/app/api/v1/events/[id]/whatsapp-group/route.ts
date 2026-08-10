import { NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateApiRequest, rateLimit } from "@/lib/api-auth";

// How the automation reports back after it actually created (or failed to
// create) the WhatsApp group. The app never talks to WhatsApp itself, so
// this is the only way whatsappGroupId ever gets set.
//
//   POST /api/v1/events/{id}/whatsapp-group
//   Authorization: Bearer fbot_...
//   { "groupId": "1203630...@g.us" }
//   { "status": "failed", "error": "número não permite ser adicionado" }
const Schema = z.object({
  groupId: z.string().trim().max(200).optional(),
  status: z.enum(["created", "failed"]).default("created"),
  error: z.string().trim().max(500).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const limited = rateLimit(`whatsapp-group:${auth.userId}`);
  if (!limited.ok) return limited.response;

  const { id } = await params;
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido.", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { groupId, status, error } = parsed.data;

  if (status === "created" && !groupId) {
    return NextResponse.json({ error: "groupId é obrigatório quando status é created." }, { status: 400 });
  }

  // The token's owner must be a participant. Without this check any valid
  // token could point any event at a group its owner controls, which is
  // exactly how a shared ledger leaks.
  const participant = await prisma.eventParticipant.findUnique({
    where: { eventId_userId: { eventId: id, userId: auth.userId } },
  });
  if (!participant) {
    // 404, not 403 — same rule the rest of the events code follows, so a
    // token can't be used to discover which event ids exist.
    return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
  }

  const updated = await prisma.event.update({
    where: { id },
    data: {
      whatsappGroupId: status === "created" ? groupId : null,
      whatsappGroupStatus: status,
    },
    select: { id: true, whatsappGroupId: true, whatsappGroupStatus: true },
  });

  if (status === "failed") {
    console.warn(`Automação não conseguiu criar o grupo do evento ${id}: ${error ?? "sem detalhe"}`);
  }

  return NextResponse.json(updated);
}
