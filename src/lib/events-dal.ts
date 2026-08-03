import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";

// Central gate for every Event read/write. An event and its expenses only
// ever exist for its participants — this is the one deliberate crack in the
// "a user never sees another user's data" rule, so every access must funnel
// through here rather than each route re-implementing the check.
//
// Deliberately 404s (never 403) on both "no such event" and "not a
// participant" — an authorization failure must look identical to a
// not-found one, or the response itself leaks which event ids are real.
export const verifyEventAccess = cache(async (eventId: string) => {
  const { userId } = await verifySession();

  const participant = await prisma.eventParticipant.findUnique({
    where: { eventId_userId: { eventId, userId } },
    include: { event: true },
  });

  if (!participant) notFound();

  return { userId, event: participant.event };
});
