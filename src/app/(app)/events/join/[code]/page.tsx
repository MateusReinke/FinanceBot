import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users, TriangleAlert } from "lucide-react";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getInviteInfo } from "@/lib/queries/events";
import { Card, CardContent } from "@/components/ui/card";
import { JoinEventForm } from "./join-event-form";

export const metadata: Metadata = { title: "Entrar em evento — FinanceBot" };

export default async function JoinEventPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { userId } = await verifySession();
  const invite = await getInviteInfo(code);

  if (!invite) {
    return (
      <div className="mx-auto max-w-md pt-10">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <TriangleAlert className="text-danger h-8 w-8" />
            <p className="text-muted-foreground text-sm">
              Este convite não existe, expirou ou foi revogado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const existing = await prisma.eventParticipant.findUnique({
    where: { eventId_userId: { eventId: invite.eventId, userId } },
  });
  if (existing) redirect(`/events/${invite.eventId}`);

  return (
    <div className="mx-auto max-w-md pt-10">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <span className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-full">
            <Users className="h-6 w-6" />
          </span>
          <div>
            <p className="text-muted-foreground text-sm">Você foi convidado para</p>
            <h1 className="text-foreground text-xl font-semibold">{invite.event.name}</h1>
            {invite.event.description ? (
              <p className="text-muted-foreground mt-1 text-sm">{invite.event.description}</p>
            ) : null}
          </div>
          <div className="w-full">
            <JoinEventForm code={code} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
