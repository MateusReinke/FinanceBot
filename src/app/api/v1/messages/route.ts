import { NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateApiRequest, rateLimit } from "@/lib/api-auth";
import { handleInboundMessage } from "@/lib/inbound-message";

// The endpoint the n8n WhatsApp agent calls. One message in, one reply out:
//
//   POST /api/v1/messages
//   Authorization: Bearer fbot_...
//   { "text": "gastei 45 no mercado", "messageId": "wamid.XYZ", "from": "+5511..." }
//   -> { "reply": "✅ Gasto lançado: R$ 45,00 — Mercado\n...", "status": "created" }
//
// n8n only has to forward the message body and send `reply` back to the
// user. It never sees or needs account ids, category ids, or the user's data.
const MessageSchema = z.object({
  text: z.string().max(2000, { error: "Mensagem muito longa." }),
  // The provider's message id. Optional, but strongly recommended: it is
  // what makes a redelivery safe. Without one, each retry is a new message
  // and would book the expense again — so a random id is generated and the
  // caller is responsible for not retrying.
  messageId: z.string().max(200).optional(),
  // When present, must match the phone number linked to this account. The
  // token already identifies the user; this is a second lock so a shared
  // n8n flow can't post one person's message onto another person's books.
  from: z.string().max(40).optional(),
  channel: z.enum(["whatsapp", "api"]).default("whatsapp"),
});

// Digits only, so "+55 (11) 99999-9999" and "5511999999999" compare equal.
function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const limited = rateLimit(`messages:${auth.userId}`);
  if (!limited.ok) return limited.response;

  const body = await request.json().catch(() => null);
  const parsed = MessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido.", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { text, messageId, from, channel } = parsed.data;

  if (from) {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { phoneNumber: true },
    });
    if (!user?.phoneNumber || normalizePhone(user.phoneNumber) !== normalizePhone(from)) {
      return NextResponse.json(
        { error: "Número não confere com o WhatsApp vinculado a esta conta." },
        { status: 403 }
      );
    }
  }

  try {
    const result = await handleInboundMessage({
      userId: auth.userId,
      text,
      externalId: messageId ?? `gen_${crypto.randomUUID()}`,
      channel,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Falha ao processar mensagem recebida", error);
    return NextResponse.json({ error: "Não foi possível processar a mensagem." }, { status: 500 });
  }
}
