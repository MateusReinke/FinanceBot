import "server-only";
import { prisma } from "@/lib/prisma";
import { computeBalances, computePersonalTotals } from "@/lib/events";

// Deliberately minimal: only the event's name/description, never expenses or
// balances — an invite code proves you were invited, not that you're a
// participant yet, so nothing financial is shown before joining.
export async function getInviteInfo(code: string) {
  const invite = await prisma.eventInvite.findUnique({
    where: { code },
    include: { event: { select: { id: true, name: true, description: true } } },
  });
  if (!invite || invite.revoked || (invite.expiresAt && invite.expiresAt < new Date())) {
    return null;
  }
  return invite;
}

export async function getUserEvents(userId: string) {
  const participations = await prisma.eventParticipant.findMany({
    where: { userId },
    include: {
      event: {
        include: {
          participants: { select: { userId: true } },
          expenses: {
            select: { amount: true, isShared: true, payments: true, splits: true },
          },
        },
      },
    },
    orderBy: { event: { updatedAt: "desc" } },
  });

  return participations.map(({ event }) => {
    const balances = computeBalances(event.expenses);
    const myBalance = balances.get(userId)?.net ?? 0;
    return {
      id: event.id,
      name: event.name,
      description: event.description,
      participantCount: event.participants.length,
      expenseCount: event.expenses.length,
      updatedAt: event.updatedAt,
      myBalance,
    };
  });
}

// Assumes the caller already ran verifyEventAccess(eventId) for the current
// session — this function does not itself check participation, it only
// fetches. Never call it without that guard immediately before.
export async function getEventDetail(eventId: string, viewerId: string) {
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    include: {
      participants: {
        // phoneNumber comes along so the event page can name who is missing
        // one and therefore can't be added to the WhatsApp group.
        include: { user: { select: { id: true, name: true, email: true, phoneNumber: true } } },
        orderBy: { joinedAt: "asc" },
      },
      expenses: {
        include: {
          payments: { include: { user: { select: { id: true, name: true, email: true } } } },
          splits: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      },
      invites: {
        where: { revoked: false },
        orderBy: { createdAt: "desc" },
      },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  // A personal expense belongs to whoever paid it and to nobody else, so
  // it is filtered out here rather than hidden in the UI — the other
  // participants' page never receives it in the first place.
  const visibleExpenses = event.expenses.filter(
    (e) => e.isShared || e.payments.some((p) => p.userId === viewerId)
  );

  // Balances come from every expense, not just the visible ones:
  // computeBalances already ignores personal ones, and filtering first
  // would make a balance depend on who is looking at it.
  const balances = computeBalances(event.expenses);
  const personalTotals = computePersonalTotals(event.expenses);

  // Anyone who ever paid or owed a split is part of the ledger, even after
  // leaving — fold them in as a "former participant" so balances stay
  // accurate and attributable.
  const participantUserIds = new Set(event.participants.map((p) => p.userId));
  // Projected down to the identity fields the balance rows actually
  // render. Participants carry phoneNumber for the group panel, but that
  // has no business travelling into every balance row on the client.
  const historicalUsers = new Map(
    event.participants.map((p) => [
      p.userId,
      { id: p.user.id, name: p.user.name, email: p.user.email },
    ])
  );
  for (const expense of event.expenses) {
    for (const payment of expense.payments) {
      historicalUsers.set(payment.user.id, payment.user);
    }
    for (const split of expense.splits) {
      historicalUsers.set(split.user.id, split.user);
    }
  }

  const balanceRows = Array.from(balances.values())
    .map((b) => ({
      ...b,
      user: historicalUsers.get(b.userId)!,
      active: participantUserIds.has(b.userId),
      // Everything this person put in, personal spending included — a
      // different question from `paid`, which only counts shared expenses.
      personalTotal: personalTotals.get(b.userId) ?? 0,
    }))
    .sort((a, b) => b.net - a.net);

  return { event: { ...event, expenses: visibleExpenses }, balanceRows };
}

export type EventDetail = Awaited<ReturnType<typeof getEventDetail>>;
