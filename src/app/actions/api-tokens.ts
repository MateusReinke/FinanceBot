"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { generateApiToken } from "@/lib/api-auth";
import { optionalPhoneField } from "@/lib/phone";
import type { FormState } from "@/lib/form-state";

const CreateTokenSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Dê um nome pro token (ex: n8n WhatsApp)." })
    .max(60, { error: "Nome muito longo." }),
});

// Returns the plaintext token exactly once. It is never stored and can
// never be shown again — the user copies it now or generates a new one.
export type CreateTokenState = FormState & { token?: string };

export async function createApiToken(
  _state: CreateTokenState | undefined,
  formData: FormData
): Promise<CreateTokenState> {
  const { userId } = await verifySession();

  const parsed = CreateTokenSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const count = await prisma.apiToken.count({ where: { userId, revokedAt: null } });
  if (count >= 10) {
    return { message: "Você já tem 10 tokens ativos. Revogue um antes de criar outro." };
  }

  const { token, tokenHash, prefix } = generateApiToken();
  await prisma.apiToken.create({
    data: { userId, name: parsed.data.name, tokenHash, prefix },
  });

  revalidatePath("/settings");
  return { success: true, token };
}

export async function revokeApiToken(formData: FormData) {
  const { userId } = await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  // Scoped by userId in the same statement, so an id from another account
  // matches nothing instead of revoking someone else's token.
  await prisma.apiToken.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  revalidatePath("/settings");
}

const PhoneSchema = z.object({ phoneNumber: optionalPhoneField });

export async function updatePhoneNumber(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();

  const parsed = PhoneSchema.safeParse({ phoneNumber: formData.get("phoneNumber") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const phoneNumber = parsed.data.phoneNumber;

  if (phoneNumber) {
    const taken = await prisma.user.findFirst({
      where: { phoneNumber, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) {
      return { errors: { phoneNumber: ["Esse número já está vinculado a outra conta."] } };
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { phoneNumber } });

  revalidatePath("/settings");
  return { success: true };
}
