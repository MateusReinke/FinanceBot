import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { deletePluggyItem } from "@/lib/pluggy";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const pluggyItem = await prisma.pluggyItem.findFirst({ where: { id, userId: session.userId } });
  if (!pluggyItem) {
    return NextResponse.json({ error: "Conexão não encontrada." }, { status: 404 });
  }

  try {
    await deletePluggyItem(pluggyItem.pluggyItemId);
  } catch (error) {
    console.error("Falha ao remover item no Pluggy (prosseguindo com remoção local)", error);
  }

  await prisma.pluggyItem.delete({ where: { id: pluggyItem.id } });

  return NextResponse.json({ ok: true });
}
