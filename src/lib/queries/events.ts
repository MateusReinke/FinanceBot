import "server-only";
import { prisma } from "@/lib/prisma";
import { computeBalances } from "@/lib/events";

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
          expenses: { select: { amount: true, paidById: true, splits: true } },
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
export async function getEventDetail(eventId: string) {
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    include: {
      participants: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: "asc" },
      },
      expenses: {
        include: {
          paidBy: { select: { id: true, name: true, email: true } },
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

  const balances = computeBalances(event.expenses);

  // Anyone who ever paid or owed a split is part of the ledger, even after
  // leaving — fold them in as a "former participant" so balances stay
  // accurate and attributable.
  const participantUserIds = new Set(event.participants.map((p) => p.userId));
  const historicalUsers = new Map(
    event.participants.map((p) => [p.userId, p.user])
  );
  for (const expense of event.expenses) {
    historicalUsers.set(expense.paidBy.id, expense.paidBy);
    for (const split of expense.splits) {
      historicalUsers.set(split.user.id, split.user);
    }
  }

  const balanceRows = Array.from(balances.values())
    .map((b) => ({
      ...b,
      user: historicalUsers.get(b.userId)!,
      active: participantUserIds.has(b.userId),
    }))
    .sort((a, b) => b.net - a.net);

  return { event, balanceRows };
}

export type EventDetail = Awaited<ReturnType<typeof getEventDetail>>;
