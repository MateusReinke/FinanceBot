import "server-only";
import { prisma } from "@/lib/prisma";

// What the automation needs to act on an event, assembled in one place so
// every outbound payload for the same event looks the same.
//
// Phone numbers of other participants leave the app here. That is the
// feature — a group cannot be created without them — but it is worth being
// deliberate about: only members of this event are ever included, only
// their name and number, and it goes to the deployment's own configured
// n8n instance, nowhere else.
export async function buildEventPayload(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      participants: {
        include: { user: { select: { id: true, name: true, phoneNumber: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!event) return null;

  const members = event.participants.map((p) => ({
    userId: p.user.id,
    name: p.user.name,
    phone: p.user.phoneNumber,
  }));

  return {
    event: {
      id: event.id,
      name: event.name,
      description: event.description,
      whatsappGroupId: event.whatsappGroupId,
      whatsappGroupStatus: event.whatsappGroupStatus,
    },
    // Split apart rather than left for the automation to filter: an account
    // created before the number was required has none, and the flow needs
    // to know it cannot add that person instead of failing on a null.
    members: members.filter((m) => m.phone),
    membersWithoutPhone: members.filter((m) => !m.phone).map((m) => ({ userId: m.userId, name: m.name })),
  };
}
