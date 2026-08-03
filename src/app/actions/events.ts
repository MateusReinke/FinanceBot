"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { verifyEventAccess } from "@/lib/events-dal";
import { EventSchema, AddExpenseSchema } from "@/lib/validation/events";
import { splitEqually } from "@/lib/events";
import type { FormState } from "@/lib/form-state";

function revalidateEvent(eventId: string) {
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
}

export async function createEvent(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();

  const validated = EventSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const event = await prisma.event.create({
    data: {
      ...validated.data,
      createdById: userId,
      participants: { create: { userId } },
    },
  });

  revalidatePath("/events");
  redirect(`/events/${event.id}`);
}

export async function updateEvent(_state: FormState, formData: FormData): Promise<FormState> {
  const eventId = formData.get("eventId");
  if (typeof eventId !== "string") return { message: "Evento inválido." };
  await verifyEventAccess(eventId);

  const validated = EventSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  await prisma.event.update({ where: { id: eventId }, data: validated.data });
  revalidateEvent(eventId);
  return { success: true };
}

export async function deleteEvent(formData: FormData) {
  const eventId = formData.get("eventId");
  if (typeof eventId !== "string") return;
  const { userId, event } = await verifyEventAccess(eventId);

  // Any participant may manage an orphaned (creator-deleted) event, but a
  // living creator is the only one who can tear the whole group down.
  if (event.createdById && event.createdById !== userId) return;

  await prisma.event.delete({ where: { id: eventId } });
  revalidatePath("/events");
  redirect("/events");
}

export async function addExpense(_state: FormState, formData: FormData): Promise<FormState> {
  const eventId = formData.get("eventId");
  if (typeof eventId !== "string") return { message: "Evento inválido." };
  await verifyEventAccess(eventId);

  const validated = AddExpenseSchema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    paidById: formData.get("paidById"),
    date: formData.get("date"),
    splitMode: formData.get("splitMode"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }
  const { description, amount, paidById, date, splitMode } = validated.data;

  const participants = await prisma.eventParticipant.findMany({ where: { eventId } });
  const participantIds = new Set(participants.map((p) => p.userId));

  if (!participantIds.has(paidById)) {
    return { errors: { paidById: ["Quem pagou precisa ser um participante do evento."] } };
  }

  let splits: Record<string, number>;

  if (splitMode === "equal") {
    const included = formData.getAll("participantIds").filter((v): v is string => typeof v === "string");
    const validIncluded = [...new Set(included.filter((id) => participantIds.has(id)))];
    if (validIncluded.length === 0) {
      return { message: "Selecione ao menos um participante para dividir a despesa." };
    }
    splits = splitEqually(amount, validIncluded);
  } else {
    splits = {};
    let sum = 0;
    for (const id of participantIds) {
      const raw = formData.get(`customAmount_${id}`);
      const value = typeof raw === "string" && raw.trim() ? Number(raw) : 0;
      if (Number.isNaN(value) || value < 0) {
        return { message: "Valores customizados inválidos." };
      }
      if (value > 0) splits[id] = Math.round(value * 100) / 100;
      sum += value;
    }
    if (Math.abs(sum - amount) > 0.01) {
      return { message: `A soma das partes (${sum.toFixed(2)}) precisa bater com o valor total (${amount.toFixed(2)}).` };
    }
    if (Object.keys(splits).length === 0) {
      return { message: "Informe ao menos uma parte maior que zero." };
    }
  }

  await prisma.eventExpense.create({
    data: {
      eventId,
      description,
      amount,
      paidById,
      date,
      splits: {
        create: Object.entries(splits).map(([userId, splitAmount]) => ({
          userId,
          amount: splitAmount,
        })),
      },
    },
  });

  revalidateEvent(eventId);
  return { success: true };
}

export async function deleteExpense(formData: FormData) {
  const eventId = formData.get("eventId");
  const expenseId = formData.get("expenseId");
  if (typeof eventId !== "string" || typeof expenseId !== "string") return;
  await verifyEventAccess(eventId);

  const expense = await prisma.eventExpense.findFirst({ where: { id: expenseId, eventId } });
  if (!expense) return;

  await prisma.eventExpense.delete({ where: { id: expenseId } });
  revalidateEvent(eventId);
}

export async function generateInvite(formData: FormData) {
  const eventId = formData.get("eventId");
  if (typeof eventId !== "string") return;
  const { userId } = await verifyEventAccess(eventId);

  const code = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.eventInvite.create({
    data: { eventId, code, createdById: userId, expiresAt },
  });
  revalidateEvent(eventId);
}

export async function revokeInvite(formData: FormData) {
  const eventId = formData.get("eventId");
  const inviteId = formData.get("inviteId");
  if (typeof eventId !== "string" || typeof inviteId !== "string") return;
  await verifyEventAccess(eventId);

  const invite = await prisma.eventInvite.findFirst({ where: { id: inviteId, eventId } });
  if (!invite) return;

  await prisma.eventInvite.update({ where: { id: inviteId }, data: { revoked: true } });
  revalidateEvent(eventId);
}

export async function joinEventByCode(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();
  const code = formData.get("code");
  if (typeof code !== "string" || !code) {
    return { message: "Link de convite inválido." };
  }

  const invite = await prisma.eventInvite.findUnique({ where: { code } });
  if (!invite || invite.revoked || (invite.expiresAt && invite.expiresAt < new Date())) {
    return { message: "Este convite não é mais válido." };
  }

  await prisma.eventParticipant.upsert({
    where: { eventId_userId: { eventId: invite.eventId, userId } },
    update: {},
    create: { eventId: invite.eventId, userId },
  });

  revalidateEvent(invite.eventId);
  redirect(`/events/${invite.eventId}`);
}

export async function leaveEvent(formData: FormData) {
  const eventId = formData.get("eventId");
  if (typeof eventId !== "string") return;
  const { userId, event } = await verifyEventAccess(eventId);

  const remaining = await prisma.eventParticipant.findMany({ where: { eventId } });
  const stillHere = remaining.filter((p) => p.userId !== userId);

  if (stillHere.length === 0) {
    // Last participant leaving — nothing left that can ever access this
    // event again, so clean it up instead of leaving orphaned rows.
    await prisma.event.delete({ where: { id: eventId } });
    revalidatePath("/events");
    redirect("/events");
  }

  await prisma.eventParticipant.delete({
    where: { eventId_userId: { eventId, userId } },
  });

  if (event.createdById === userId) {
    const nextOwner = stillHere.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0];
    await prisma.event.update({ where: { id: eventId }, data: { createdById: nextOwner.userId } });
  }

  revalidatePath("/events");
  redirect("/events");
}
