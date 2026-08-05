import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyEventAccess } from "@/lib/events-dal";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; receiptId: string }> }
) {
  const { id: eventId, receiptId } = await params;
  await verifyEventAccess(eventId);

  const receipt = await prisma.eventReceipt.findFirst({
    where: { id: receiptId, eventId },
    select: { imageData: true, mimeType: true },
  });
  if (!receipt) {
    return NextResponse.json({ error: "Nota fiscal não encontrada." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(receipt.imageData), {
    headers: {
      "Content-Type": receipt.mimeType,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
