"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { verifyEventAccess } from "@/lib/events-dal";
import { isOpenAiConfigured, extractReceiptItems } from "@/lib/openai";
import {
  EventSchema,
  AddExpenseSchema,
  ConfirmReceiptExpensesSchema,
  MAX_RECEIPT_BYTES,
  ALLOWED_RECEIPT_MIME_TYPES,
} from "@/lib/validation/events";
import { splitEqually } from "@/lib/events";
import { buildEventPayload } from "@/lib/queries/event-payload";
import { enqueueOutboundEvent, dispatchOutboundEventsInBackground } from "@/lib/outbound";
import type { FormState } from "@/lib/form-state";

function revalidateEvent(eventId: string) {
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
}

// Publishes one event to the automation and kicks off delivery without
// blocking the user's action on it. Wrapped so a broken integration can
// never take down the thing the user actually did.
async function publish(
  type: Parameters<typeof enqueueOutboundEvent>[0]["type"],
  eventId: string,
  extra: Record<string, unknown> = {}
) {
  try {
    const payload = await buildEventPayload(eventId);
    if (!payload) return;
    await enqueueOutboundEvent({ type, eventId, payload: { ...payload, ...extra } });
    dispatchOutboundEventsInBackground();
  } catch (error) {
    console.error(`Falha ao publicar ${type}`, error);
  }
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

  const wantsGroup = formData.get("createWhatsappGroup") === "true";

  const event = await prisma.event.create({
    data: {
      ...validated.data,
      createdById: userId,
      participants: { create: { userId } },
      whatsappGroupStatus: wantsGroup ? "pending" : "none",
    },
  });

  if (wantsGroup) {
    await publish("event.created", event.id);
  }

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

// Reads the "quem pagou quanto" step: one row per payer with an amount.
// Returns null when nothing was filled in at all, so the caller can fall
// back to "whoever is adding it paid the whole thing" — the common case,
// and not worth making anyone click through.
function readPayments(formData: FormData, participantIds: Set<string>) {
  const payments: Record<string, number> = {};
  let any = false;
  for (const id of participantIds) {
    const raw = formData.get(`paidAmount_${id}`);
    const value = typeof raw === "string" && raw.trim() ? Number(raw) : 0;
    if (Number.isNaN(value) || value < 0) return { error: "Valores pagos inválidos." as const };
    if (value > 0) {
      payments[id] = Math.round(value * 100) / 100;
      any = true;
    }
  }
  return any ? { payments } : { payments: null };
}

export async function addExpense(_state: FormState, formData: FormData): Promise<FormState> {
  const eventId = formData.get("eventId");
  if (typeof eventId !== "string") return { message: "Evento inválido." };
  const { userId } = await verifyEventAccess(eventId);

  const validated = AddExpenseSchema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    isShared: formData.get("isShared"),
    splitMode: formData.get("splitMode"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }
  const { description, amount, date, isShared, splitMode } = validated.data;

  const participants = await prisma.eventParticipant.findMany({ where: { eventId } });
  const participantIds = new Set(participants.map((p) => p.userId));

  // --- Step 1: who paid, and how much
  const read = readPayments(formData, participantIds);
  if ("error" in read) return { message: read.error };
  // No payer step filled in means the person adding the expense paid it.
  const payments = read.payments ?? { [userId]: amount };

  const paidSum = Object.values(payments).reduce((sum, v) => sum + v, 0);
  if (Math.abs(paidSum - amount) > 0.01) {
    return {
      message: `Quem pagou soma ${paidSum.toFixed(2)}, mas a despesa é de ${amount.toFixed(2)}.`,
    };
  }

  // --- Step 2: who it is for
  let splits: Record<string, number>;

  if (!isShared) {
    // A personal expense is owed entirely by whoever paid it. Modelling it
    // as a split (rather than as "no split at all") keeps every downstream
    // reader — totals, receipts, the API — on one shape, and the balance
    // nets to zero for that person either way.
    if (Object.keys(payments).length > 1) {
      return { message: "Uma despesa pessoal só pode ter um pagador." };
    }
    splits = { ...payments };
  } else if (splitMode === "equal") {
    const included = formData
      .getAll("participantIds")
      .filter((v): v is string => typeof v === "string");
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
      return {
        message: `A soma das partes (${sum.toFixed(2)}) precisa bater com o valor total (${amount.toFixed(2)}).`,
      };
    }
    if (Object.keys(splits).length === 0) {
      return { message: "Informe ao menos uma parte maior que zero." };
    }
  }

  const expense = await prisma.eventExpense.create({
    data: {
      eventId,
      description,
      amount,
      date,
      isShared,
      payments: {
        create: Object.entries(payments).map(([payerId, paidAmount]) => ({
          userId: payerId,
          amount: paidAmount,
        })),
      },
      splits: {
        create: Object.entries(splits).map(([splitUserId, splitAmount]) => ({
          userId: splitUserId,
          amount: splitAmount,
        })),
      },
    },
    include: { payments: { include: { user: { select: { name: true } } } } },
  });

  // A personal expense is nobody else's business, so it is not announced to
  // the group — same rule the event page applies when deciding who sees it.
  if (isShared) {
    await publish("event.expense_created", eventId, {
      expense: {
        id: expense.id,
        description: expense.description,
        amount: expense.amount,
        date: expense.date,
        paidBy: expense.payments.map((p) => ({ name: p.user.name, amount: p.amount })),
        splits: Object.entries(splits).map(([splitUserId, amountDue]) => ({
          userId: splitUserId,
          amount: amountDue,
        })),
      },
    });
  }

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

export type ExtractReceiptResult =
  { error: string } | { receiptId: string; items: { description: string; amount: number }[] };

// Not FormState/useActionState-shaped on purpose: the caller needs the
// extracted items back to drive an editable review step, not just a
// success/error flag. Persists the photo immediately (as EventReceipt) so
// step two only ever needs to reference its id, never re-upload the file.
export async function extractReceiptExpenses(
  eventId: string,
  formData: FormData
): Promise<ExtractReceiptResult> {
  const { userId } = await verifyEventAccess(eventId);

  if (!isOpenAiConfigured()) {
    return { error: "Leitura de nota fiscal por IA não está configurada neste servidor." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione uma foto da nota fiscal." };
  }
  if (
    !ALLOWED_RECEIPT_MIME_TYPES.includes(file.type as (typeof ALLOWED_RECEIPT_MIME_TYPES)[number])
  ) {
    return { error: "Formato não suportado. Envie uma foto em JPEG, PNG ou WEBP." };
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    return { error: `Foto muito grande (máx. ${Math.floor(MAX_RECEIPT_BYTES / 1024 / 1024)}MB).` };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let items: { description: string; amount: number }[];
  try {
    items = await extractReceiptItems(buffer.toString("base64"), file.type);
  } catch (error) {
    console.error("Falha ao ler nota fiscal via OpenAI", error);
    return {
      error: "Não foi possível ler a nota fiscal agora. Tente novamente ou lance manualmente.",
    };
  }

  if (items.length === 0) {
    return {
      error:
        "Não consegui identificar itens nessa foto. Tente uma foto mais nítida ou lance manualmente.",
    };
  }

  const receipt = await prisma.eventReceipt.create({
    data: { eventId, uploadedById: userId, imageData: buffer, mimeType: file.type },
  });

  return { receiptId: receipt.id, items };
}

export async function confirmReceiptExpenses(
  _state: FormState,
  formData: FormData
): Promise<FormState> {
  const eventId = formData.get("eventId");
  if (typeof eventId !== "string") return { message: "Evento inválido." };
  await verifyEventAccess(eventId);

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(String(formData.get("itemsJson") ?? "[]"));
  } catch {
    return { message: "Itens inválidos." };
  }

  const validated = ConfirmReceiptExpensesSchema.safeParse({
    receiptId: formData.get("receiptId"),
    items: rawItems,
    paidById: formData.get("paidById"),
    date: formData.get("date"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }
  const { receiptId, items, paidById, date } = validated.data;

  const receipt = await prisma.eventReceipt.findFirst({ where: { id: receiptId, eventId } });
  if (!receipt) return { message: "Nota fiscal não encontrada." };

  const participants = await prisma.eventParticipant.findMany({ where: { eventId } });
  const participantIds = new Set(participants.map((p) => p.userId));
  if (!participantIds.has(paidById)) {
    return { errors: { paidById: ["Quem pagou precisa ser um participante do evento."] } };
  }

  const included = formData
    .getAll("participantIds")
    .filter((v): v is string => typeof v === "string");
  const validIncluded = [...new Set(included.filter((id) => participantIds.has(id)))];
  if (validIncluded.length === 0) {
    return { message: "Selecione ao menos um participante para dividir as despesas." };
  }

  await prisma.$transaction(
    items.map((item) => {
      const splits = splitEqually(item.amount, validIncluded);
      return prisma.eventExpense.create({
        data: {
          eventId,
          receiptId,
          description: item.description,
          amount: item.amount,
          date,
          // A receipt is one person paying at the till, so it becomes a
          // single payment row per item — the multi-payer step only makes
          // sense for a manually entered expense.
          payments: { create: [{ userId: paidById, amount: item.amount }] },
          splits: {
            create: Object.entries(splits).map(([splitUserId, splitAmount]) => ({
              userId: splitUserId,
              amount: splitAmount,
            })),
          },
        },
      });
    })
  );

  revalidateEvent(eventId);
  return { success: true };
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

  const before = await prisma.eventParticipant.findUnique({
    where: { eventId_userId: { eventId: invite.eventId, userId } },
  });

  await prisma.eventParticipant.upsert({
    where: { eventId_userId: { eventId: invite.eventId, userId } },
    update: {},
    create: { eventId: invite.eventId, userId },
  });

  // Only on a genuinely new join — re-opening the invite link should not
  // announce the same person to the group again.
  if (!before) {
    const joiner = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, phoneNumber: true },
    });
    await publish("event.participant_joined", invite.eventId, { joined: joiner });
  }

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
