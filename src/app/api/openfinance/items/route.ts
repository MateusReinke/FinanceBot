import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getPluggyItem, isPluggyConfigured } from "@/lib/pluggy";
import { syncPluggyItem } from "@/lib/pluggy-sync";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!isPluggyConfigured()) {
    return NextResponse.json(
      { error: "Integração com Open Finance não configurada." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const pluggyItemId = typeof body?.itemId === "string" ? body.itemId : undefined;
  if (!pluggyItemId) {
    return NextResponse.json({ error: "itemId ausente." }, { status: 400 });
  }

  try {
    const remoteItem = await getPluggyItem(pluggyItemId);

    const pluggyItem = await prisma.pluggyItem.upsert({
      where: { pluggyItemId },
      update: {
        status: remoteItem.status,
        executionStatus: remoteItem.executionStatus ?? null,
        connectorName: remoteItem.connector?.name ?? "Conexão bancária",
        connectorImageUrl: remoteItem.connector?.imageUrl ?? null,
      },
      create: {
        userId: session.userId,
        pluggyItemId,
        status: remoteItem.status,
        executionStatus: remoteItem.executionStatus ?? null,
        connectorName: remoteItem.connector?.name ?? "Conexão bancária",
        connectorImageUrl: remoteItem.connector?.imageUrl ?? null,
      },
    });

    if (pluggyItem.userId !== session.userId) {
      return NextResponse.json({ error: "Conexão pertence a outro usuário." }, { status: 403 });
    }

    await syncPluggyItem(pluggyItem.id);

    return NextResponse.json({ ok: true, pluggyItemId: pluggyItem.id });
  } catch (error) {
    console.error("Falha ao salvar item do Pluggy", error);
    return NextResponse.json({ error: "Não foi possível concluir a conexão." }, { status: 502 });
  }
}
