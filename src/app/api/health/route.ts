import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Healthcheck falhou ao consultar o banco", error);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
