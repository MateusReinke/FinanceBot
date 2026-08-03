import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { getSession } from "@/lib/session";
import { createConnectToken, isPluggyConfigured } from "@/lib/pluggy";

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

  const body = await request.json().catch(() => ({}));
  const itemId = typeof body?.itemId === "string" ? body.itemId : undefined;

  const user = await getCurrentUser();

  try {
    const accessToken = await createConnectToken({
      itemId,
      clientUserId: user?.email,
    });
    return NextResponse.json({ accessToken });
  } catch (error) {
    console.error("Falha ao criar connect token do Pluggy", error);
    return NextResponse.json({ error: "Não foi possível iniciar a conexão." }, { status: 502 });
  }
}
