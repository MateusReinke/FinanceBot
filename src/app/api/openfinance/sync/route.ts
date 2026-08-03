import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { syncPluggyItem } from "@/lib/pluggy-sync";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const pluggyItemId = typeof body?.pluggyItemId === "string" ? body.pluggyItemId : undefined;
  if (!pluggyItemId) {
    return NextResponse.json({ error: "pluggyItemId ausente." }, { status: 400 });
  }

  const pluggyItem = await prisma.pluggyItem.findFirst({
    where: { id: pluggyItemId, userId: session.userId },
  });
  if (!pluggyItem) {
    return NextResponse.json({ error: "Conexão não encontrada." }, { status: 404 });
  }

  try {
    await syncPluggyItem(pluggyItem.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Falha ao sincronizar item do Pluggy", error);
    return NextResponse.json({ error: "Não foi possível sincronizar agora." }, { status: 502 });
  }
}
